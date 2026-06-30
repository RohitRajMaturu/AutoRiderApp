const PRIORITY = { ON_DEMAND: 1, PASS: 2, INSTITUTION: 3 };

export function currentServiceSlot(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return { days: [String(value.weekday).toUpperCase()], time: `${value.hour}:${value.minute}` };
}

export async function lockDriverSchedule(tx, driverId) {
  const rows = await tx`
    SELECT id
    FROM drivers
    WHERE id = ${driverId}
    FOR UPDATE
  `;
  if (!rows[0]) {
    const error = new Error("Driver not found");
    error.code = "DRIVER_NOT_FOUND";
    error.status = 404;
    throw error;
  }
}

export async function findDriverConflict(
  tx,
  { driverId, scheduledDays, scheduledTime, sourceType, excludeId = null },
) {
  const requestedPriority = PRIORITY[sourceType] || 0;
  const institutionRows = await tx`
    SELECT id, route_name, scheduled_days, scheduled_time, 'INSTITUTION' AS source_type
    FROM institution_routes
    WHERE driver_id = ${driverId}
      AND status = 'ACTIVE'
      AND id <> COALESCE(${excludeId}, '00000000-0000-0000-0000-000000000000'::uuid)
      AND scheduled_days && ${scheduledDays}::text[]
      AND abs(extract(epoch FROM (scheduled_time - ${scheduledTime}::time))) < 5400
    LIMIT 1
  `;
  if (institutionRows[0] && PRIORITY.INSTITUTION >= requestedPriority) return institutionRows[0];

  const passRows = await tx`
    SELECT id, pickup_label, dropoff_label, scheduled_days, scheduled_time, 'PASS' AS source_type
    FROM commuter_passes
    WHERE driver_id = ${driverId}
      AND status IN ('ACTIVE', 'PENDING_MATCH')
      AND id <> COALESCE(${excludeId}, '00000000-0000-0000-0000-000000000000'::uuid)
      AND scheduled_days && ${scheduledDays}::text[]
      AND abs(extract(epoch FROM (scheduled_time - ${scheduledTime}::time))) < 5400
    LIMIT 1
  `;
  if (passRows[0] && PRIORITY.PASS >= requestedPriority) return passRows[0];
  return null;
}

export async function assertDriverAvailable(tx, options) {
  await lockDriverSchedule(tx, options.driverId);
  const conflict = await findDriverConflict(tx, options);
  if (conflict) {
    const error = new Error(
      `Driver has an overlapping ${String(conflict.source_type).toLowerCase()} assignment`,
    );
    error.code = "DRIVER_SCHEDULE_CONFLICT";
    error.status = 409;
    error.conflict = conflict;
    throw error;
  }
}
