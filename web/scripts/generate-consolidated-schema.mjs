import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = resolve(__dirname, "..");
const MIGRATIONS_DIR = resolve(WEB_ROOT, "db", "migrations");
const OUTPUT_FILE = resolve(WEB_ROOT, "db", "autoride_full_schema.sql");

const files = readdirSync(MIGRATIONS_DIR)
  .filter((file) => file.endsWith(".sql"))
  .sort();

const header = [
  "-- TukTukGo consolidated database schema",
  "-- Generated from web/db/migrations in filename order.",
  "-- Intended for fresh database setup. For existing databases, prefer npm run db:migrate.",
  "",
].join("\n");

const body = files
  .map((file) => {
    const sql = readFileSync(resolve(MIGRATIONS_DIR, file), "utf8").trim();
    return [`-- =========================================================================`, `-- ${file}`, `-- =========================================================================`, sql, ""].join("\n");
  })
  .join("\n");

writeFileSync(OUTPUT_FILE, `${header}${body}`, "utf8");
console.log(`Wrote ${OUTPUT_FILE}`);
