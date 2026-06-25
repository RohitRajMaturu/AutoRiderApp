import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = resolve(__dirname, "..");

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

function readIntervalMs() {
  const seconds = Number(process.env.MAINTENANCE_INTERVAL_SECONDS || 30);
  if (!Number.isFinite(seconds) || seconds < 5) return 30000;
  return seconds * 1000;
}

function readHeartbeatTimeoutSeconds() {
  const seconds = Number(process.env.DRIVER_HEARTBEAT_TIMEOUT_SECONDS || 120);
  if (!Number.isFinite(seconds) || seconds < 30 || seconds > 1800) return 120;
  return seconds;
}

function readAcceptedRideTimeoutMinutes() {
  const minutes = Number(process.env.ACCEPTED_RIDE_TIMEOUT_MINUTES || 45);
  if (!Number.isFinite(minutes) || minutes < 1 || minutes > 720) return 45;
  return minutes;
}

function readOptionalTimeoutSeconds(name) {
  const seconds = Number(process.env[name] || 0);
  if (!Number.isFinite(seconds) || seconds < 0 || seconds > 86400) return 0;
  return seconds;
}

function readRetentionDays(name, fallback, { min = 1, max = 3650 } = {}) {
  const days = Number(process.env[name] || fallback);
  if (!Number.isFinite(days) || days < min || days > max) return fallback;
  return days;
}

async function runMaintenance(pool) {
  const client = await pool.connect(); // PATCHED:
  let locked = false; // PATCHED:

  try { // PATCHED:
    const lockRows = await client.query("SELECT pg_try_advisory_lock(202506181) AS locked"); // PATCHED:
    locked = Boolean(lockRows.rows[0]?.locked); // PATCHED:
    if (!locked) { // PATCHED:
      console.log("[maintenance] skipped — another process holds lock"); // PATCHED:
      return; // PATCHED:
    }

    const heartbeatTimeoutSeconds = readHeartbeatTimeoutSeconds();
    const acceptedRideTimeoutMinutes = readAcceptedRideTimeoutMinutes();
    const operationalEventRetentionDays = readRetentionDays(
      "OPERATIONAL_EVENT_RETENTION_DAYS",
      90,
    );
    const inactivePushTokenRetentionDays = readRetentionDays(
      "INACTIVE_PUSH_TOKEN_RETENTION_DAYS",
      180,
    );
    const noDriverTimeoutSeconds = readOptionalTimeoutSeconds(
      "NO_DRIVER_REQUEST_TIMEOUT_SECONDS",
    );
    const subscriptionGraceDays = readRetentionDays(
      "SUBSCRIPTION_HALT_GRACE_DAYS",
      5,
      { min: 0, max: 30 },
    );

    await client.query( // PATCHED:
      `
        UPDATE drivers
        SET is_online = false,
            online_since = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE is_online = true
          AND (
            last_heartbeat_at IS NULL
            OR last_heartbeat_at < CURRENT_TIMESTAMP - make_interval(secs => $1)
            OR subscription_expiry IS NULL
            OR subscription_expiry <= CURRENT_TIMESTAMP
          )
      `,
      [heartbeatTimeoutSeconds],
    );

    await client.query( // PATCHED:
      `
        UPDATE rides
        SET status = 'cancelled',
            cancelled_at = CURRENT_TIMESTAMP,
            cancellation_reason = 'accepted_timeout',
            updated_at = CURRENT_TIMESTAMP
        WHERE status = 'accepted'
          AND accepted_at < CURRENT_TIMESTAMP - make_interval(mins => $1)
      `,
      [acceptedRideTimeoutMinutes],
    );

    if (noDriverTimeoutSeconds > 0) {
      await client.query(
        `
          UPDATE rides
          SET status = 'cancelled',
              cancelled_at = CURRENT_TIMESTAMP,
              cancellation_reason = 'no_driver_timeout',
              updated_at = CURRENT_TIMESTAMP
          WHERE status IN ('requested', 'negotiating')
            AND driver_id IS NULL
            AND created_at < CURRENT_TIMESTAMP - make_interval(secs => $1)
        `,
        [noDriverTimeoutSeconds],
      );
    }

    await client.query(
      `
        UPDATE drivers
        SET is_online = false,
            online_since = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE is_online = true
          AND subscription_status IN ('halted', 'expired')
          AND (
            subscription_status = 'expired'
            OR subscription_halted_at IS NULL
            OR subscription_halted_at < CURRENT_TIMESTAMP - make_interval(days => $1)
          )
      `,
      [subscriptionGraceDays],
    );

    await client.query("DELETE FROM realtime_tokens WHERE expires_at <= CURRENT_TIMESTAMP"); // PATCHED:
    await client.query("DELETE FROM auth_sessions WHERE expires <= CURRENT_TIMESTAMP"); // PATCHED:
    await client.query("DELETE FROM auth_verification_tokens WHERE expires <= CURRENT_TIMESTAMP"); // PATCHED:
    await client.query( // PATCHED:
      `
        DELETE FROM otp_challenges
        WHERE expires_at <= CURRENT_TIMESTAMP
           OR consumed_at IS NOT NULL
      `,
    );

    await client.query(
      `
        DELETE FROM operational_events
        WHERE created_at < CURRENT_TIMESTAMP - make_interval(days => $1)
      `,
      [operationalEventRetentionDays],
    );

    await client.query(
      `
        DELETE FROM user_push_tokens
        WHERE is_active = false
           OR last_seen_at < CURRENT_TIMESTAMP - make_interval(days => $1)
      `,
      [inactivePushTokenRetentionDays],
    );
  } finally { // PATCHED:
    if (locked) { // PATCHED:
      await client.query("SELECT pg_advisory_unlock(202506181)"); // PATCHED:
    }
    client.release(); // PATCHED:
  }
}

async function main() {
  loadDotEnv();

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is missing. Set it in web/.env or the shell.");
  }

  const intervalMs = readIntervalMs();
  const pool = new Pool({ connectionString: databaseUrl, max: 2 });
  let running = false;

  async function tick() {
    if (running) return;
    running = true;
    try {
      await runMaintenance(pool);
    } catch (error) {
      console.error("Maintenance tick failed:", error.message);
    } finally {
      running = false;
    }
  }

  const timer = setInterval(tick, intervalMs);
  await tick();
  console.log(`Maintenance worker running every ${intervalMs / 1000}s.`);

  async function shutdown() {
    clearInterval(timer);
    await pool.end();
    process.exit(0);
  }

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error("Maintenance worker failed:", error.message);
  process.exitCode = 1;
});
