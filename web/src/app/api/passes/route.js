import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";
import { getRouteEstimate } from "@/app/api/utils/locations";
import { createOrder, isRazorpayConfigured } from "@/app/api/utils/payments/razorpayService";
import {
  addDays,
  calculatePassFare,
  countScheduledRides,
  phase2Error,
  readCoordinate,
  readDays,
  readTime,
} from "@/app/api/utils/phase2";

export async function GET(request) {
  const session = await auth(request);
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await sql`
    SELECT
      p.*,
      u.name AS driver_name,
      u.image AS driver_image,
      d.vehicle_number,
      COALESCE((
        SELECT json_agg(pr ORDER BY pr.scheduled_date ASC)
        FROM pass_rides pr
        WHERE pr.pass_id = p.id
          AND pr.scheduled_date >= CURRENT_DATE
          AND pr.scheduled_date < CURRENT_DATE + 8
      ), '[]'::json) AS upcoming_rides
    FROM commuter_passes p
    LEFT JOIN drivers d ON d.id = p.driver_id
    LEFT JOIN auth_users u ON u.id = d.user_id
    WHERE p.passenger_id = ${session.user.id}
    ORDER BY p.created_at DESC
  `;
  return Response.json({ passes: rows });
}

export async function POST(request) {
  try {
    const session = await auth(request);
    if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (session.user.role !== "passenger") {
      return Response.json({ error: "Only passengers can create a TukTukPass" }, { status: 403 });
    }
    const body = await request.json();
    const pickup = readCoordinate(body.pickup);
    const dropoff = readCoordinate(body.dropoff);
    const scheduledDays = readDays(body.scheduledDays);
    const scheduledTime = readTime(body.scheduledTime);
    const durationType = body.durationType === "WEEKLY" ? "WEEKLY" : body.durationType === "MONTHLY" ? "MONTHLY" : null;
    const startDate = /^\d{4}-\d{2}-\d{2}$/.test(body.startDate || "") ? body.startDate : new Date().toISOString().slice(0, 10);
    if (!pickup || !dropoff || !scheduledDays || !scheduledTime || !durationType) {
      return Response.json(
        { error: "Valid route, days, time, and duration are required", code: "INVALID_PASS_INPUT" },
        { status: 400 },
      );
    }
    const endDate = addDays(startDate, durationType === "WEEKLY" ? 6 : 29);
    const rideCount = countScheduledRides(startDate, endDate, scheduledDays);
    if (rideCount < 1) {
      return Response.json({ error: "Schedule does not contain any rides", code: "EMPTY_PASS_SCHEDULE" }, { status: 400 });
    }
    const estimate = await getRouteEstimate(pickup.lat, pickup.lng, dropoff.lat, dropoff.lng);
    const fare = calculatePassFare({ estimatedFareRupees: estimate.estimatedFare, rideCount });
    const passRows = await sql`
      INSERT INTO commuter_passes (
        passenger_id, pickup_location, dropoff_location, pickup_label, dropoff_label,
        scheduled_days, scheduled_time, duration_type, agreed_fare_paise,
        platform_fee_paise, driver_payout_paise, start_date, end_date
      ) VALUES (
        ${session.user.id},
        ST_SetSRID(ST_MakePoint(${pickup.lng}, ${pickup.lat}), 4326)::geography,
        ST_SetSRID(ST_MakePoint(${dropoff.lng}, ${dropoff.lat}), 4326)::geography,
        ${pickup.label}, ${dropoff.label}, ${scheduledDays}::text[], ${scheduledTime}::time,
        ${durationType}, ${fare.agreedFarePaise}, ${fare.platformFeePaise},
        ${fare.driverPayoutPaise}, ${startDate}::date, ${endDate}::date
      ) RETURNING *
    `;
    const pass = passRows[0];
    let order = null;
    if (isRazorpayConfigured()) {
      order = await createOrder({
        amountPaise: pass.agreed_fare_paise,
        receipt: `pass_${pass.id}`,
        notes: { pass_id: pass.id, passenger_id: session.user.id },
      });
      await sql`
        UPDATE commuter_passes SET razorpay_order_id = ${order.id}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${pass.id}
      `;
    }
    const overlapRows = await sql`
      SELECT count(*)::int AS count
      FROM commuter_passes existing
      WHERE existing.id <> ${pass.id}
        AND existing.status = 'ACTIVE'
        AND ST_DWithin(existing.pickup_location, ST_SetSRID(ST_MakePoint(${pickup.lng}, ${pickup.lat}), 4326)::geography, 400)
        AND ST_DWithin(existing.dropoff_location, ST_SetSRID(ST_MakePoint(${dropoff.lng}, ${dropoff.lat}), 4326)::geography, 400)
        AND existing.scheduled_days && ${scheduledDays}::text[]
        AND abs(extract(epoch FROM (existing.scheduled_time - ${scheduledTime}::time))) < 900
    `;
    return Response.json(
      {
        pass: { ...pass, razorpay_order_id: order?.id || null },
        order,
        fare: { ...fare, rideCount },
        sharedRouteOpportunity: Number(overlapRows[0]?.count || 0) > 0,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/passes error:", error);
    return phase2Error(error, "Could not create TukTukPass");
  }
}
