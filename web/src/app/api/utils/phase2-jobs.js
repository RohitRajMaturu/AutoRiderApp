import sql from "@/app/api/utils/sql";
import { sendPushToUsers } from "@/app/api/utils/push-notifications";
import { sendWhatsAppWithSmsFallback } from "@/app/api/utils/notifications/phase2Messaging";
import { writeOperationalEvent } from "@/app/api/utils/observability";

export async function generatePassRides() {
  const rows = await sql`
    INSERT INTO pass_rides (pass_id, scheduled_date, actual_driver_id, status)
    SELECT p.id, (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date, p.driver_id,
      CASE WHEN p.driver_id IS NULL THEN 'PENDING' ELSE 'DRIVER_ASSIGNED' END
    FROM commuter_passes p
    WHERE p.status = 'ACTIVE' AND p.payment_status = 'PAID'
      AND (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date BETWEEN p.start_date AND p.end_date
      AND upper(to_char((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date, 'DY')) = ANY(p.scheduled_days)
    ON CONFLICT (pass_id, scheduled_date) DO NOTHING
    RETURNING id
  `;
  return { created: rows.length };
}

export async function sendPassReminders() {
  const due = await sql`
    WITH claimed AS (
      SELECT pr.id
      FROM pass_rides pr JOIN commuter_passes p ON p.id = pr.pass_id
      WHERE pr.status IN ('PENDING', 'DRIVER_ASSIGNED') AND pr.reminder_sent_at IS NULL
        AND timezone('Asia/Kolkata', pr.scheduled_date + p.scheduled_time) BETWEEN
          CURRENT_TIMESTAMP + INTERVAL '20 minutes' AND CURRENT_TIMESTAMP + INTERVAL '40 minutes'
      ORDER BY pr.scheduled_date, p.scheduled_time LIMIT 100
      FOR UPDATE OF pr SKIP LOCKED
    )
    UPDATE pass_rides pr SET reminder_sent_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    FROM claimed WHERE pr.id = claimed.id RETURNING pr.id
  `;
  if (!due.length) return { processed: 0 };
  const rides = await sql`
    SELECT pr.id, pr.otp, p.id AS pass_id, p.passenger_id, p.pickup_label,
      passenger.phone AS passenger_phone, passenger.name AS passenger_name,
      driver_user.id AS driver_user_id, driver_user.name AS driver_name, d.vehicle_number
    FROM pass_rides pr JOIN commuter_passes p ON p.id=pr.pass_id
    JOIN auth_users passenger ON passenger.id=p.passenger_id
    LEFT JOIN drivers d ON d.id=pr.actual_driver_id
    LEFT JOIN auth_users driver_user ON driver_user.id=d.user_id
    WHERE pr.id = ANY(${due.map((row) => row.id)}::uuid[])
  `;
  await Promise.all(
    rides
      .flatMap((ride) => [
        sendPushToUsers([ride.passenger_id], {
          title: "TukTukPass pickup in 30 minutes",
          body: `Your OTP is ${ride.otp}. ${ride.driver_name || "Your driver"} is assigned.`,
          data: {
            type: "pass_reminder",
            passId: ride.pass_id,
            passRideId: ride.id,
          },
        }),
        ride.driver_user_id
          ? sendPushToUsers([ride.driver_user_id], {
              title: "TukTukPass pickup in 30 minutes",
              body: `Collect ${ride.passenger_name || "your passenger"} from ${ride.pickup_label}.`,
              data: {
                type: "pass_driver_reminder",
                passId: ride.pass_id,
                passRideId: ride.id,
              },
            })
          : Promise.resolve(),
        sendWhatsAppWithSmsFallback({
          phone: ride.passenger_phone,
          templateName: "PASS_REMINDER",
          params: [
            ride.passenger_name || "Passenger",
            ride.otp,
            ride.driver_name || "Assigned driver",
            ride.vehicle_number || "",
          ],
          smsMessage: `TukTukPass pickup in 30 minutes. OTP ${ride.otp}. Driver: ${ride.driver_name || "assigned"}.`,
          referenceId: ride.id,
          targetType: "pass_ride",
        }),
      ])
      .map((promise) => Promise.resolve(promise).catch(() => null)),
  );
  return { processed: rides.length };
}

