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

function parsePositiveInt(value, fallback, { min = 1, max = 100 } = {}) {
  const next = Number.parseInt(value || "", 10);
  if (!Number.isFinite(next)) return fallback;
  return Math.min(Math.max(next, min), max);
}

export async function GET(request) {
  try {
    const { response } = await requireAdmin(request, auth);
    if (response) return response;

    const url = new URL(request.url);
    const page = parsePositiveInt(url.searchParams.get("page"), 1, { min: 1, max: 100000 });
    const pageSize = parsePositiveInt(url.searchParams.get("pageSize"), 20, { min: 5, max: 100 });
    const offset = (page - 1) * pageSize;
    const search = readBoundedString(url.searchParams.get("search") || "", { min: 0, max: 120 }) || "";
    const searchPattern = `%${search}%`;
    const sort = url.searchParams.get("sort") || "name";
    const direction = url.searchParams.get("direction") === "desc" ? "DESC" : "ASC";
    const orderBy =
      sort === "created_at"
        ? `created_at ${direction}, name ASC`
        : sort === "status"
          ? `is_active ${direction}, name ASC`
          : sort === "drivers"
            ? `max_online_drivers ${direction}, name ASC`
            : `name ${direction}`;

    const [countRow] = await sql`
      SELECT COUNT(*)::int AS total
      FROM geo_zones
      WHERE ${search === ""} OR name ILIKE ${searchPattern}
    `;

    const zones = await sql(
      `
      SELECT
        id,
        name,
        max_online_drivers,
        is_active,
        ST_AsGeoJSON(boundary::geometry)::json AS boundary,
        created_at,
        updated_at
      FROM geo_zones
      WHERE $1 OR name ILIKE $2
      ORDER BY ${orderBy}
      LIMIT $3 OFFSET $4
      `,
      [search === "", searchPattern, pageSize, offset],
    );
    return Response.json({
      zones,
      pagination: {
        page,
        pageSize,
        total: countRow?.total || 0,
        totalPages: Math.max(Math.ceil((countRow?.total || 0) / pageSize), 1),
      },
      sort: { field: sort, direction: direction.toLowerCase() },
      search,
    });
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

export async function DELETE(request) {
  try {
    const { session, response } = await requireAdmin(request, auth);
    if (response) return response;

    const body = await request.json().catch(() => ({}));
    const zoneId =
      readBoundedString(body.zone_id, { min: 10, max: 80 }) ||
      readBoundedString(new URL(request.url).searchParams.get("zone_id"), { min: 10, max: 80 });

    if (!zoneId) {
      return Response.json({ error: "zone_id is required" }, { status: 400 });
    }

    const rows = await sql.transaction(async (tx) => {
      const deleted = await tx`
        DELETE FROM geo_zones
        WHERE id = ${zoneId}
        RETURNING id, name, max_online_drivers, is_active
      `;
      if (deleted.length > 0) {
        await writeAdminAudit(session.user.id, "zone.delete", "geo_zone", deleted[0].id, {
          name: deleted[0].name,
        }, tx);
      }
      return deleted;
    });

    if (rows.length === 0) {
      return Response.json({ error: "Zone not found" }, { status: 404 });
    }

    return Response.json({ zone: rows[0] });
  } catch (err) {
    console.error("DELETE /api/admin/zones error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
