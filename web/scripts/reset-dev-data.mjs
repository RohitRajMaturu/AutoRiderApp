if (process.env.NODE_ENV === "production") {
  console.error("ERROR: reset-dev-data must not run in production.");
  process.exit(1);
}

const args = process.argv.slice(2);
if (!args.includes("--force")) {
  console.error(
    "Safety check: pass --force flag to confirm data deletion.\n" +
      "  node scripts/reset-dev-data.mjs --force"
  );
  process.exit(1);
}

console.warn("WARNING: About to delete ALL dev data. Proceeding...");

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = resolve(__dirname, "..");

const TABLES = [
  "ride_driver_notifications",
  "admin_audit_log",
  "rides",
  "drivers",
  "geo_zones",
  "realtime_tokens",
  "otp_challenges",
  "otp_cooldowns",
  "auth_sessions",
  "auth_verification_tokens",
  "auth_accounts",
  "auth_users",
];

function loadDotEnv() {
  const envPath = resolve(WEB_ROOT, ".env");
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
}

async function countRows(client) {
  const counts = {};
  for (const table of TABLES) {
    const result = await client.query(`SELECT count(*)::int AS count FROM public.${table}`);
    counts[table] = result.rows[0].count;
  }
  return counts;
}

async function main() {
  loadDotEnv();

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing. Set it in web/.env or the shell.");
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    const database = await client.query(
      "SELECT current_database() AS database_name, current_user AS user_name",
    );

    console.log(
      `Resetting data in ${database.rows[0].database_name} as ${database.rows[0].user_name}`,
    );

    await client.query("BEGIN");
    await client.query(
      `TRUNCATE TABLE ${TABLES.map((table) => `public.${table}`).join(", ")} RESTART IDENTITY CASCADE`,
    );
    await client.query("COMMIT");

    console.log(JSON.stringify(await countRows(client), null, 2));
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Dev data reset failed:", error.message);
  process.exitCode = 1;
});
