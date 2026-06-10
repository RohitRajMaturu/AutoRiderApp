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

async function main() {
  loadDotEnv();
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing. Set it in web/.env or the shell.");
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const result = await pool.query(`
      SELECT name, installed_version, default_version
      FROM pg_available_extensions
      WHERE name IN ('postgis', 'postgis_topology')
      ORDER BY name
    `);
    console.log(JSON.stringify({ postgisAvailable: result.rows }, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("PostGIS check failed:", error.message);
  process.exitCode = 1;
});
