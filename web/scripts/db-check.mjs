import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = resolve(__dirname, "..");
const REQUIRED_TABLES = [
  "auth_users",
  "auth_accounts",
  "auth_sessions",
  "auth_verification_tokens",
  "drivers",
  "rides",
];

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
    // External DATABASE_URL is also supported, so a missing .env is fine.
  }
}

function isLocalDatabase(url) {
  return /localhost|127\.0\.0\.1/i.test(url);
}

function runPsqlCheck(databaseUrl) {
  const query = `
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN (${REQUIRED_TABLES.map((table) => `'${table}'`).join(",")})
    ORDER BY table_name;
  `;
  const result = spawnSync(
    "psql",
    [databaseUrl, "-t", "-A", "-c", query],
    { encoding: "utf8" },
  );

  if (result.error?.code === "ENOENT") {
    throw new Error(
      "Local DATABASE_URL requires psql, but psql was not found. Install PostgreSQL client tools or use web/scripts/apply-schema.ps1 on a machine with psql.",
    );
  }
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout).trim());
  }

  const existingTables = result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const found = new Set(existingTables);
  const missing = REQUIRED_TABLES.filter((table) => !found.has(table));

  console.log(JSON.stringify({
    connected: true,
    driver: "psql",
    requiredTables: REQUIRED_TABLES,
    existingTables,
    missingTables: missing,
  }, null, 2));

  if (missing.length > 0) {
    process.exitCode = 2;
  }
}

async function main() {
  loadDotEnv();

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is missing. Set it in web/.env or the shell.");
  }

  if (isLocalDatabase(databaseUrl)) {
    runPsqlCheck(databaseUrl);
    return;
  }

  const sql = neon(databaseUrl);
  const [connection] = await sql`
    SELECT current_database() AS database_name, current_user AS user_name
  `;
  const rows = await sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = ANY(${REQUIRED_TABLES})
    ORDER BY table_name
  `;

  const found = new Set(rows.map((row) => row.table_name));
  const missing = REQUIRED_TABLES.filter((table) => !found.has(table));

  console.log(JSON.stringify({
    connected: true,
    database: connection.database_name,
    user: connection.user_name,
    requiredTables: REQUIRED_TABLES,
    existingTables: [...found].sort(),
    missingTables: missing,
  }, null, 2));

  if (missing.length > 0) {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error("Database check failed:", error.message);
  process.exitCode = 1;
});
