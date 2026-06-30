import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";
import { readCoordinate, readDays, readTime } from "@/app/api/utils/phase2";

export async function POST(request) {
  const session = await auth(request);
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const pickup = readCoordinate(body.pickup);
  const dropoff = readCoordinate(body.dropoff);
  const days = readDays(body.preferredDays);
  const time = readTime(body.preferredTime);
  if (!pickup || !dropoff || !days || !time) return Response.json({ error: "Valid route and schedule required" }, { status: 400 });
  const rows = await sql`
    INSERT INTO pass_route_interests (
      passenger_id, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, pickup_label, dropoff_label, preferred_days, preferred_time
    ) VALUES (
      ${session.user.id},
      ${pickup.lat}, ${pickup.lng}, ${dropoff.lat}, ${dropoff.lng},
      ${pickup.label}, ${dropoff.label}, ${days}::text[], ${time}::time
    ) RETURNING *
  `;
  const similar = await sql`
    SELECT count(*)::int AS count FROM pass_route_interests
    WHERE abs(pickup_lat - ${pickup.lat}) < 0.01 AND abs(pickup_lng - ${pickup.lng}) < 0.01
      AND abs(dropoff_lat - ${dropoff.lat}) < 0.01 AND abs(dropoff_lng - ${dropoff.lng}) < 0.01
  `;
  return Response.json({ interest: rows[0], similarPassengers: Math.max(0, Number(similar[0]?.count || 1) - 1) }, { status: 201 });
}
