import crypto from "node:crypto";
import sql from "@/app/api/utils/sql";
import { dispatchRideRequest } from "@/app/api/utils/dispatch";

function authorized(request) {
  const expected = process.env.CRON_SECRET || "";
  const supplied = request.headers.get("authorization") || "";
  if (!expected || !supplied.startsWith("Bearer ")) return false;
  const token = supplied.slice(7);
  if (token.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}

export async function POST(request) {
  if (!authorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const rides = await sql`
      SELECT *
      FROM rides
      WHERE status = 'requested'
        AND scheduled_for IS NOT NULL
        AND scheduled_for <= CURRENT_TIMESTAMP + INTERVAL '30 minutes'
        AND scheduled_for > CURRENT_TIMESTAMP - INTERVAL '5 minutes'
      ORDER BY scheduled_for ASC
      LIMIT 20
    `;
    let dispatched = 0;
    for (const ride of rides) {
      dispatched += await dispatchRideRequest(ride);
    }
    return Response.json({ processed: rides.length, dispatched });
  } catch (err) {
    console.error("POST /api/rides/dispatch-scheduled error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
