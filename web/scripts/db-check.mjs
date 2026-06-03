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

    const found = new Set(tables.rows.map((row) => row.table_name));
    const missing = REQUIRED_TABLES.filter((table) => !found.has(table));

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
        },
        null,
        2,
      ),
    );

    if (missing.length > 0) {
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
