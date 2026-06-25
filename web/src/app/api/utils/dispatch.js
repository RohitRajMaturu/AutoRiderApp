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
  const radiusMeters = getDriverRideRadiusMeters(); // PATCHED:
  const rows = await scopedSql`
    SELECT d.id, d.user_id, u.phone, d.online_since, z.max_online_drivers
    FROM drivers d
    JOIN geo_zones z ON z.id = d.zone_id
    JOIN auth_users u ON u.id = d.user_id
    WHERE d.zone_id = ${zoneId}
      AND z.is_active = true
      AND z.dispatch_enabled = true
      AND d.is_online = true
      AND d.is_approved = true
      AND d.vehicle_type = ${vehicleType}
      AND d.subscription_expiry > CURRENT_TIMESTAMP
      AND d.location IS NOT NULL
      AND ST_DWithin(d.location, ST_SetSRID(ST_MakePoint(${pickupLng}, ${pickupLat}), 4326)::geography, ${radiusMeters}) -- PATCHED:
    ORDER BY d.online_since ASC NULLS LAST, d.updated_at ASC
    LIMIT (SELECT max_online_drivers FROM geo_zones WHERE id = ${zoneId})
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
