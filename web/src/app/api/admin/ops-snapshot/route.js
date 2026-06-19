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
        SELECT COALESCE(SUM(estimated_fare), 0) as total
        FROM rides
        WHERE status = 'completed'
          AND completed_at >= CURRENT_DATE AT TIME ZONE 'Asia/Kolkata'
      `,
      sql`
        SELECT COUNT(*) as count
        FROM rides
        WHERE status = 'completed'
          AND completed_at >= CURRENT_DATE AT TIME ZONE 'Asia/Kolkata'
      `,
      sql`
        SELECT COUNT(*) as count
        FROM rides
        WHERE status = 'cancelled'
          AND cancelled_at >= CURRENT_DATE AT TIME ZONE 'Asia/Kolkata'
      `,
      sql`
        SELECT
          date_trunc('day', created_at) AT TIME ZONE 'Asia/Kolkata' as day,
          COUNT(*) FILTER (WHERE status = 'completed') as completed,
          COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
          COUNT(*) as total,
          COALESCE(SUM(estimated_fare) FILTER (WHERE status = 'completed'), 0) as fare
        FROM rides
        WHERE created_at >= CURRENT_DATE - INTERVAL '6 days'
        GROUP BY 1
        ORDER BY 1
      `,
      sql`
        SELECT
          EXTRACT(HOUR FROM created_at AT TIME ZONE 'Asia/Kolkata') as hour,
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'completed') as completed,
          COALESCE(SUM(estimated_fare) FILTER (WHERE status = 'completed'), 0) as fare
        FROM rides
        WHERE created_at >= CURRENT_DATE AT TIME ZONE 'Asia/Kolkata'
        GROUP BY 1
        ORDER BY 1
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
          AND r.created_at >= CURRENT_DATE AT TIME ZONE 'Asia/Kolkata'
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
          AND cancelled_at >= CURRENT_DATE - INTERVAL '6 days'
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
