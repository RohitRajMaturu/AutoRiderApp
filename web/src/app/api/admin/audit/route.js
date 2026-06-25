import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";
import { requireAdmin } from "@/app/api/utils/admin";

export async function GET(request) {
  try {
    const { response } = await requireAdmin(request, auth);
    if (response) return response;

    const url = new URL(request.url);
    const page = Math.max(1, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1);
    const pageSize = Math.min(
      50,
      Math.max(10, Number.parseInt(url.searchParams.get("pageSize") || "20", 10) || 20),
    );
    const offset = (page - 1) * pageSize;
    const search = String(url.searchParams.get("search") || "").trim().slice(0, 100);
    const category = ["zone", "driver", "ride"].includes(url.searchParams.get("category"))
      ? url.searchParams.get("category")
      : "all";
    const sort = url.searchParams.get("sort") === "oldest" ? "oldest" : "newest";
    const searchPattern = `%${search}%`;

    const [countRow] = await sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE l.action LIKE 'zone.%')::int AS zone,
        COUNT(*) FILTER (
          WHERE l.action LIKE 'driver.%' OR l.action LIKE 'driver_kyc.%'
        )::int AS driver,
        COUNT(*) FILTER (WHERE l.action LIKE 'ride.%')::int AS ride
      FROM admin_audit_log l
      JOIN auth_users u ON u.id = l.actor_id
      WHERE (
        ${search} = ''
        OR l.action ILIKE ${searchPattern}
        OR l.target_type ILIKE ${searchPattern}
        OR COALESCE(l.target_id, '') ILIKE ${searchPattern}
        OR COALESCE(u.email, '') ILIKE ${searchPattern}
        OR COALESCE(u.phone, '') ILIKE ${searchPattern}
        OR l.metadata::text ILIKE ${searchPattern}
      )
    `;

    const logs = await sql`
      SELECT l.*, u.email, u.phone
      FROM admin_audit_log l
      JOIN auth_users u ON u.id = l.actor_id
      WHERE (
        ${category} = 'all'
        OR (${category} = 'zone' AND l.action LIKE 'zone.%')
        OR (
          ${category} = 'driver'
          AND (l.action LIKE 'driver.%' OR l.action LIKE 'driver_kyc.%')
        )
        OR (${category} = 'ride' AND l.action LIKE 'ride.%')
      )
        AND (
          ${search} = ''
          OR l.action ILIKE ${searchPattern}
          OR l.target_type ILIKE ${searchPattern}
          OR COALESCE(l.target_id, '') ILIKE ${searchPattern}
          OR COALESCE(u.email, '') ILIKE ${searchPattern}
          OR COALESCE(u.phone, '') ILIKE ${searchPattern}
          OR l.metadata::text ILIKE ${searchPattern}
        )
      ORDER BY
        CASE WHEN ${sort} = 'oldest' THEN l.created_at END ASC,
        CASE WHEN ${sort} = 'newest' THEN l.created_at END DESC,
        l.created_at DESC
      LIMIT ${pageSize}
      OFFSET ${offset}
    `;

    const counts = {
      all: Number(countRow?.total || 0),
      zone: Number(countRow?.zone || 0),
      driver: Number(countRow?.driver || 0),
      ride: Number(countRow?.ride || 0),
    };
    const total = category === "all" ? counts.all : counts[category];

    return Response.json({
      logs,
      counts,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
      filters: { search, category, sort },
    });
  } catch (err) {
    console.error("GET /api/admin/audit error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
