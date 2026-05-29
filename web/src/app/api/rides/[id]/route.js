import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

export async function PATCH(request, { params }) {
  try {
    const session = await auth();
    if (!session || !session.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const { action } = await request.json(); // 'accept', 'cancel', 'complete'

    const driverRows =
      await sql`SELECT id FROM drivers WHERE user_id = ${session.user.id} LIMIT 1`;
    const driverId = driverRows[0]?.id;

    if (action === "accept") {
      if (!driverId)
        return Response.json(
          { error: "Only drivers can accept rides" },
          { status: 403 },
        );

      // First accepted driver wins
      const result = await sql`
        UPDATE rides 
        SET driver_id = ${driverId}, 
            status = 'accepted',
            accepted_at = CURRENT_TIMESTAMP
        WHERE id = ${id} AND status = 'requested' AND driver_id IS NULL
        RETURNING *
      `;

      if (result.length === 0) {
        return Response.json(
          { error: "Ride already accepted by another driver or cancelled" },
          { status: 400 },
        );
      }
      return Response.json({ ride: result[0] });
    }

    if (action === "complete") {
      const result = await sql`
        UPDATE rides 
        SET status = 'completed',
            completed_at = CURRENT_TIMESTAMP
        WHERE id = ${id} AND driver_id = ${driverId} AND status = 'accepted'
        RETURNING *
      `;
      return Response.json({ ride: result[0] });
    }

    if (action === "cancel") {
      // Both passenger and driver can cancel requested/accepted rides
      const result = await sql`
        UPDATE rides 
        SET status = 'cancelled'
        WHERE id = ${id} 
        AND (passenger_id = ${session.user.id} OR driver_id = ${driverId})
        AND status IN ('requested', 'accepted')
        RETURNING *
      `;
      return Response.json({ ride: result[0] });
    }

    return Response.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    console.error("PATCH /api/rides/[id] error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function GET(request, { params }) {
  try {
    const { id } = params;
    const rows = await sql`
      SELECT r.*, d.vehicle_number, d.auto_photo_url, du.phone as driver_phone, pu.phone as passenger_phone
      FROM rides r
      LEFT JOIN drivers d ON r.driver_id = d.id
      LEFT JOIN auth_users du ON d.user_id = du.id
      JOIN auth_users pu ON r.passenger_id = pu.id
      WHERE r.id = ${id}
      LIMIT 1
    `;
    return Response.json({ ride: rows[0] || null });
  } catch (err) {
    console.error("GET /api/rides/[id] error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
