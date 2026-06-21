import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

export async function GET(request) {
  try {
    const session = await auth(request);
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const driverRows = await sql`
      UPDATE drivers
      SET last_heartbeat_at = CURRENT_TIMESTAMP,
          location = CASE
            WHEN last_lat IS NOT NULL AND last_lng IS NOT NULL
            THEN ST_SetSRID(ST_MakePoint(last_lng, last_lat), 4326)::geography
            ELSE location
          END,
          updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ${session.user.id}
        AND is_online = true
        AND is_approved = true
        AND subscription_expiry > CURRENT_TIMESTAMP
      RETURNING id
    `;
    const driverId = driverRows[0]?.id;
    if (!driverId) {
      return Response.json({ rides: [] });
    }

    const rides = await sql`
      SELECT r.*, u.phone as passenger_phone, n.created_at as dispatched_at
      FROM ride_driver_notifications n
      JOIN rides r ON r.id = n.ride_id
      JOIN auth_users u ON u.id = r.passenger_id
      WHERE n.driver_id = ${driverId}
        AND n.channel = 'websocket'
        AND n.status IN ('pending', 'failed')
        AND r.status = 'requested'
        AND r.driver_id IS NULL
      ORDER BY n.created_at ASC
    `;

    return Response.json({ rides });
  } catch (err) {
    console.error("GET /api/drivers/pending-requests error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
