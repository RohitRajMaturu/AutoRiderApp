import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

try {
  const env = readFileSync(resolve(root, ".env"), "utf8");
  for (const line of env.split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match && !process.env[match[1].trim()]) {
      process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, "");
    }
  }
} catch {
  // External environment is supported.
}

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is missing");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

try {
  const rides = await pool.query(`
    SELECT r.id, r.status, r.zone_id, r.created_at, r.scheduled_for,
      round(extract(epoch FROM (CURRENT_TIMESTAMP - r.created_at)) / 60)::int AS age_minutes,
      count(n.id)::int AS notification_count
    FROM rides r
    LEFT JOIN ride_driver_notifications n ON n.ride_id = r.id
    WHERE r.created_at > CURRENT_TIMESTAMP - INTERVAL '24 hours'
    GROUP BY r.id
    ORDER BY r.created_at DESC
    LIMIT 10
  `);

  const latestRide = await pool.query(`
    SELECT * FROM rides
    WHERE scheduled_for IS NULL
    ORDER BY created_at DESC
    LIMIT 1
  `);

  let eligibility = [];
  let institutionTrips = [];
  if (latestRide.rows[0]) {
    const ride = latestRide.rows[0];
    const result = await pool.query(`
      SELECT d.id,
        d.zone_id = $1::uuid AS same_zone,
        d.is_online,
        d.is_approved,
        d.vehicle_type = 'auto' AS auto_vehicle,
        d.subscription_expiry > CURRENT_TIMESTAMP AS subscription_active,
        d.location IS NOT NULL AS has_location,
        CASE WHEN d.location IS NULL THEN false ELSE ST_DWithin(
          d.location,
          ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography,
          8000
        ) END AS within_radius,
        EXISTS(SELECT 1 FROM rides active WHERE active.driver_id=d.id AND active.status='accepted') AS has_accepted_ride,
        EXISTS(
          SELECT 1 FROM institution_routes route
          WHERE route.driver_id=d.id AND route.status='ACTIVE'
            AND upper(to_char(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata','DY'))=ANY(route.scheduled_days)
            AND abs(extract(epoch FROM (route.scheduled_time-(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::time))) < 5400
        ) AS institution_reserved,
        EXISTS(
          SELECT 1 FROM commuter_passes pass
          WHERE (pass.driver_id=d.id OR pass.backup_driver_id=d.id) AND pass.status='ACTIVE'
            AND upper(to_char(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata','DY'))=ANY(pass.scheduled_days)
            AND abs(extract(epoch FROM (pass.scheduled_time-(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::time))) < 5400
        ) AS pass_reserved,
        EXISTS(
          SELECT 1 FROM institution_trips trip
          WHERE COALESCE(trip.reassigned_driver_id,trip.driver_id)=d.id AND trip.status='IN_PROGRESS'
        ) AS institution_in_progress,
        EXISTS(
          SELECT 1 FROM pass_rides pr JOIN commuter_passes pass ON pass.id=pr.pass_id
          WHERE COALESCE(pr.actual_driver_id,pass.driver_id)=d.id AND pr.status='IN_PROGRESS'
        ) AS pass_in_progress,
        EXISTS(
          SELECT 1 FROM ride_driver_notifications n
          WHERE n.ride_id=$4::uuid AND n.driver_id=d.id AND n.status IN ('pending','sent')
        ) AS notified
      FROM drivers d
      ORDER BY d.created_at DESC
    `, [ride.zone_id, ride.pickup_lng, ride.pickup_lat, ride.id]);
    eligibility = result.rows;
    const activeTrips = await pool.query(`
      SELECT t.id, t.driver_id, t.reassigned_driver_id, t.scheduled_date,
        t.status, t.actual_start_time, t.actual_end_time, t.updated_at,
        r.scheduled_time, r.direction
      FROM institution_trips t
      JOIN institution_routes r ON r.id=t.route_id
      WHERE t.status='IN_PROGRESS'
      ORDER BY t.updated_at DESC
    `);
    institutionTrips = activeTrips.rows;
  }

  console.log(JSON.stringify({
    recentRides: rides.rows,
    latestRide: latestRide.rows[0]
      ? {
          id: latestRide.rows[0].id,
          status: latestRide.rows[0].status,
          zone_id: latestRide.rows[0].zone_id,
          created_at: latestRide.rows[0].created_at,
          scheduled_for: latestRide.rows[0].scheduled_for,
        }
      : null,
    driverEligibility: eligibility,
    institutionTrips,
  }, null, 2));
} finally {
  await pool.end();
}
