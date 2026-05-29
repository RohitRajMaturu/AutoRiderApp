import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

export async function POST(request) {
  try {
    const session = await auth();
    if (!session || !session.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { vehicle_number, auto_photo_url, license_url } =
      await request.json();

    const existing =
      await sql`SELECT id FROM drivers WHERE user_id = ${session.user.id} LIMIT 1`;
    if (existing.length > 0) {
      return Response.json(
        { error: "Already registered as a driver" },
        { status: 400 },
      );
    }

    const rows = await sql`
      INSERT INTO drivers (user_id, vehicle_number, auto_photo_url, license_url)
      VALUES (${session.user.id}, ${vehicle_number}, ${auto_photo_url}, ${license_url})
      RETURNING *
    `;

    // Ensure role is set to driver if not already
    await sql`UPDATE auth_users SET role = 'driver' WHERE id = ${session.user.id}`;

    return Response.json({ driver: rows[0] });
  } catch (err) {
    console.error("POST /api/drivers error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const session = await auth();
    if (!session || !session.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rows = await sql`
      SELECT * FROM drivers 
      WHERE user_id = ${session.user.id} 
      LIMIT 1
    `;

    return Response.json({ driver: rows[0] || null });
  } catch (err) {
    console.error("GET /api/drivers/me error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
