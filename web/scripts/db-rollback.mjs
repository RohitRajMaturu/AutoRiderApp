import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const names = process.argv.slice(2);
if (!names.length || names.some((name) => !/^[a-zA-Z0-9_.-]+\.sql$/.test(name))) {
  throw new Error("Provide one or more rollback SQL filenames");
}
try {
  const env = readFileSync(resolve(root, ".env"), "utf8");
  for (const line of env.split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match && !process.env[match[1].trim()]) process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, "");
  }
} catch { /* external environment is supported */ }
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is missing");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
  await client.query("BEGIN");
  for (const name of names) {
    const migration = readFileSync(resolve(root, "db", "rollbacks", name), "utf8");
    await client.query(migration);
    console.log(`Rolled back ${name}`);
  }
  await client.query("COMMIT");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
