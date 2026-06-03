import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

function readString(value) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request) {
  try {
    const session = await auth(request);
    if (!session || !session.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { vehicle_number, auto_photo_url, license_url } =
      await request.json();
    const vehicleNumber = readString(vehicle_number).toUpperCase();
    const autoPhotoUrl = readString(auto_photo_url) || null;
    const licenseUrl = readString(license_url);

    if (!vehicleNumber || vehicleNumber.length > 32 || !licenseUrl) {
      return Response.json(
        { error: "Vehicle number and license document URL are required" },
        { status: 400 },
      );
    }

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
      VALUES (${session.user.id}, ${vehicleNumber}, ${autoPhotoUrl}, ${licenseUrl})
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

export async function GET(request) {
  try {
    const session = await auth(request);
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
