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
          COUNT(*) FILTER (
            WHERE completed_at >= date_trunc('day', NOW() AT TIME ZONE 'Asia/Kolkata')
              AT TIME ZONE 'Asia/Kolkata'
              AND status = 'completed'
          )::int AS rides_today,
          COALESCE(SUM(COALESCE(final_fare, estimated_fare)) FILTER (
            WHERE completed_at >= date_trunc('day', NOW() AT TIME ZONE 'Asia/Kolkata')
              AT TIME ZONE 'Asia/Kolkata'
          ), 0) AS today,
          COALESCE(SUM(COALESCE(final_fare, estimated_fare)) FILTER (
            WHERE completed_at >= (
              date_trunc('day', NOW() AT TIME ZONE 'Asia/Kolkata') - INTERVAL '6 days'
            ) AT TIME ZONE 'Asia/Kolkata'
          ), 0) AS week,
          COALESCE(SUM(COALESCE(final_fare, estimated_fare)) FILTER (
            WHERE completed_at >= (
              date_trunc('day', NOW() AT TIME ZONE 'Asia/Kolkata') - INTERVAL '29 days'
            ) AT TIME ZONE 'Asia/Kolkata'
          ), 0) AS month
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
      ridesToday: Number(totals[0]?.rides_today ?? 0),
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