export async function handlePassNoShows() {
  const rows = await sql.transaction(async (tx) => {
    const due = await tx`
      SELECT pr.id, pr.pass_id, p.passenger_id, p.backup_driver_id,
        greatest(1, round(p.agreed_fare::numeric /
          greatest(1, cardinality(p.scheduled_days) * CASE WHEN p.duration_type='MONTHLY' THEN 4 ELSE 1 END)))::int AS ride_fare
      FROM pass_rides pr JOIN commuter_passes p ON p.id=pr.pass_id
      WHERE pr.status IN ('PENDING','DRIVER_ASSIGNED') AND pr.driver_arrived_at IS NULL
        AND timezone('Asia/Kolkata', pr.scheduled_date + p.scheduled_time) < CURRENT_TIMESTAMP - INTERVAL '15 minutes'
      ORDER BY pr.scheduled_date, p.scheduled_time LIMIT 100 FOR UPDATE OF pr SKIP LOCKED
    `;
    const handled = [];
    for (const ride of due) {
      if (ride.backup_driver_id) {
        await tx`UPDATE pass_rides SET actual_driver_id=${ride.backup_driver_id}, status='DRIVER_ASSIGNED',
          backup_activated=true, driver_no_show_escalated=true, updated_at=CURRENT_TIMESTAMP WHERE id=${ride.id}`;
        handled.push({ ...ride, backup: true });
      } else {
        await tx`UPDATE pass_rides SET status='DRIVER_NO_SHOW', driver_no_show_escalated=true,
          refund_issued=true, refund_amount=${ride.ride_fare}, updated_at=CURRENT_TIMESTAMP WHERE id=${ride.id}`;
        handled.push({ ...ride, backup: false });
      }
      await tx`UPDATE commuter_passes SET driver_no_show_count=driver_no_show_count+1,
        updated_at=CURRENT_TIMESTAMP WHERE id=${ride.pass_id}`;
    }
    return handled;
  });
  await Promise.allSettled(
    rows.map((ride) =>
      sendPushToUsers([ride.passenger_id], {
        title: ride.backup
          ? "Backup driver assigned"
          : "TukTukPass ride refunded",
        body: ride.backup
          ? "Your backup driver has been activated."
          : `₹${ride.ride_fare} was marked for refund because the driver did not arrive.`,
        data: {
          type: ride.backup ? "pass_backup_activated" : "pass_no_show_refund",
          passId: ride.pass_id,
        },
      }),
    ),
  );
  if (rows.some((ride) => !ride.backup))
    await writeOperationalEvent({
      eventType: "pass_driver_no_show",
      targetType: "commuter_pass",
      severity: "warn",
      metadata: { affected: rows.filter((ride) => !ride.backup).length },
    }).catch(() => {});
  return {
    processed: rows.length,
    backupsActivated: rows.filter((row) => row.backup).length,
  };
}

export async function autoResumePasses() {
  const rows =
    await sql`UPDATE commuter_passes SET status='ACTIVE', pause_start_date=NULL,
    pause_end_date=NULL, updated_at=CURRENT_TIMESTAMP
    WHERE status='PAUSED' AND pause_end_date < (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date RETURNING id`;
  return { resumed: rows.length };
}

export async function expirePasses() {
  const rows =
    await sql`UPDATE commuter_passes SET status='EXPIRED', updated_at=CURRENT_TIMESTAMP
    WHERE status IN ('ACTIVE','PAUSED') AND end_date < (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date RETURNING id`;
  return { expired: rows.length };
}

