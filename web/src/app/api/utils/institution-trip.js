import crypto from "node:crypto";
import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";
import { sendWhatsAppWithSmsFallback } from "@/app/api/utils/notifications/phase2Messaging";

export async function authorizeTripAction(request, tx, tripId) {
  const session = await auth(request);
  if (!session?.user?.id) {
    const error = new Error("Unauthorized");
    error.status = 401;
    throw error;
  }
  const rows = await tx`SELECT t.*,d.user_id AS assigned_driver_user_id,
    EXISTS(SELECT 1 FROM institution_admin_users ia WHERE ia.institution_id=t.institution_id AND ia.user_id=${session.user.id}) AS institution_access
    FROM institution_trips t LEFT JOIN drivers d ON d.id=COALESCE(t.reassigned_driver_id,t.driver_id)
    WHERE t.id=${tripId} FOR UPDATE OF t`;
  const trip = rows[0];
  if (!trip) {
    const error = new Error("Trip not found");
    error.status = 404;
    throw error;
  }
  if (
    session.user.role !== "admin" &&
    !trip.institution_access &&
    trip.assigned_driver_user_id !== session.user.id
  ) {
    const error = new Error("Trip access denied");
    error.status = 403;
    throw error;
  }
  return {
    session,
    trip,
    isDriver: trip.assigned_driver_user_id === session.user.id,
  };
}

export async function createTrackingTokens(tx, trip) {
  const members =
    await tx`SELECT id,member_name,guardian_phone FROM institution_members
    WHERE id=ANY(${trip.members_expected}::uuid[]) AND active=true AND sms_opted_out=false`;
  for (const member of members) {
    await tx`INSERT INTO member_tracking_tokens(trip_id,member_id,token,guardian_phone,expires_at)
    VALUES(${trip.id},${member.id},${crypto.randomBytes(32).toString("hex")},${member.guardian_phone},CURRENT_TIMESTAMP+INTERVAL '12 hours')
    ON CONFLICT(trip_id,member_id) DO UPDATE SET token=EXCLUDED.token,expires_at=EXCLUDED.expires_at,revoked_at=NULL`;
  }
  return members.length;
}

export async function notifyTripStart(tripId, origin) {
  const rows =
    await sql`SELECT token.id,token.token,token.guardian_phone,m.member_name,u.name AS driver_name,d.vehicle_number
    FROM member_tracking_tokens token JOIN institution_members m ON m.id=token.member_id
    JOIN institution_trips t ON t.id=token.trip_id LEFT JOIN drivers d ON d.id=COALESCE(t.reassigned_driver_id,t.driver_id)
    LEFT JOIN auth_users u ON u.id=d.user_id WHERE token.trip_id=${tripId} AND token.revoked_at IS NULL`;
  await Promise.all(
    rows.map(async (row) => {
      const url = `${origin}/track/member/${row.token}`;
      const result = await sendWhatsAppWithSmsFallback({
        phone: row.guardian_phone,
        templateName: "SCHOOL_TRIP_START",
        params: [
          row.driver_name || "Driver",
          row.member_name,
          url,
          row.vehicle_number || "",
        ],
        smsMessage: `${row.driver_name || "Your driver"} has started. Track ${row.member_name}: ${url}. Vehicle: ${row.vehicle_number || "assigned"}.`,
        referenceId: row.id,
        targetType: "member_tracking_token",
      });
      await sql`UPDATE member_tracking_tokens SET whatsapp_sent_at=CASE WHEN ${result.channel}='whatsapp' THEN CURRENT_TIMESTAMP ELSE whatsapp_sent_at END,
      sms_sent_at=CASE WHEN ${result.channel}='sms' THEN CURRENT_TIMESTAMP ELSE sms_sent_at END WHERE id=${row.id}`;
    }),
  );
}

export async function notifyPickup(tripId, memberId, origin) {
  const rows =
    await sql`SELECT token.id,token.token,token.guardian_phone,m.member_name FROM member_tracking_tokens token
    JOIN institution_members m ON m.id=token.member_id WHERE token.trip_id=${tripId} AND token.member_id=${memberId} LIMIT 1`;
  const row = rows[0];
  if (!row) return;
  const url = `${origin}/track/member/${row.token}`;
  await sendWhatsAppWithSmsFallback({
    phone: row.guardian_phone,
    templateName: "SCHOOL_PICKUP_CONFIRM",
    params: [row.member_name, url],
    smsMessage: `${row.member_name} has been picked up. Track the trip: ${url}`,
    referenceId: row.id,
    targetType: "member_tracking_token",
  });
}

export async function notifyTripCancellation(tripId) {
  const members =
    await sql`SELECT m.id,m.member_name,m.guardian_phone FROM institution_trips t JOIN institution_members m
    ON m.id=ANY(t.members_expected) WHERE t.id=${tripId} AND m.sms_opted_out=false`;
  await Promise.all(
    members.map((m) =>
      sendWhatsAppWithSmsFallback({
        phone: m.guardian_phone,
        templateName: "SCHOOL_ROUTE_CANCELLED",
        params: [m.member_name],
        smsMessage: `Today's TukTukSafe service for ${m.member_name} is cancelled. Please arrange transport.`,
        referenceId: m.id,
        targetType: "institution_member",
      }),
    ),
  );
}
