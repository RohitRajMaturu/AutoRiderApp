import { auth } from "@/auth";
import sql from "@/app/api/utils/sql";
import { requireAdmin } from "@/app/api/utils/admin";

function toInt(value) {
  return parseInt(value || 0, 10);
}

export async function GET(request) {
  try {
    const admin = await requireAdmin(request, auth);
    if (admin.response) return admin.response;

    const drivers = await sql`
      SELECT
        d.id,
        d.vehicle_number,
        d.is_online,
        d.is_approved,
        d.last_lat,
        d.last_lng,
        d.last_heartbeat_at,
        d.online_since,
        d.zone_id,
        d.subscription_expiry,
        u.phone,
        u.email,
        u.created_at as joined_at,
        gz.name as zone_name,
        COUNT(r.id) FILTER (WHERE r.status = 'completed') as total_completed,
        COUNT(r.id) FILTER (
          WHERE r.status = 'completed'
            AND r.completed_at >= CURRENT_DATE AT TIME ZONE 'Asia/Kolkata'
        ) as today_trips,
        COUNT(r.id) FILTER (
          WHERE r.status = 'completed'
            AND r.completed_at >= NOW() - INTERVAL '30 days'
        ) as completed_30d,
        ROUND((AVG((to_jsonb(r)->>'driver_rating')::numeric) FILTER (
          WHERE to_jsonb(r)->>'driver_rating' IS NOT NULL
            AND r.completed_at >= NOW() - INTERVAL '30 days'
        ))::numeric, 1) as avg_rating_30d,
        MAX(r.completed_at) as last_ride_at,
        CASE WHEN EXISTS (
          SELECT 1
          FROM rides ar
          WHERE ar.driver_id = d.id AND ar.status = 'accepted'
        ) THEN true ELSE false END as on_trip
      FROM drivers d
      JOIN auth_users u ON d.user_id = u.id
      LEFT JOIN geo_zones gz ON d.zone_id = gz.id
      LEFT JOIN rides r ON r.driver_id = d.id
      GROUP BY d.id, u.phone, u.email, u.created_at, gz.name
      ORDER BY d.is_online DESC, d.online_since DESC NULLS LAST
    `;

    return Response.json({
      drivers: drivers.map((driver) => ({
        ...driver,
        total_completed: toInt(driver.total_completed),
        today_trips: toInt(driver.today_trips),
        completed_30d: toInt(driver.completed_30d),
        avg_rating_30d:
          driver.avg_rating_30d === null || driver.avg_rating_30d === undefined
            ? null
            : Number(driver.avg_rating_30d),
      })),
    });
  } catch (err) {
    console.error("GET /api/admin/ops-drivers error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
