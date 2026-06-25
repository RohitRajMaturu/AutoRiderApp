import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";
import { authorizeRideChannel } from "@/lib/pusher/server";

function parseRideId(channelName) {
  const match = /^private-ride-([0-9a-f-]{36})$/i.exec(channelName || "");
  return match?.[1] || null;
}

export async function POST(request) {
  try {
    const session = await auth(request);
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.text();
    const params = new URLSearchParams(body);
    const socketId = params.get("socket_id");
    const channelName = params.get("channel_name");
    const rideId = parseRideId(channelName);

    if (!socketId || !rideId) {
      return Response.json({ error: "Invalid Pusher auth request" }, { status: 400 });
    }

    const authorized = await sql`
      SELECT r.id
      FROM rides r
      LEFT JOIN drivers d ON d.user_id = ${session.user.id}
      WHERE r.id = ${rideId}
        AND (
          r.passenger_id = ${session.user.id}
          OR EXISTS (
            SELECT 1
            FROM ride_driver_notifications n
            WHERE n.ride_id = r.id
              AND n.driver_id = d.id
              AND n.status IN ('pending', 'sent')
          )
          OR r.driver_id = d.id
        )
      LIMIT 1
    `;
    if (authorized.length === 0) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const authPayload = authorizeRideChannel(socketId, channelName);
    if (!authPayload) {
      return Response.json({ error: "Pusher is not configured" }, { status: 503 });
    }

    return Response.json(authPayload);
  } catch (err) {
    console.error("POST /api/pusher/auth error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
