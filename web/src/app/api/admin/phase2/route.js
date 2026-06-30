import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";
import { requireAdmin } from "@/app/api/utils/admin";

export async function GET(request) {
  const guard = await requireAdmin(request, auth);
  if (guard.response) return guard.response;
  const [drivers, passes, institutions, trips, slaEvents, funnel] = await Promise.all([
    sql`
      SELECT d.id, u.name, d.rating, d.is_online, d.sla_score,
        COALESCE((SELECT count(*)::int FROM commuter_passes p WHERE p.driver_id = d.id AND p.status = 'ACTIVE'), 0) AS active_passes,
        COALESCE((SELECT count(*)::int FROM institution_routes r WHERE r.driver_id = d.id AND r.status = 'ACTIVE'), 0) AS institution_routes,
        COALESCE((SELECT json_agg(item ORDER BY item.time) FROM (
          SELECT p.scheduled_time AS time, 'PASS' AS type, p.pickup_label || ' → ' || p.dropoff_label AS label
          FROM commuter_passes p WHERE p.driver_id = d.id AND p.status = 'ACTIVE'
          UNION ALL
          SELECT r.scheduled_time, 'INSTITUTION', i.name || ': ' || r.route_name
          FROM institution_routes r JOIN institutions i ON i.id = r.institution_id
          WHERE r.driver_id = d.id AND r.status = 'ACTIVE'
        ) item), '[]'::json) AS today_schedule
      FROM drivers d JOIN auth_users u ON u.id = d.user_id
      WHERE d.is_approved = true ORDER BY u.name
    `,
    sql`SELECT p.*, passenger.name AS passenger_name, driver_user.name AS driver_name FROM commuter_passes p JOIN auth_users passenger ON passenger.id=p.passenger_id LEFT JOIN drivers d ON d.id=p.driver_id LEFT JOIN auth_users driver_user ON driver_user.id=d.user_id ORDER BY p.created_at DESC LIMIT 200`,
    sql`SELECT i.*, COALESCE((SELECT count(*) FROM institution_routes r WHERE r.institution_id=i.id),0)::int AS route_count, COALESCE((SELECT sum(amount) FROM institution_invoices inv WHERE inv.institution_id=i.id AND inv.status='PAID'),0)::int AS paid_amount FROM institutions i ORDER BY i.created_at DESC`,
    sql`SELECT t.*, i.name AS institution_name, r.route_name FROM institution_trips t JOIN institutions i ON i.id=t.institution_id JOIN institution_routes r ON r.id=t.route_id WHERE t.scheduled_date=CURRENT_DATE ORDER BY t.created_at DESC`,
    sql`SELECT e.*, u.name AS driver_name FROM driver_sla_events e JOIN drivers d ON d.id=e.driver_id JOIN auth_users u ON u.id=d.user_id ORDER BY e.created_at DESC LIMIT 200`,
    sql`SELECT event_type, count(*)::int AS count FROM institution_trial_events GROUP BY event_type ORDER BY event_type`,
  ]);
  return Response.json({ drivers, passes, institutions, trips, slaEvents, funnel });
}
