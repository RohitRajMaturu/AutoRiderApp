import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = resolve(__dirname, "..");
const REQUIRED_TABLES = [
  "auth_users",
  "auth_accounts",
  "auth_sessions",
  "auth_verification_tokens",
  "drivers",
  "rides",
  "geo_zones",
  "ride_driver_notifications",
  "admin_audit_log",
  "otp_cooldowns",
  "realtime_tokens",
  "otp_challenges",
];
const REQUIRED_COLUMNS = {
  drivers: [
    "vehicle_type",
    "zone_id",
    "location",
    "subscription_expiry",
    "last_heartbeat_at",
  ],
  geo_zones: ["boundary", "is_active", "dispatch_enabled"],
  rides: [
    "pickup_place_id",
    "dest_place_id",
    "distance_km",
    "duration_mins",
    "estimated_fare",
    "route_polyline",
    "route_provider",
    "vehicle_type",
    "zone_id",
    "negotiation_mode",
    "fare_min",
    "fare_max",
    "negotiation_expires_at",
    "passenger_rating",
    "passenger_rating_feedback",
  ],
};

function loadDotEnv() {
  const envPath = resolve(WEB_ROOT, ".env");
  try {
    const contents = readFileSync(envPath, "utf8");
    for (const line of contents.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separator = trimmed.indexOf("=");
      if (separator === -1) continue;
      const key = trimmed.slice(0, separator).trim();
      const value = trimmed.slice(separator + 1).trim();
      if (!process.env[key]) {
        process.env[key] = value.replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    // External DATABASE_URL is also supported.
  }
}

async function main() {
  loadDotEnv();

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is missing. Set it in web/.env or the shell.");
  }

  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const connection = await pool.query(
      "SELECT current_database() AS database_name, current_user AS user_name",
    );
    const tables = await pool.query(
      `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = ANY($1)
        ORDER BY table_name
      `,
      [REQUIRED_TABLES],
    );
    const columns = await pool.query(
      `
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = ANY($1)
        ORDER BY table_name, ordinal_position
      `,
      [Object.keys(REQUIRED_COLUMNS)],
    );
    const zoneReadiness = await pool.query(
      `
        SELECT
          count(*)::int AS total,
          count(*) FILTER (
            WHERE is_active = true
              AND dispatch_enabled = true
              AND boundary IS NOT NULL
          )::int AS active_dispatchable
        FROM geo_zones
      `,
    );
    const vehicleTypeReadiness = await pool.query(
      `
        SELECT
          (SELECT count(*)::int FROM drivers WHERE vehicle_type IS DISTINCT FROM 'auto')
            AS non_auto_drivers,
          (SELECT count(*)::int FROM rides WHERE vehicle_type IS DISTINCT FROM 'auto')
            AS non_auto_rides
      `,
    );
    const rideLifecycleHealth = await pool.query(
      `
        SELECT
          (SELECT count(*)::int
           FROM drivers
           WHERE is_online = true
             AND (zone_id IS NULL OR location IS NULL))
            AS online_drivers_missing_dispatch_data,
          (SELECT count(*)::int
           FROM rides
           WHERE status = 'accepted'
             AND driver_id IS NULL)
            AS accepted_rides_without_driver,
          (SELECT count(*)::int
           FROM rides
           WHERE status = 'completed'
             AND completed_at IS NULL)
            AS completed_rides_without_timestamp,
          (SELECT count(*)::int
           FROM rides
           WHERE status = 'cancelled'
             AND cancelled_at IS NULL)
            AS cancelled_rides_without_timestamp,
          (SELECT count(*)::int
           FROM rides r
           WHERE r.status IN ('requested', 'negotiating')
             AND EXISTS (
               SELECT 1
               FROM drivers d
               WHERE d.zone_id = r.zone_id
                 AND d.is_online = true
                 AND d.is_approved = true
                 AND d.subscription_expiry > CURRENT_TIMESTAMP
                 AND d.location IS NOT NULL
                 AND ST_DWithin(
                   d.location,
                   ST_SetSRID(ST_MakePoint(r.pickup_lng, r.pickup_lat), 4326)::geography,
                   8000
                 )
             )
             AND NOT EXISTS (
               SELECT 1
               FROM ride_driver_notifications n
               WHERE n.ride_id = r.id
                 AND n.status IN ('pending', 'sent')
             ))
            AS dispatchable_rides_without_notification
      `,
    );

    const found = new Set(tables.rows.map((row) => row.table_name));
    const missing = REQUIRED_TABLES.filter((table) => !found.has(table));
    const columnsByTable = columns.rows.reduce((result, row) => {
      (result[row.table_name] ||= []).push(row.column_name);
      return result;
    }, {});
    const missingColumns = Object.entries(REQUIRED_COLUMNS).flatMap(
      ([table, requiredColumns]) => {
        const existing = new Set(columnsByTable[table] || []);
        return requiredColumns
          .filter((column) => !existing.has(column))
          .map((column) => `${table}.${column}`);
      },
    );

    console.log(
      JSON.stringify(
        {
          connected: true,
          driver: "pg",
          database: connection.rows[0].database_name,
          user: connection.rows[0].user_name,
          requiredTables: REQUIRED_TABLES,
          existingTables: [...found].sort(),
          missingTables: missing,
          missingColumns,
          serviceZones: zoneReadiness.rows[0],
          vehicleTypes: vehicleTypeReadiness.rows[0],
          rideLifecycle: rideLifecycleHealth.rows[0],
        },
        null,
        2,
      ),
    );

    if (
      missing.length > 0 ||
      missingColumns.length > 0 ||
      vehicleTypeReadiness.rows[0].non_auto_drivers > 0 ||
      vehicleTypeReadiness.rows[0].non_auto_rides > 0
    ) {
      process.exitCode = 2;
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Database check failed:", error.message);
  process.exitCode = 1;
});
