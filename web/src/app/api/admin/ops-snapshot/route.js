import { auth } from "@/auth";
import sql from "@/app/api/utils/sql";
import { requireAdmin } from "@/app/api/utils/admin";

function toInt(value) {
  return parseInt(value || 0, 10);
}

function toNumber(value) {
  return Number(value || 0);
}

export async function GET(request) {
  try {
    const admin = await requireAdmin(request, auth);
    if (admin.response) return admin.response;

    const [
      liveRidesRows,
      acceptedRidesRows,
      requestedRidesRows,
      onlineDriversRows,
      idleDriversRows,
      todayFareRows,
      todayCompletedRows,
      todayCancelledRows,
      weeklyTimelineRows,
      hourlyTodayRows,
      zoneActivityRows,
      cancellationRows,
      funnelRows,
      auditRows,
      staleDriverRows,
    ] = await Promise.all([
      sql`SELECT COUNT(*) as count FROM rides WHERE status IN ('requested', 'accepted')`,
      sql`SELECT COUNT(*) as count FROM rides WHERE status = 'accepted'`,
      sql`SELECT COUNT(*) as count FROM rides WHERE status = 'requested'`,
      sql`SELECT COUNT(*) as count FROM drivers WHERE is_online = true AND is_approved = true`,
      sql`
        SELECT COUNT(*) as count
        FROM drivers d
        WHERE d.is_online = true
          AND d.is_approved = true
          AND NOT EXISTS (
            SELECT 1
            FROM rides r
            WHERE r.driver_id = d.id AND r.status = 'accepted'
          )
      `,
      sql`
        SELECT COALESCE(SUM(COALESCE(final_fare, estimated_fare)), 0) as total
        FROM rides
        WHERE status = 'completed'
          AND completed_at >= date_trunc('day', NOW() AT TIME ZONE 'Asia/Kolkata')
            AT TIME ZONE 'Asia/Kolkata'
      `,
      sql`
        SELECT COUNT(*) as count
        FROM rides
        WHERE status = 'completed'
          AND completed_at >= date_trunc('day', NOW() AT TIME ZONE 'Asia/Kolkata')
            AT TIME ZONE 'Asia/Kolkata'
      `,
      sql`
        SELECT COUNT(*) as count
        FROM rides
        WHERE status = 'cancelled'
          AND cancelled_at >= date_trunc('day', NOW() AT TIME ZONE 'Asia/Kolkata')
            AT TIME ZONE 'Asia/Kolkata'
      `,
      sql`
        WITH created AS (
          SELECT
            to_char(created_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') as day,
            COUNT(*) as total
          FROM rides
          WHERE created_at >= (
            date_trunc('day', NOW() AT TIME ZONE 'Asia/Kolkata') - INTERVAL '6 days'
          ) AT TIME ZONE 'Asia/Kolkata'
          GROUP BY 1
        ),
        completed AS (
          SELECT
            to_char(completed_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') as day,
            COUNT(*) as completed,
            SUM(COALESCE(final_fare, estimated_fare)) as fare
          FROM rides
          WHERE status = 'completed'
            AND completed_at >= (
              date_trunc('day', NOW() AT TIME ZONE 'Asia/Kolkata') - INTERVAL '6 days'
            ) AT TIME ZONE 'Asia/Kolkata'
          GROUP BY 1
        ),
        cancelled AS (
          SELECT
            to_char(cancelled_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') as day,
            COUNT(*) as cancelled
          FROM rides
          WHERE status = 'cancelled'
            AND cancelled_at >= (
              date_trunc('day', NOW() AT TIME ZONE 'Asia/Kolkata') - INTERVAL '6 days'
            ) AT TIME ZONE 'Asia/Kolkata'
          GROUP BY 1
        ),
        days AS (
          SELECT day FROM created
          UNION
          SELECT day FROM completed
          UNION
          SELECT day FROM cancelled
        )
        SELECT
          days.day,
          COALESCE(completed.completed, 0) as completed,
          COALESCE(cancelled.cancelled, 0) as cancelled,
          COALESCE(created.total, 0) as total,
          COALESCE(completed.fare, 0) as fare
        FROM days
        LEFT JOIN created USING (day)
        LEFT JOIN completed USING (day)
        LEFT JOIN cancelled USING (day)
        ORDER BY days.day
      `,
      sql`
        WITH created AS (
          SELECT
            EXTRACT(HOUR FROM created_at AT TIME ZONE 'Asia/Kolkata')::integer as hour,
            COUNT(*) as total
          FROM rides
          WHERE created_at >= date_trunc('day', NOW() AT TIME ZONE 'Asia/Kolkata')
            AT TIME ZONE 'Asia/Kolkata'
          GROUP BY 1
        ),
        completed AS (
          SELECT
            EXTRACT(HOUR FROM completed_at AT TIME ZONE 'Asia/Kolkata')::integer as hour,
            COUNT(*) as completed,
            SUM(COALESCE(final_fare, estimated_fare)) as fare
          FROM rides
          WHERE status = 'completed'
            AND completed_at >= date_trunc('day', NOW() AT TIME ZONE 'Asia/Kolkata')
              AT TIME ZONE 'Asia/Kolkata'
          GROUP BY 1
        )
        SELECT
          COALESCE(created.hour, completed.hour) as hour,
          COALESCE(created.total, 0) as total,
          COALESCE(completed.completed, 0) as completed,
          COALESCE(completed.fare, 0) as fare
        FROM created
        FULL OUTER JOIN completed USING (hour)
        ORDER BY hour
      `,
      sql`
        SELECT
          gz.name as zone_name,
          gz.id as zone_id,
          gz.dispatch_enabled,
          gz.max_online_drivers,
          COUNT(DISTINCT r.id) FILTER (WHERE r.status IN ('requested', 'accepted')) as active_rides,
          COUNT(DISTINCT d.id) FILTER (WHERE d.is_online = true AND d.is_approved = true) as online_drivers
        FROM geo_zones gz
        LEFT JOIN rides r ON r.zone_id = gz.id
          AND r.created_at >= date_trunc('day', NOW() AT TIME ZONE 'Asia/Kolkata')
            AT TIME ZONE 'Asia/Kolkata'
        LEFT JOIN drivers d ON d.zone_id = gz.id
        WHERE gz.is_active = true
        GROUP BY gz.id, gz.name, gz.dispatch_enabled, gz.max_online_drivers
        ORDER BY active_rides DESC
      `,
      sql`
        SELECT
          COALESCE(cancellation_reason, 'unknown') as reason,
          COUNT(*) as count
        FROM rides
        WHERE status = 'cancelled'
          AND cancelled_at >= (
            date_trunc('day', NOW() AT TIME ZONE 'Asia/Kolkata') - INTERVAL '6 days'
          ) AT TIME ZONE 'Asia/Kolkata'
          AND cancellation_reason IS NOT NULL
        GROUP BY 1
        ORDER BY 2 DESC
        LIMIT 6
      `,
      sql`
        SELECT
          COUNT(*) as total_created,
          COUNT(*) FILTER (WHERE status != 'requested') as left_requested,
          COUNT(*) FILTER (WHERE status = 'completed') as completed,
          COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
          ROUND(AVG((to_jsonb(rides)->>'driver_rating')::numeric) FILTER (
            WHERE to_jsonb(rides)->>'driver_rating' IS NOT NULL
          ), 1) as avg_rating,
          ROUND(AVG(
            EXTRACT(EPOCH FROM (accepted_at - created_at)) / 60.0
          ) FILTER (WHERE accepted_at IS NOT NULL), 1) as avg_accept_minutes
        FROM rides
        WHERE created_at >= NOW() - INTERVAL '24 hours'
      `,
      sql`
        SELECT a.*, u.email, u.phone
        FROM admin_audit_log a
        JOIN auth_users u ON a.actor_id = u.id
        ORDER BY a.created_at DESC
        LIMIT 10
      `,
      sql`
        SELECT COUNT(*) as count
        FROM drivers
        WHERE is_online = true
          AND (
            last_heartbeat_at IS NULL
            OR last_heartbeat_at < NOW() - INTERVAL '90 seconds'
          )
      `,
    ]);

    const requestedRides = toInt(requestedRidesRows[0]?.count);
    const idleDrivers = toInt(idleDriversRows[0]?.count);
    const funnel = funnelRows[0] || {};

    return Response.json({
      liveRides: toInt(liveRidesRows[0]?.count),
      acceptedRides: toInt(acceptedRidesRows[0]?.count),
      requestedRides,
      onlineDrivers: toInt(onlineDriversRows[0]?.count),
      idleDrivers,
      demandSupplyGap: requestedRides - idleDrivers,
      todayFare: toNumber(todayFareRows[0]?.total),
      todayCompletedRides: toInt(todayCompletedRows[0]?.count),
      todayCancelledRides: toInt(todayCancelledRows[0]?.count),
      weeklyTimeline: weeklyTimelineRows.map((row) => ({
        day: row.day,
        completed: toInt(row.completed),
        cancelled: toInt(row.cancelled),
        total: toInt(row.total),
        fare: toNumber(row.fare),
      })),
      hourlyToday: hourlyTodayRows.map((row) => ({
        hour: toInt(row.hour),
        total: toInt(row.total),
        completed: toInt(row.completed),
        fare: toNumber(row.fare),
      })),
      zoneActivity: zoneActivityRows.map((row) => ({
        zone_name: row.zone_name,
        zone_id: row.zone_id,
        dispatch_enabled: row.dispatch_enabled !== false,
        max_online_drivers: toInt(row.max_online_drivers),
        active_rides: toInt(row.active_rides),
        online_drivers: toInt(row.online_drivers),
      })),
      cancellationBreakdown: cancellationRows.map((row) => ({
        reason: row.reason,
        count: toInt(row.count),
      })),
      conversionFunnel: {
        total_created: toInt(funnel.total_created),
        left_requested: toInt(funnel.left_requested),
        completed: toInt(funnel.completed),
        cancelled: toInt(funnel.cancelled),
        avg_rating:
          funnel.avg_rating === null || funnel.avg_rating === undefined
            ? null
            : Number(funnel.avg_rating),
        avg_accept_minutes:
          funnel.avg_accept_minutes === null ||
          funnel.avg_accept_minutes === undefined
            ? null
            : Number(funnel.avg_accept_minutes),
      },
      recentAuditLog: auditRows,
      staleDriverCount: toInt(staleDriverRows[0]?.count),
    });
  } catch (err) {
    console.error("GET /api/admin/ops-snapshot error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
