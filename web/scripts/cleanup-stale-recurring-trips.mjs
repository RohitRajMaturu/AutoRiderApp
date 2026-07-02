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
const configuredHours = Number(process.env.RECURRING_TRIP_TIMEOUT_HOURS || 6);
const timeoutHours = Number.isFinite(configuredHours) && configuredHours >= 1 && configuredHours <= 24
  ? configuredHours
  : 6;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();

try {
  await client.query("BEGIN");
  const institutionTrips = await client.query(
    `
      UPDATE institution_trips
      SET status='CANCELLED',
          actual_end_time=COALESCE(actual_end_time,CURRENT_TIMESTAMP),
          cancellation_reason=COALESCE(cancellation_reason,'Automatically closed after exceeding the active-trip window'),
          cancelled_by=COALESCE(cancelled_by,'OPS'),
          updated_at=CURRENT_TIMESTAMP
      WHERE status='IN_PROGRESS'
        AND COALESCE(actual_start_time,updated_at) < CURRENT_TIMESTAMP-make_interval(hours=>$1)
      RETURNING id
    `,
    [timeoutHours],
  );
  const passRides = await client.query(
    `
      UPDATE pass_rides
      SET status='CANCELLED',
          end_time=COALESCE(end_time,CURRENT_TIMESTAMP),
          notes=concat_ws(E'\n',NULLIF(notes,''),'Automatically closed after exceeding the active-trip window'),
          updated_at=CURRENT_TIMESTAMP
      WHERE status='IN_PROGRESS'
        AND COALESCE(start_time,updated_at) < CURRENT_TIMESTAMP-make_interval(hours=>$1)
      RETURNING id
    `,
    [timeoutHours],
  );
  await client.query("COMMIT");
  console.log(JSON.stringify({
    timeoutHours,
    institutionTripsClosed: institutionTrips.rowCount,
    passRidesClosed: passRides.rowCount,
  }, null, 2));
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
