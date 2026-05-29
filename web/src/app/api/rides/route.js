import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

export async function POST(request) {
  try {
    const session = await auth();
    if (!session || !session.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {
      pickup_lat,
      pickup_lng,
      dest_lat,
      dest_lng,
      pickup_address,
      dest_address,
    } = await request.json();

    // Check if user already has an active ride
    const active = await sql`
      SELECT id FROM rides 
      WHERE passenger_id = ${session.user.id} 
      AND status IN ('requested', 'accepted') 
      LIMIT 1
    `;
    if (active.length > 0) {
      return Response.json(
        { error: "You already have an active ride request" },
        { status: 400 },
      );
    }

    const rows = await sql`
      INSERT INTO rides (passenger_id, pickup_lat, pickup_lng, dest_lat, dest_lng, pickup_address, dest_address)
      VALUES (${session.user.id}, ${pickup_lat}, ${pickup_lng}, ${dest_lat}, ${dest_lng}, ${pickup_address}, ${dest_address})
      RETURNING *
    `;

    return Response.json({ ride: rows[0] });
  } catch (err) {
    console.error("POST /api/rides error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const session = await auth();
    if (!session || !session.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Determine if we're fetching as passenger or driver
    const userRows =
      await sql`SELECT role FROM auth_users WHERE id = ${session.user.id} LIMIT 1`;
    const role = userRows[0]?.role;

    let rides;
    if (role === "driver") {
      const driverRows =
        await sql`SELECT id FROM drivers WHERE user_id = ${session.user.id} LIMIT 1`;
      const driverId = driverRows[0]?.id;
      rides = await sql`
        SELECT r.*, u.phone as passenger_phone
        FROM rides r
        JOIN auth_users u ON r.passenger_id = u.id
        WHERE r.driver_id = ${driverId} OR (r.status = 'requested' AND r.driver_id IS NULL)
        ORDER BY r.created_at DESC
      `;
    } else {
      rides = await sql`
        SELECT r.*, d.vehicle_number, d.auto_photo_url, u.phone as driver_phone
        FROM rides r
        LEFT JOIN drivers d ON r.driver_id = d.id
        LEFT JOIN auth_users u ON d.user_id = u.id
        WHERE r.passenger_id = ${session.user.id}
        ORDER BY r.created_at DESC
      `;
    }

    return Response.json({ rides });
  } catch (err) {
    console.error("GET /api/rides error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
