import { auth } from "@/auth";
import sql from "@/app/api/utils/sql";

export async function GET(request) {
  const session = await auth(request);
  if (!session?.user?.id)
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  const adminCheck =
    await sql`SELECT role FROM auth_users WHERE id = ${session.user.id}`;
  if (!adminCheck[0] || adminCheck[0].role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const [
    totalRides,
    completedRides,
    cancelledRides,
    requestedRides,
    activeDrivers,
    totalDrivers,
    pendingDrivers,
    todayRides,
    todayCompleted,
    totalFare,
    todayFare,
    cancellationReasons,
    hourlyTimeline,
    weeklyTimeline,
  ] = await Promise.all([
    sql`SELECT COUNT(*) as count FROM rides`,
    sql`SELECT COUNT(*) as count FROM rides WHERE status = 'completed'`,
    sql`SELECT COUNT(*) as count FROM rides WHERE status = 'cancelled'`,
    sql`SELECT COUNT(*) as count FROM rides WHERE status IN ('requested', 'accepted')`,
    sql`SELECT COUNT(*) as count FROM drivers WHERE is_online = true AND is_approved = true`,
    sql`SELECT COUNT(*) as count FROM drivers WHERE is_approved = true`,
    sql`SELECT COUNT(*) as count FROM drivers WHERE is_approved = false`,
    sql`SELECT COUNT(*) as count FROM rides WHERE created_at >= CURRENT_DATE`,
    sql`SELECT COUNT(*) as count FROM rides WHERE status = 'completed' AND completed_at >= CURRENT_DATE`,
    sql`SELECT COALESCE(SUM(estimated_fare), 0) as total FROM rides WHERE status = 'completed'`,
    sql`SELECT COALESCE(SUM(estimated_fare), 0) as total FROM rides WHERE status = 'completed' AND completed_at >= CURRENT_DATE`,
    sql`
      SELECT cancellation_reason, COUNT(*) as count
      FROM rides
      WHERE status = 'cancelled' AND cancellation_reason IS NOT NULL
      GROUP BY cancellation_reason
      ORDER BY count DESC
      LIMIT 5
    `,
    sql`
      SELECT date_trunc('hour', created_at) AT TIME ZONE 'Asia/Kolkata' as hour,
        COUNT(*) as rides,
        COALESCE(SUM(estimated_fare), 0) as fare
      FROM rides
      WHERE created_at >= CURRENT_DATE
      GROUP BY 1
      ORDER BY 1
    `,
    sql`
      SELECT date_trunc('day', created_at) AT TIME ZONE 'Asia/Kolkata' as day,
        COUNT(*) as rides,
        COALESCE(SUM(estimated_fare), 0) as fare
      FROM rides
      WHERE created_at >= CURRENT_DATE - INTERVAL '6 days'
      GROUP BY 1
      ORDER BY 1
    `,
  ]);

  return Response.json({
    stats: {
      totalRides: parseInt(totalRides[0]?.count || 0),
      completedRides: parseInt(completedRides[0]?.count || 0),
      cancelledRides: parseInt(cancelledRides[0]?.count || 0),
      activeRides: parseInt(requestedRides[0]?.count || 0),
      activeDrivers: parseInt(activeDrivers[0]?.count || 0),
      totalDrivers: parseInt(totalDrivers[0]?.count || 0),
      pendingDrivers: parseInt(pendingDrivers[0]?.count || 0),
      todayRides: parseInt(todayRides[0]?.count || 0),
      todayCompleted: parseInt(todayCompleted[0]?.count || 0),
      totalFareValue: Number(totalFare[0]?.total || 0),
      todayFareValue: Number(todayFare[0]?.total || 0),
      cancellationReasons: cancellationReasons.map((row) => ({
        cancellation_reason: row.cancellation_reason,
        count: parseInt(row.count || 0),
      })),
      hourlyTimeline: hourlyTimeline.map((row) => ({
        hour: row.hour,
        rides: parseInt(row.rides || 0),
        fare: Number(row.fare || 0),
      })),
      weeklyTimeline: weeklyTimeline.map((row) => ({
        day: row.day,
        rides: parseInt(row.rides || 0),
        fare: Number(row.fare || 0),
      })),
    },
  });
}
