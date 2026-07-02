import sql from "@/app/api/utils/sql";
import { getEnvNumber } from "@/app/api/utils/validation";

const DEFAULT_VEHICLE_TYPE = "auto";

export function getPassengerSpamCooldownSeconds() {
  return getEnvNumber("PASSENGER_REQUEST_COOLDOWN_SECONDS", 30, {
    min: 0,
    max: 3600,
  });
}

export function getPassengerPostCancelCooldownSeconds() {
  return getEnvNumber("PASSENGER_POST_CANCEL_COOLDOWN_SECONDS", 60, {
    min: 0,
    max: 86400,
  });
}

export function getAcceptedRideTimeoutMinutes() {
  return getEnvNumber("ACCEPTED_RIDE_TIMEOUT_MINUTES", 45, {
    min: 1,
    max: 720,
  });
}

export function getDriverHeartbeatTimeoutSeconds() {
  return getEnvNumber("DRIVER_HEARTBEAT_TIMEOUT_SECONDS", 120, {
    min: 30,
    max: 1800,
  });
}

export function getDriverRideRadiusMeters() { // PATCHED:
  return getEnvNumber("DRIVER_RIDE_RADIUS_KM", 8, {
    min: 1,
    max: 50,
  }) * 1000;
}

export function getBackToBackDispatchRadiusMeters() {
  return getEnvNumber("BACK_TO_BACK_DISPATCH_RADIUS_KM", 2, {
    min: 0.5,
    max: 10,
  }) * 1000;
}

export function getRecurringReservationMinutes() {
  return getEnvNumber("RECURRING_RIDE_RESERVATION_MINUTES", 90, {
    min: 30,
    max: 240,
  });
}

export function getRecurringTripTimeoutHours() {
  return getEnvNumber("RECURRING_TRIP_TIMEOUT_HOURS", 6, {
    min: 1,
    max: 24,
  });
}

