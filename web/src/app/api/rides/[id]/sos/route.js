import crypto from "node:crypto";
import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

function fast2smsNumber(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits.startsWith("91") && digits.length === 12 ? digits.slice(2) : digits;
}

async function sendSafetySms(phone, message) {
  const apiKey = process.env.FAST2SMS_API_KEY?.trim();
  const number = fast2smsNumber(phone);
  if (!apiKey) throw new Error("FAST2SMS_API_KEY is missing");
  if (!/^[6-9]\d{9}$/.test(number)) {
    throw new Error("Emergency contact must be a valid Indian mobile number");
  }
  const body = new URLSearchParams({
    route: process.env.FAST2SMS_ROUTE || "q",
    message,
    language: process.env.FAST2SMS_LANGUAGE || "english",
    numbers: number,
  });
  const response = await fetch("https://www.fast2sms.com/dev/bulkV2", {
    method: "POST",
    headers: {
      authorization: apiKey,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!response.ok) {
    const result = await response.text();
    throw new Error(result || `Fast2SMS rejected request with ${response.status}`);
  }
}

export async function POST(request, { params }) {
  try {
    const session = await auth(request);
    if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const rides = await sql`
      SELECT r.id, r.status, r.passenger_id, u.name, u.emergency_contact_phone
      FROM rides r
      JOIN auth_users u ON u.id = r.passenger_id
      WHERE r.id = ${params.id} AND r.passenger_id = ${session.user.id}
      LIMIT 1
    `;
    const ride = rides[0];
    if (!ride) return Response.json({ error: "Ride not found" }, { status: 404 });
    if (ride.status !== "accepted") {
      return Response.json({ error: "SOS tracking is only available during an accepted ride" }, { status: 409 });
    }
    if (!ride.emergency_contact_phone) {
      return Response.json({ error: "Add an emergency contact before starting SOS", code: "EMERGENCY_CONTACT_REQUIRED" }, { status: 400 });
    }

    const token = crypto.randomBytes(32).toString("hex");
    await sql.transaction(async (tx) => {
      await tx`
        UPDATE sos_tracking_tokens SET revoked_at = CURRENT_TIMESTAMP
        WHERE ride_id = ${ride.id} AND revoked_at IS NULL
      `;
      await tx`
        INSERT INTO sos_tracking_tokens (ride_id, passenger_id, token, expires_at)
        VALUES (${ride.id}, ${ride.passenger_id}, ${token}, CURRENT_TIMESTAMP + INTERVAL '4 hours')
      `;
    });

    const baseUrl = (process.env.AUTH_URL || process.env.NEXTAUTH_URL || new URL(request.url).origin).replace(/\/$/, "");
    const trackingUrl = `${baseUrl}/track/${token}`;
    const message = `SAFETY ALERT from TukTukGo: ${ride.name || "A passenger"} has shared their live ride with you. Track their trip here: ${trackingUrl} — Link expires when the ride ends.`;
    try {
      await sendSafetySms(ride.emergency_contact_phone, message);
    } catch (error) {
      await sql`UPDATE sos_tracking_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE token = ${token}`;
      console.error("SOS Fast2SMS error:", error);
      return Response.json({ error: "Could not send the safety SMS" }, { status: 502 });
    }
    return Response.json({ ok: true, trackingUrl });
  } catch (err) {
    console.error("POST /api/rides/[id]/sos error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const session = await auth(request);
    if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const rides = await sql`
      SELECT id FROM rides WHERE id = ${params.id} AND passenger_id = ${session.user.id} LIMIT 1
    `;
    if (!rides[0]) return Response.json({ error: "Ride not found" }, { status: 404 });
    await sql`
      UPDATE sos_tracking_tokens SET revoked_at = CURRENT_TIMESTAMP
      WHERE ride_id = ${params.id} AND passenger_id = ${session.user.id} AND revoked_at IS NULL
    `;
    return Response.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/rides/[id]/sos error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
