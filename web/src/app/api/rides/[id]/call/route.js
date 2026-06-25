import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";
import { initiateMaskedCall, isExotelConfigured } from "@/app/api/utils/exotelService";
import { writeOperationalEvent } from "@/app/api/utils/observability";

const CALLABLE_STATUSES = new Set(["accepted", "in_progress"]);
const MAX_CALL_ATTEMPTS_PER_DIRECTION = 3;

export async function POST(request, { params }) {
  try {
    const session = await auth(request);
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isExotelConfigured()) {
      return Response.json(
        { error: "Masked calling is not configured yet", code: "CALL_PROVIDER_NOT_CONFIGURED" },
        { status: 503 },
      );
    }

    const rideRows = await sql`
      SELECT
        r.id,
        r.status,
        r.passenger_id,
        d.id AS driver_id,
        d.user_id AS driver_user_id,
        pu.phone AS passenger_phone,
        du.phone AS driver_phone
      FROM rides r
      LEFT JOIN drivers d ON r.driver_id = d.id
      LEFT JOIN auth_users pu ON pu.id = r.passenger_id
      LEFT JOIN auth_users du ON du.id = d.user_id
      WHERE r.id = ${params.id}
      LIMIT 1
    `;
    const ride = rideRows[0];
    if (!ride) {
      return Response.json({ error: "Ride not found" }, { status: 404 });
    }

    const isPassenger = ride.passenger_id === session.user.id;
    const isDriver = ride.driver_user_id === session.user.id;
    if (!isPassenger && !isDriver) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!CALLABLE_STATUSES.has(ride.status) || !ride.driver_id) {
      return Response.json(
        { error: "Calls are available only after a ride is accepted", code: "RIDE_NOT_CALLABLE" },
        { status: 409 },
      );
    }
    if (!ride.passenger_phone || !ride.driver_phone) {
      return Response.json(
        { error: "Call cannot be connected for this ride", code: "CALL_PARTY_MISSING" },
        { status: 409 },
      );
    }

    const direction = isPassenger ? "passenger_to_driver" : "driver_to_passenger";
    const attempts = await sql`
      SELECT count(*)::int AS count
      FROM ride_call_logs
      WHERE ride_id = ${ride.id}
        AND direction = ${direction}
    `;
    if ((attempts[0]?.count || 0) >= MAX_CALL_ATTEMPTS_PER_DIRECTION) {
      return Response.json(
        { error: "Call attempt limit reached for this ride", code: "CALL_RATE_LIMITED" },
        { status: 429 },
      );
    }

    const result = await initiateMaskedCall(
      ride.passenger_phone,
      ride.driver_phone,
      ride.id,
      direction,
    );
    if (result.error || !result.callSid) {
      await writeOperationalEvent({
        eventType: "masked_call_failed",
        actorId: session.user.id,
        targetType: "ride",
        targetId: ride.id,
        severity: "warn",
        metadata: { code: result.code || "CALL_FAILED", direction },
      });
      return Response.json(
        { error: "Call failed. Try again.", code: result.code || "CALL_FAILED" },
        { status: result.code === "EXOTEL_NOT_CONFIGURED" ? 503 : 502 },
      );
    }

    await sql`
      INSERT INTO ride_call_logs (ride_id, call_sid, status, direction)
      VALUES (${ride.id}, ${result.callSid}, ${result.status || "initiated"}, ${direction})
    `;
    await writeOperationalEvent({
      eventType: "masked_call_initiated",
      actorId: session.user.id,
      targetType: "ride",
      targetId: ride.id,
      metadata: { direction, status: result.status || "initiated" },
    });

    return Response.json({ success: true, message: "Connecting call..." });
  } catch (err) {
    console.error("POST /api/rides/[id]/call error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
