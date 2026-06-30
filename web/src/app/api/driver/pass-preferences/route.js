import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";
import { VALID_SHIFTS } from "@/app/api/utils/phase2";

async function driverForUser(userId) {
  const rows = await sql`SELECT id FROM drivers WHERE user_id = ${userId} LIMIT 1`;
  return rows[0];
}

export async function GET(request) {
  const session = await auth(request);
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const driver = await driverForUser(session.user.id);
  if (!driver) return Response.json({ error: "Driver profile required" }, { status: 404 });
  const rows = await sql`
    SELECT *, preferred_zone_lat AS preferred_lat, preferred_zone_lng AS preferred_lng
    FROM driver_pass_preferences WHERE driver_id = ${driver.id}
  `;
  return Response.json({ preferences: rows[0] || null });
}

export async function POST(request) {
  const session = await auth(request);
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const driver = await driverForUser(session.user.id);
  if (!driver) return Response.json({ error: "Driver profile required" }, { status: 404 });
  const body = await request.json();
  const shift = VALID_SHIFTS.has(body.preferredShift) ? body.preferredShift : null;
  const maxActivePasses = Number(body.maxActivePasses);
  const radiusKm = Number(body.preferredZoneRadiusKm);
  const lat = Number(body.preferredLat);
  const lng = Number(body.preferredLng);
  if (!shift || !Number.isInteger(maxActivePasses) || maxActivePasses < 1 || maxActivePasses > 3 || !Number.isFinite(radiusKm) || radiusKm < 1 || radiusKm > 30) {
    return Response.json({ error: "Invalid subscription preferences" }, { status: 400 });
  }
  const hasZone = Number.isFinite(lat) && Number.isFinite(lng);
  const rows = await sql`
    INSERT INTO driver_pass_preferences (
      driver_id, accepts_pass_subscriptions, preferred_shift, preferred_zone_lat, preferred_zone_lng,
      preferred_zone_radius_km, max_active_passes, updated_at
    ) VALUES (
      ${driver.id}, ${Boolean(body.acceptsPassSubscriptions)}, ${shift},
      ${hasZone ? lat : null}, ${hasZone ? lng : null},
      ${Math.round(radiusKm)}, ${maxActivePasses}, CURRENT_TIMESTAMP
    )
    ON CONFLICT (driver_id) DO UPDATE SET
      accepts_pass_subscriptions = EXCLUDED.accepts_pass_subscriptions,
      preferred_shift = EXCLUDED.preferred_shift,
      preferred_zone_lat = EXCLUDED.preferred_zone_lat,
      preferred_zone_lng = EXCLUDED.preferred_zone_lng,
      preferred_zone_radius_km = EXCLUDED.preferred_zone_radius_km,
      max_active_passes = EXCLUDED.max_active_passes,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *
  `;
  return Response.json({ preferences: rows[0] });
}
