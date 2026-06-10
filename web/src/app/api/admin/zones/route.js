import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";
import { requireAdmin, writeAdminAudit } from "@/app/api/utils/admin";
import { readBoundedString } from "@/app/api/utils/validation";

function parseBoundaryGeoJson(value) {
  if (!value || typeof value !== "object") return null;
  if (value.type === "Feature" && value.geometry) return value.geometry;
  if (value.type === "Polygon" || value.type === "MultiPolygon") return value;
  return null;
}

function parseMaxOnlineDrivers(value) {
  const next = Number(value);
  if (!Number.isInteger(next) || next < 1 || next > 500) return null;
  return next;
}

export async function GET(request) {
  try {
    const { response } = await requireAdmin(request, auth);
    if (response) return response;

    const zones = await sql`
      SELECT
        id,
        name,
        max_online_drivers,
        is_active,
        ST_AsGeoJSON(boundary::geometry)::json AS boundary,
        created_at,
        updated_at
      FROM geo_zones
      ORDER BY name ASC
    `;
    return Response.json({ zones });
  } catch (err) {
    console.error("GET /api/admin/zones error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { session, response } = await requireAdmin(request, auth);
    if (response) return response;

    const body = await request.json();
    const name = readBoundedString(body.name, { min: 2, max: 120 });
    const boundary = parseBoundaryGeoJson(body.boundary);
    const maxOnlineDrivers = parseMaxOnlineDrivers(body.max_online_drivers || 25);

    if (!name || !boundary || !maxOnlineDrivers) {
      return Response.json(
        { error: "name, Polygon/MultiPolygon boundary, and max_online_drivers are required" },
        { status: 400 },
      );
    }

    const rows = await sql.transaction(async (tx) => {
      const created = await tx`
        INSERT INTO geo_zones (name, boundary, max_online_drivers, created_by)
        VALUES (
          ${name},
          ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(boundary)}), 4326))::geography,
          ${maxOnlineDrivers},
          ${session.user.id}
        )
        RETURNING id, name, max_online_drivers, is_active, created_at, updated_at
      `;
      await writeAdminAudit(session.user.id, "zone.create", "geo_zone", created[0].id, {
        name,
        max_online_drivers: maxOnlineDrivers,
      }, tx);
      return created;
    });

    return Response.json({ zone: rows[0] }, { status: 201 });
  } catch (err) {
    console.error("POST /api/admin/zones error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const { session, response } = await requireAdmin(request, auth);
    if (response) return response;

    const body = await request.json();
    const zoneId = readBoundedString(body.zone_id, { min: 10, max: 80 });
    const name = body.name === undefined ? null : readBoundedString(body.name, { min: 2, max: 120 });
    const boundary = body.boundary === undefined ? null : parseBoundaryGeoJson(body.boundary);
    const maxOnlineDrivers =
      body.max_online_drivers === undefined ? null : parseMaxOnlineDrivers(body.max_online_drivers);
    const isActive = body.is_active === undefined ? null : Boolean(body.is_active);

    if (!zoneId) {
      return Response.json({ error: "zone_id is required" }, { status: 400 });
    }
    if (
      (body.name !== undefined && !name) ||
      (body.boundary !== undefined && !boundary) ||
      (body.max_online_drivers !== undefined && !maxOnlineDrivers)
    ) {
      return Response.json({ error: "Invalid zone update" }, { status: 400 });
    }

    const rows = await sql.transaction(async (tx) => {
      const updated = boundary
        ? await tx`
            UPDATE geo_zones
            SET name = COALESCE(${name}, name),
                boundary = ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(boundary)}), 4326))::geography,
                max_online_drivers = COALESCE(${maxOnlineDrivers}, max_online_drivers),
                is_active = COALESCE(${isActive}, is_active),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ${zoneId}
            RETURNING id, name, max_online_drivers, is_active, created_at, updated_at
          `
        : await tx`
            UPDATE geo_zones
            SET name = COALESCE(${name}, name),
                max_online_drivers = COALESCE(${maxOnlineDrivers}, max_online_drivers),
                is_active = COALESCE(${isActive}, is_active),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ${zoneId}
            RETURNING id, name, max_online_drivers, is_active, created_at, updated_at
          `;
      if (updated.length > 0) {
        await writeAdminAudit(session.user.id, "zone.update", "geo_zone", updated[0].id, body, tx);
      }
      return updated;
    });

    if (rows.length === 0) {
      return Response.json({ error: "Zone not found" }, { status: 404 });
    }

    return Response.json({ zone: rows[0] });
  } catch (err) {
    console.error("PATCH /api/admin/zones error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
