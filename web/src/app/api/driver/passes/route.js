import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

export async function GET(request) {
  const session = await auth(request);
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const driverRows = await sql`SELECT d.id AS driver_id,p.* FROM drivers d LEFT JOIN driver_pass_preferences p ON p.driver_id=d.id
    WHERE d.user_id=${session.user.id} LIMIT 1`;
  const driver = driverRows[0];
  if (!driver) return Response.json({ error: "Driver profile required" }, { status: 404 });
  const rows = await sql`
    SELECT p.*, u.name AS passenger_name,
      COALESCE((SELECT count(*)::int FROM pass_rides pr WHERE pr.pass_id = p.id AND pr.status = 'COMPLETED'), 0) AS completed_rides,
      COALESCE((SELECT count(*)::int FROM pass_rides pr WHERE pr.pass_id = p.id), 0) AS total_rides
    FROM commuter_passes p
    JOIN drivers d ON d.id = p.driver_id
    JOIN auth_users u ON u.id = p.passenger_id
    WHERE d.user_id = ${session.user.id} AND p.status IN ('ACTIVE', 'PAUSED')
    ORDER BY p.scheduled_time, p.created_at
  `;
  let offers = [];
  if (driver.accepts_pass_subscriptions) {
    offers = await sql`
      SELECT p.*,u.name AS passenger_name,
        ST_Distance(
          ST_SetSRID(ST_MakePoint(p.pickup_lng, p.pickup_lat), 4326)::geography,
          ST_SetSRID(ST_MakePoint(${driver.preferred_zone_lng}, ${driver.preferred_zone_lat}), 4326)::geography
        ) / 1000.0 AS pickup_distance_km
      FROM commuter_passes p JOIN auth_users u ON u.id=p.passenger_id
      WHERE p.status='PENDING_MATCH' AND p.payment_status='PAID' AND p.driver_id IS NULL
        AND ${driver.preferred_zone_lat}::double precision IS NOT NULL
        AND ${driver.preferred_zone_lng}::double precision IS NOT NULL
        AND ST_DWithin(
          ST_SetSRID(ST_MakePoint(p.pickup_lng, p.pickup_lat), 4326)::geography,
          ST_SetSRID(ST_MakePoint(${driver.preferred_zone_lng}, ${driver.preferred_zone_lat}), 4326)::geography,
          ${driver.preferred_zone_radius_km} * 1000
        )
        AND (${driver.preferred_shift} IN ('ANY','BOTH')
          OR (${driver.preferred_shift}='MORNING' AND p.scheduled_time<'12:00'::time)
          OR (${driver.preferred_shift}='EVENING' AND p.scheduled_time>='12:00'::time))
        AND NOT EXISTS(SELECT 1 FROM institution_routes r WHERE r.driver_id=${driver.driver_id} AND r.status='ACTIVE'
          AND r.scheduled_days&&p.scheduled_days AND abs(extract(epoch FROM(r.scheduled_time-p.scheduled_time)))<5400)
        AND NOT EXISTS(SELECT 1 FROM commuter_passes assigned WHERE (assigned.driver_id=${driver.driver_id} OR assigned.backup_driver_id=${driver.driver_id})
          AND assigned.status='ACTIVE' AND assigned.scheduled_days&&p.scheduled_days
          AND abs(extract(epoch FROM(assigned.scheduled_time-p.scheduled_time)))<5400)
      ORDER BY p.created_at LIMIT 20
    `;
  }
  const institutionTrips = await sql`
    SELECT t.*,r.route_name,r.direction,r.scheduled_time,i.name AS institution_name,
      COALESCE((SELECT json_agg(json_build_object('id',m.id,'name',m.member_name,'stopOrder',m.stop_order)
        ORDER BY m.stop_order NULLS LAST,m.member_name) FROM institution_members m
        WHERE m.id=ANY(t.members_expected)),'[]'::json) AS members
    FROM institution_trips t JOIN institution_routes r ON r.id=t.route_id
    JOIN institutions i ON i.id=t.institution_id
    WHERE COALESCE(t.reassigned_driver_id,t.driver_id)=${driver.driver_id}
      AND t.scheduled_date=(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date
      AND t.status IN('SCHEDULED','IN_PROGRESS') ORDER BY r.scheduled_time
  `;
  return Response.json({
    passes: rows,
    offers,
    institutionTrips,
    preferences: {
      enabled: Boolean(driver.accepts_pass_subscriptions),
      shift: driver.preferred_shift || "ANY",
      radiusKm: Number(driver.preferred_zone_radius_km || 5),
      hasPickupZone: driver.preferred_zone_lat !== null && driver.preferred_zone_lng !== null,
      maxActivePasses: Number(driver.max_active_passes || 3),
    },
  });
}
