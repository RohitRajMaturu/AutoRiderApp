import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

function readPageSize(value) {
  const pageSize = Number(value);
  if (!Number.isInteger(pageSize)) return 10;
  return Math.min(Math.max(pageSize, 5), 25);
}

function readOffset(value) {
  const offset = Number(value);
  return Number.isInteger(offset) && offset > 0 ? offset : 0;
}

function toNumber(value) {
  const next = Number(value);
  return Number.isFinite(next) ? next : 0;
}

export async function GET(request) {
  try {
    const session = await auth(request);
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const pageSize = readPageSize(url.searchParams.get("pageSize"));
    const offset = readOffset(url.searchParams.get("offset"));

    const driverRows = await sql`
      SELECT id
      FROM drivers
      WHERE user_id = ${session.user.id}
      LIMIT 1
    `;
    const driverId = driverRows[0]?.id;
    if (!driverId) {
      return Response.json({ error: "Driver profile not found" }, { status: 404 });
    }

    const rows = await sql`
      SELECT
        id,
        pickup_address,
        dest_address,
        distance_km,
        COALESCE(final_fare, estimated_fare) AS fare,
        completed_at,
        created_at
      FROM rides
      WHERE driver_id = ${driverId}
        AND status = 'completed'
      ORDER BY completed_at DESC NULLS LAST, created_at DESC
      LIMIT ${pageSize + 1}
      OFFSET ${offset}
    `;
    const pageRows = rows.slice(0, pageSize);

    return Response.json({
      rides: pageRows.map((ride) => ({
        ...ride,
        distance_km: toNumber(ride.distance_km),
        fare: toNumber(ride.fare),
      })),
      nextOffset: rows.length > pageSize ? offset + pageSize : null,
      pageSize,
    });
  } catch (err) {
    console.error("GET /api/drivers/rides error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
