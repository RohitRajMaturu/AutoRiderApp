import { readdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = resolve(__dirname, "..");
const MIGRATIONS_DIR = resolve(WEB_ROOT, "db", "migrations");

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

function splitSqlStatements(sqlText) {
  return sqlText
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
}

function isLocalDatabase(url) {
  return /localhost|127\.0\.0\.1/i.test(url);
}

function runPsqlMigration(databaseUrl, filePath) {
  const result = spawnSync(
    "psql",
    [databaseUrl, "-v", "ON_ERROR_STOP=1", "-f", filePath],
    { encoding: "utf8" },
  );

  if (result.error?.code === "ENOENT") {
    throw new Error(
      "Local DATABASE_URL requires psql, but psql was not found. Install PostgreSQL client tools or run web/scripts/apply-schema.ps1 on a machine with psql.",
    );
  }
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout).trim());
  }

  process.stdout.write(result.stdout);
}

async function main() {
  loadDotEnv();

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is missing. Set it in web/.env or the shell.");
  }

  const sql = neon(databaseUrl);
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    console.log("No migration files found.");
    return;
  }

  for (const file of files) {
    const fullPath = resolve(MIGRATIONS_DIR, file);
    if (isLocalDatabase(databaseUrl)) {
      console.log(`Applying ${file} with psql`);
      runPsqlMigration(databaseUrl, fullPath);
      continue;
    }

    const statements = splitSqlStatements(readFileSync(fullPath, "utf8"));
    console.log(`Applying ${file} (${statements.length} statements)`);
    for (const statement of statements) {
      await sql(statement);
    }
  }

  console.log("Database migrations completed.");
}

main().catch((error) => {
  console.error("Database migration failed:", error.message);
  process.exitCode = 1;
});
