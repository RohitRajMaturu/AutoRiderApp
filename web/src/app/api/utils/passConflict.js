import sql from "@/app/api/utils/sql";

export async function checkDriverAvailability({
  driverId,
  scheduledDays,
  scheduledTime,
  excludePassId = null,
  excludeRouteId = null,
}) {
  const [routes, passes] = await Promise.all([
    sql`SELECT id,route_name,scheduled_days,scheduled_time FROM institution_routes
      WHERE driver_id=${driverId} AND status='ACTIVE'
        AND id<>COALESCE(${excludeRouteId},'00000000-0000-0000-0000-000000000000'::uuid)
        AND scheduled_days&&${scheduledDays}::text[]
        AND abs(extract(epoch FROM(scheduled_time-${scheduledTime}::time)))<5400`,
    sql`SELECT id,pickup_label,dropoff_label,scheduled_days,scheduled_time FROM commuter_passes
      WHERE (driver_id=${driverId} OR backup_driver_id=${driverId}) AND status IN('ACTIVE','PENDING_MATCH')
        AND id<>COALESCE(${excludePassId},'00000000-0000-0000-0000-000000000000'::uuid)
        AND scheduled_days&&${scheduledDays}::text[]
        AND abs(extract(epoch FROM(scheduled_time-${scheduledTime}::time)))<5400`,
  ]);
  const conflicts = [
    ...routes.map((r) => ({
      type: "institution_route",
      referenceId: r.id,
      referenceName: r.route_name,
      scheduledDays: r.scheduled_days,
      scheduledTime: r.scheduled_time,
    })),
    ...passes.map((p) => ({
      type: "pass_subscription",
      referenceId: p.id,
      referenceName: `${p.pickup_label} → ${p.dropoff_label}`,
      scheduledDays: p.scheduled_days,
      scheduledTime: p.scheduled_time,
    })),
  ];
  return { available: conflicts.length === 0, conflicts };
}
