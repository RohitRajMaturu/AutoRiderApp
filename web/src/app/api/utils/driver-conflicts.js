import { getRecurringTripTimeoutHours } from "@/app/api/utils/dispatch";

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
  if (sourceType === "ON_DEMAND") {
    const recurringTripTimeoutHours = getRecurringTripTimeoutHours();
    const activeRecurringRows = await tx`
      SELECT id, source_type
      FROM (
        SELECT trip.id, 'INSTITUTION' AS source_type
        FROM institution_trips trip
        WHERE COALESCE(trip.reassigned_driver_id, trip.driver_id) = ${driverId}
          AND trip.status = 'IN_PROGRESS'
          AND COALESCE(trip.actual_start_time, trip.updated_at)
              > CURRENT_TIMESTAMP - make_interval(hours => ${recurringTripTimeoutHours})
        UNION ALL
        SELECT ride.id, 'PASS' AS source_type
        FROM pass_rides ride
        JOIN commuter_passes pass ON pass.id = ride.pass_id
        WHERE COALESCE(ride.actual_driver_id, pass.driver_id) = ${driverId}
          AND ride.status = 'IN_PROGRESS'
          AND COALESCE(ride.start_time, ride.updated_at)
              > CURRENT_TIMESTAMP - make_interval(hours => ${recurringTripTimeoutHours})
      ) active_recurring
      LIMIT 1
    `;
    if (activeRecurringRows[0]) return activeRecurringRows[0];
  }
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
  if (institutionRows[0]) return institutionRows[0];

  const passRows = await tx`
    SELECT id, pickup_label, dropoff_label, scheduled_days, scheduled_time, 'PASS' AS source_type
    FROM commuter_passes
    WHERE (driver_id = ${driverId} OR backup_driver_id = ${driverId})
      AND status IN ('ACTIVE', 'PENDING_MATCH')
      AND id <> COALESCE(${excludeId}, '00000000-0000-0000-0000-000000000000'::uuid)
      AND scheduled_days && ${scheduledDays}::text[]
      AND abs(extract(epoch FROM (scheduled_time - ${scheduledTime}::time))) < 5400
    LIMIT 1
  `;
  if (passRows[0]) return passRows[0];
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