export async function generateInstitutionTrips() {
  const rows = await sql`
    INSERT INTO institution_trips (route_id,institution_id,scheduled_date,driver_id,driver_assigned_at,members_expected)
    SELECT r.id,r.institution_id,(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date,r.driver_id,
      CASE WHEN r.driver_id IS NULL THEN NULL ELSE CURRENT_TIMESTAMP END,
      COALESCE((SELECT array_agg(m.id ORDER BY m.stop_order NULLS LAST) FROM institution_members m
        WHERE m.route_id=r.id AND m.active=true),'{}')
    FROM institution_routes r
    WHERE r.status='ACTIVE' AND upper(to_char((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date,'DY'))=ANY(r.scheduled_days)
    ON CONFLICT (route_id,scheduled_date) DO NOTHING RETURNING id
  `;
  return { created: rows.length };
}

export async function sendInstitutionEveningReminders() {
  const members = await sql`
    SELECT DISTINCT m.id,m.member_name,m.guardian_phone,r.route_name,r.scheduled_time,i.name AS institution_name
    FROM institution_routes r JOIN institutions i ON i.id=r.institution_id
    JOIN institution_members m ON m.route_id=r.id AND m.active=true AND m.sms_opted_out=false
    WHERE r.status='ACTIVE' AND upper(to_char((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date + 1,'DY'))=ANY(r.scheduled_days)
    LIMIT 500
  `;
  await Promise.all(
    members.map((member) =>
      sendWhatsAppWithSmsFallback({
        phone: member.guardian_phone,
      templateName: "SCHOOL_EVENING_REMINDER",
        params: [
          member.member_name,
          member.institution_name,
          member.route_name,
          String(member.scheduled_time).slice(0, 5),
        ],
        smsMessage: `${member.institution_name}: ${member.member_name}'s ${member.route_name} is scheduled tomorrow at ${String(member.scheduled_time).slice(0, 5)}.`,
        referenceId: member.id,
        targetType: "institution_member",
      }),
    ),
  );
  return { processed: members.length };
}

export async function generateInstitutionInvoices() {
  const rows = await sql`
    INSERT INTO institution_invoices (institution_id,billing_month,total_routes,total_trips_completed,total_trips_scheduled,amount,status)
    SELECT i.id,date_trunc('month',(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date)::date,
      count(DISTINCT r.id)::int,
      count(DISTINCT t.id) FILTER (WHERE t.status='COMPLETED')::int,
      count(DISTINCT t.id)::int,i.monthly_fee,'DRAFT'
    FROM institutions i LEFT JOIN institution_routes r ON r.institution_id=i.id
    LEFT JOIN institution_trips t ON t.institution_id=i.id AND t.scheduled_date>=date_trunc('month',(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date)::date
    WHERE i.status IN ('TRIAL','ACTIVE') GROUP BY i.id,i.monthly_fee
    ON CONFLICT (institution_id,billing_month) DO NOTHING RETURNING id
  `;
  return { created: rows.length };
}

export async function chaseOverdueInvoices() {
  const invoices = await sql`
    UPDATE institution_invoices inv SET status='OVERDUE', overdue_reminder_count=overdue_reminder_count+1
    FROM institutions i
    WHERE i.id=inv.institution_id AND inv.status IN ('SENT','OVERDUE')
      AND inv.sent_at < CURRENT_TIMESTAMP - INTERVAL '7 days' AND inv.overdue_reminder_count < 3
    RETURNING inv.id,inv.amount,inv.razorpay_payment_link_url,i.contact_phone,i.contact_name
  `;
  await Promise.all(
    invoices.map((invoice) =>
      sendWhatsAppWithSmsFallback({
        phone: invoice.contact_phone,
        templateName: "INSTITUTION_INVOICE",
        params: [
          invoice.contact_name,
          invoice.amount,
          invoice.razorpay_payment_link_url || "Contact TukTukGo",
        ],
        smsMessage: `TukTukGo invoice of Rs ${invoice.amount} is overdue. ${invoice.razorpay_payment_link_url || "Please contact support."}`,
        referenceId: invoice.id,
        targetType: "institution_invoice",
      }),
    ),
  );
  return { processed: invoices.length };
}
