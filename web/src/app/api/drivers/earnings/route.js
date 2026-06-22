import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

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

    const [totals, recentRides] = await Promise.all([
      sql`
        SELECT
          COALESCE(SUM(COALESCE(final_fare, estimated_fare)) FILTER (WHERE completed_at >= CURRENT_DATE), 0) AS today,
          COALESCE(SUM(COALESCE(final_fare, estimated_fare)) FILTER (WHERE completed_at >= CURRENT_DATE - INTERVAL '6 days'), 0) AS week,
          COALESCE(SUM(COALESCE(final_fare, estimated_fare)) FILTER (WHERE completed_at >= CURRENT_DATE - INTERVAL '29 days'), 0) AS month
        FROM rides
        WHERE driver_id = ${driverId}
          AND status = 'completed'
      `,
      sql`
        SELECT id, pickup_address, dest_address, COALESCE(final_fare, estimated_fare) AS fare, completed_at
        FROM rides
        WHERE driver_id = ${driverId}
          AND status = 'completed'
        ORDER BY completed_at DESC NULLS LAST, created_at DESC
        LIMIT 5
      `,
    ]);

    return Response.json({
      today: toNumber(totals[0]?.today),
      week: toNumber(totals[0]?.week),
      month: toNumber(totals[0]?.month),
      recentRides: recentRides.map((ride) => ({
        ...ride,
        fare: toNumber(ride.fare),
      })),
    });
  } catch (err) {
    console.error("GET /api/drivers/earnings error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