export async function findZoneForPoint(lat, lng, scopedSql = sql) {
  const rows = await scopedSql`
    SELECT id, name, max_online_drivers
    FROM geo_zones
    WHERE is_active = true
      AND dispatch_enabled = true
      AND ST_Covers(boundary::geometry, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326))
    ORDER BY created_at ASC
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function offlineExpiredDrivers(scopedSql = sql) {
  const timeoutSeconds = getDriverHeartbeatTimeoutSeconds();
  await scopedSql`
    UPDATE drivers
    SET is_online = false,
        online_since = NULL,
        updated_at = CURRENT_TIMESTAMP
    WHERE is_online = true
      AND (
        last_heartbeat_at IS NULL
        OR last_heartbeat_at < CURRENT_TIMESTAMP - make_interval(secs => ${timeoutSeconds})
        OR subscription_expiry IS NULL
        OR subscription_expiry <= CURRENT_TIMESTAMP
      )
  `;
}

export async function autoCancelGhostRides(scopedSql = sql) {
  const timeoutMinutes = getAcceptedRideTimeoutMinutes();
  await scopedSql`
    UPDATE rides
    SET status = 'cancelled',
        cancelled_at = CURRENT_TIMESTAMP,
        cancellation_reason = 'accepted_timeout',
        updated_at = CURRENT_TIMESTAMP
    WHERE status = 'accepted'
      AND started_at IS NULL
      AND NOT EXISTS (
        SELECT 1
        FROM rides current_ride
        WHERE current_ride.driver_id = rides.driver_id
          AND current_ride.id <> rides.id
          AND current_ride.status = 'accepted'
          AND current_ride.started_at IS NOT NULL
      )
      AND accepted_at < CURRENT_TIMESTAMP - make_interval(mins => ${timeoutMinutes})
  `;
}

export async function selectZoneDrivers(
  zoneId,
  pickupLat,
  pickupLng,
  vehicleType = DEFAULT_VEHICLE_TYPE,
  scopedSql = sql,
) {
  if (!zoneId) return [];
  const radiusMeters = getDriverRideRadiusMeters();
  const backToBackRadiusMeters = getBackToBackDispatchRadiusMeters();
  const recurringReservationMinutes = getRecurringReservationMinutes();
  const recurringTripTimeoutHours = getRecurringTripTimeoutHours();
  const rows = await scopedSql`
    WITH target_zone AS (
      SELECT id, boundary, max_online_drivers
      FROM geo_zones
      WHERE id = ${zoneId}
        AND is_active = true
        AND dispatch_enabled = true
    ),
    refreshed_drivers AS (
      UPDATE drivers d
      SET zone_id = z.id,
          updated_at = CURRENT_TIMESTAMP
      FROM target_zone z
      WHERE d.is_online = true
        AND d.location IS NOT NULL
        AND ST_Covers(z.boundary::geometry, d.location::geometry)
      RETURNING d.*
    )
    SELECT d.id, d.user_id, u.phone, d.online_since, z.max_online_drivers
    FROM refreshed_drivers d
    CROSS JOIN target_zone z
    JOIN auth_users u ON u.id = d.user_id
    WHERE d.is_online = true
      AND d.is_approved = true
      AND d.vehicle_type = ${vehicleType}
      AND d.subscription_expiry > CURRENT_TIMESTAMP
      AND d.location IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM institution_routes recurring_route
        WHERE recurring_route.driver_id = d.id
          AND recurring_route.status = 'ACTIVE'
          AND upper(to_char(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata', 'DY')) = ANY(recurring_route.scheduled_days)
          AND abs(extract(epoch FROM (recurring_route.scheduled_time - (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::time)))
              < ${recurringReservationMinutes} * 60
      )
      AND NOT EXISTS (
        SELECT 1
        FROM commuter_passes recurring_pass
        WHERE (recurring_pass.driver_id = d.id OR recurring_pass.backup_driver_id = d.id)
          AND recurring_pass.status = 'ACTIVE'
          AND (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date BETWEEN recurring_pass.start_date AND recurring_pass.end_date
          AND upper(to_char(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata', 'DY')) = ANY(recurring_pass.scheduled_days)
          AND abs(extract(epoch FROM (recurring_pass.scheduled_time - (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::time)))
              < ${recurringReservationMinutes} * 60
      )
      AND NOT EXISTS (
        SELECT 1 FROM institution_trips active_institution_trip
        WHERE COALESCE(active_institution_trip.reassigned_driver_id, active_institution_trip.driver_id) = d.id
          AND active_institution_trip.status = 'IN_PROGRESS'
          AND COALESCE(active_institution_trip.actual_start_time, active_institution_trip.updated_at)
              > CURRENT_TIMESTAMP - make_interval(hours => ${recurringTripTimeoutHours})
      )
      AND NOT EXISTS (
        SELECT 1 FROM pass_rides active_pass_ride
        JOIN commuter_passes active_pass ON active_pass.id = active_pass_ride.pass_id
        WHERE COALESCE(active_pass_ride.actual_driver_id, active_pass.driver_id) = d.id
          AND active_pass_ride.status = 'IN_PROGRESS'
          AND COALESCE(active_pass_ride.start_time, active_pass_ride.updated_at)
              > CURRENT_TIMESTAMP - make_interval(hours => ${recurringTripTimeoutHours})
      )
      AND (
        NOT EXISTS (
          SELECT 1
          FROM rides active_ride
          WHERE active_ride.driver_id = d.id
            AND active_ride.status = 'accepted'
        )
        OR (
          (SELECT count(*) FROM rides assigned WHERE assigned.driver_id = d.id AND assigned.status = 'accepted') = 1
          AND EXISTS (
            SELECT 1
            FROM rides current_ride
            WHERE current_ride.driver_id = d.id
              AND current_ride.status = 'accepted'
              AND current_ride.started_at IS NOT NULL
              AND ST_DWithin(
                d.location,
                ST_SetSRID(ST_MakePoint(current_ride.dest_lng, current_ride.dest_lat), 4326)::geography,
                ${backToBackRadiusMeters}
              )
          )
        )
      )
      AND ST_DWithin(
        d.location,
        ST_SetSRID(ST_MakePoint(${pickupLng}, ${pickupLat}), 4326)::geography,
        ${radiusMeters}
      )
    ORDER BY d.online_since ASC NULLS LAST, d.updated_at ASC
    LIMIT (SELECT max_online_drivers FROM target_zone)
  `;
  return rows;
}

export function createBackgroundTask(task) {
  Promise.resolve()
    .then(task)
    .catch((error) => console.error("background task failed:", error));
}

export async function dispatchRideRequest(ride, scopedSql = sql) {
  const drivers = await selectZoneDrivers(
    ride.zone_id,
    ride.pickup_lat,
    ride.pickup_lng,
    DEFAULT_VEHICLE_TYPE,
    scopedSql,
  );
  if (drivers.length === 0) {
    return 0;
  }

  const payload = JSON.stringify({
    type: ride.status === "negotiating" ? "fare_negotiation" : "ride_request",
    ride_id: ride.id,
  });
  const values = [];
  const placeholders = drivers.map((driver, index) => {
    const offset = index * 5;
    values.push(ride.id, driver.id, "websocket", "pending", payload);
    return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}::jsonb)`;
  });

  await scopedSql(
    `
      INSERT INTO ride_driver_notifications (ride_id, driver_id, channel, status, payload)
      VALUES ${placeholders.join(", ")}
      ON CONFLICT (ride_id, driver_id, channel) DO NOTHING
    `,
    values,
  );

  return drivers.length;
}
