import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = resolve(__dirname, "..");
const apply = process.argv.includes("--apply");
const MAX_TIME_GAP_MINUTES = 120;

function loadDotEnv() {
  try {
    const contents = readFileSync(resolve(WEB_ROOT, ".env"), "utf8");
    for (const line of contents.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separator = trimmed.indexOf("=");
      if (separator < 1) continue;
      const key = trimmed.slice(0, separator).trim();
      const value = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // DATABASE_URL may be supplied by the shell.
  }
}

function indiaDate() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function minutes(value) {
  const [hour, minute] = String(value || "").slice(0, 5).split(":").map(Number);
  return hour * 60 + minute;
}

function overlaps(a, b) {
  return a.start_date <= b.end_date
    && b.start_date <= a.end_date
    && a.scheduled_days.some((day) => b.scheduled_days.includes(day))
    && Math.abs(minutes(a.scheduled_time) - minutes(b.scheduled_time)) <= MAX_TIME_GAP_MINUTES;
}

function strength(pass) {
  const status = { ACTIVE: 300, PAUSED: 200, PENDING_MATCH: 100 }[pass.status] || 0;
  const payment = pass.payment_status === "PAID" ? 50 : 0;
  const assigned = pass.driver_id ? 25 : 0;
  const rides = Number(pass.completed_rides || 0) * 20 + Number(pass.ride_count || 0);
  return status + payment + assigned + rides;
}

function duplicateGroups(rows) {
  const groups = [];
  const byPassenger = new Map();
  for (const row of rows) {
    if (!byPassenger.has(row.passenger_id)) byPassenger.set(row.passenger_id, []);
    byPassenger.get(row.passenger_id).push(row);
  }
  for (const passengerRows of byPassenger.values()) {
    const unseen = new Set(passengerRows.map((row) => row.id));
    while (unseen.size) {
      const firstId = unseen.values().next().value;
      const component = [];
      const queue = [passengerRows.find((row) => row.id === firstId)];
      unseen.delete(firstId);
      while (queue.length) {
        const current = queue.shift();
        component.push(current);
        for (const candidate of passengerRows) {
          if (unseen.has(candidate.id) && overlaps(current, candidate)) {
            unseen.delete(candidate.id);
            queue.push(candidate);
          }
        }
      }
      if (component.length > 1) {
        component.sort((a, b) => strength(b) - strength(a) || new Date(b.created_at) - new Date(a.created_at));
        groups.push({ keep: component[0], cancel: component.slice(1) });
      }
    }
  }
  return groups;
}

async function main() {
  loadDotEnv();
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is missing");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    const today = indiaDate();
    const result = await client.query(`
      SELECT p.id, p.passenger_id, p.driver_id, p.pickup_label, p.dropoff_label,
        p.scheduled_days, p.scheduled_time::text, p.start_date::text, p.end_date::text,
        p.status, p.payment_status, p.created_at,
        count(pr.id)::int AS ride_count,
        count(pr.id) FILTER (WHERE pr.status = 'COMPLETED')::int AS completed_rides
      FROM commuter_passes p
      LEFT JOIN pass_rides pr ON pr.pass_id = p.id
      WHERE p.status IN ('PENDING_MATCH', 'ACTIVE', 'PAUSED')
      GROUP BY p.id
      ORDER BY p.passenger_id, p.created_at DESC
    `);
    const stale = result.rows.filter((row) => row.end_date < today);
    const current = result.rows.filter((row) => row.end_date >= today);
    const groups = duplicateGroups(current);
    const cancel = groups.flatMap((group) => group.cancel);
    const paidCancellations = cancel.filter((pass) => pass.payment_status === "PAID");

    const summary = {
      mode: apply ? "apply" : "audit",
      today,
      stale: stale.map((pass) => ({ id: pass.id, route: `${pass.pickup_label} -> ${pass.dropoff_label}`, status: pass.status })),
      duplicateGroups: groups.map((group) => ({
        keep: { id: group.keep.id, route: `${group.keep.pickup_label} -> ${group.keep.dropoff_label}`, status: group.keep.status, payment: group.keep.payment_status },
        cancel: group.cancel.map((pass) => ({ id: pass.id, route: `${pass.pickup_label} -> ${pass.dropoff_label}`, status: pass.status, payment: pass.payment_status })),
      })),
      paidCancellationsRequiringReview: paidCancellations.map((pass) => pass.id),
    };
    console.log(JSON.stringify(summary, null, 2));
    if (!apply) return;
    if (paidCancellations.length) throw new Error("Refusing automatic cleanup because a duplicate selected for cancellation is PAID");

    await client.query("BEGIN");
    if (stale.length) {
      await client.query(
        "UPDATE commuter_passes SET status = 'EXPIRED', updated_at = CURRENT_TIMESTAMP WHERE id = ANY($1::uuid[])",
        [stale.map((pass) => pass.id)],
      );
    }
    if (cancel.length) {
      await client.query(
        "UPDATE commuter_passes SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP WHERE id = ANY($1::uuid[])",
        [cancel.map((pass) => pass.id)],
      );
    }
    await client.query("COMMIT");
    console.log(JSON.stringify({ applied: true, expired: stale.length, cancelledDuplicates: cancel.length }, null, 2));
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Pass cleanup failed:", error.message);
  process.exitCode = 1;
});
