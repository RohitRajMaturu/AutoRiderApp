import { auth } from "@/auth";
import sql from "@/app/api/utils/sql";
import { writeAdminAudit } from "@/app/api/utils/admin";

function readCancellationReason(value) {
  if (typeof value !== "string") return "admin_cancelled";
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 180) : "admin_cancelled";
}

async function requireAdminSession(request) {
  const session = await auth(request);
  if (!session?.user?.id)
    return { response: Response.json({ error: "Unauthorized" }, { status: 401 }) };

  const adminCheck =
    await sql`SELECT role FROM auth_users WHERE id = ${session.user.id}`;
  if (!adminCheck[0] || adminCheck[0].role !== "admin") {
    return { response: Response.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}

export async function GET(request) {
  const { response } = await requireAdminSession(request);
  if (response) return response;

  const searchParams = new URL(request.url).searchParams;
  const allowedStatuses = new Set(["requested", "negotiating", "accepted", "completed", "cancelled"]);
  const allowedSorts = new Set(["newest", "oldest", "fare_high", "fare_low"]);
  const requestedStatus = searchParams.get("status") || "all";
  const status = allowedStatuses.has(requestedStatus) ? requestedStatus : "all";
  const requestedSort = searchParams.get("sort") || "newest";
  const sort = allowedSorts.has(requestedSort) ? requestedSort : "newest";
  const search = String(searchParams.get("search") || "").trim().slice(0, 100);
  const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10) || 1);
  const pageSize = Math.min(
    50,
    Math.max(10, Number.parseInt(searchParams.get("pageSize") || "20", 10) || 20),
  );
  const offset = (page - 1) * pageSize;

  const countRows = await sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE r.status = 'requested')::int AS requested,
      COUNT(*) FILTER (WHERE r.status = 'negotiating')::int AS negotiating,
      COUNT(*) FILTER (WHERE r.status = 'accepted')::int AS accepted,
      COUNT(*) FILTER (WHERE r.status = 'completed')::int AS completed,
      COUNT(*) FILTER (WHERE r.status = 'cancelled')::int AS cancelled
    FROM rides r
    LEFT JOIN auth_users p ON r.passenger_id = p.id
    LEFT JOIN drivers d ON r.driver_id = d.id
    LEFT JOIN auth_users du ON d.user_id = du.id
    WHERE (
      ${search} = ''
      OR r.id::text ILIKE ${`%${search}%`}
      OR r.pickup_address ILIKE ${`%${search}%`}
      OR r.dest_address ILIKE ${`%${search}%`}
      OR p.phone ILIKE ${`%${search}%`}
      OR d.vehicle_number ILIKE ${`%${search}%`}
      OR du.phone ILIKE ${`%${search}%`}
    )
  `;
  const counts = countRows[0] || {};
  const filteredTotal =
    status === "all" ? Number(counts.total || 0) : Number(counts[status] || 0);

  const rides = await sql`
    SELECT 
      r.*,
      p.phone as passenger_phone,
      p.email as passenger_email,
      d.vehicle_number,
      du.phone as driver_phone
    FROM rides r
    LEFT JOIN auth_users p ON r.passenger_id = p.id
    LEFT JOIN drivers d ON r.driver_id = d.id
    LEFT JOIN auth_users du ON d.user_id = du.id
    WHERE (${status} = 'all' OR r.status = ${status})
      AND (
        ${search} = ''
        OR r.id::text ILIKE ${`%${search}%`}
        OR r.pickup_address ILIKE ${`%${search}%`}
        OR r.dest_address ILIKE ${`%${search}%`}
        OR p.phone ILIKE ${`%${search}%`}
        OR d.vehicle_number ILIKE ${`%${search}%`}
        OR du.phone ILIKE ${`%${search}%`}
      )
    ORDER BY
      CASE WHEN ${sort} = 'oldest' THEN r.created_at END ASC,
      CASE WHEN ${sort} = 'fare_high' THEN COALESCE(r.final_fare, r.estimated_fare, 0) END DESC,
      CASE WHEN ${sort} = 'fare_low' THEN COALESCE(r.final_fare, r.estimated_fare, 0) END ASC,
      CASE WHEN ${sort} = 'newest' THEN r.created_at END DESC,
      r.created_at DESC
    LIMIT ${pageSize}
    OFFSET ${offset}
  `;

  return Response.json({
    rides,
    counts: {
      all: Number(counts.total || 0),
      requested: Number(counts.requested || 0),
      negotiating: Number(counts.negotiating || 0),
      accepted: Number(counts.accepted || 0),
      completed: Number(counts.completed || 0),
      cancelled: Number(counts.cancelled || 0),
    },
    pagination: {
      page,
      pageSize,
      total: filteredTotal,
      totalPages: Math.max(1, Math.ceil(filteredTotal / pageSize)),
    },
    filters: { status, sort, search },
  });
}

export async function PATCH(request) {
  try {
    const { session, response } = await requireAdminSession(request);
    if (response) return response;

    const { ride_id, action, reason } = await request.json();
    const cancellationReason = readCancellationReason(reason);
    if (typeof ride_id !== "string" || !ride_id.trim() || action !== "cancel") {
      return Response.json(
        { error: "ride_id and action=cancel are required" },
        { status: 400 },
      );
    }

    const rows = await sql.transaction(async (tx) => {
      const updated = await tx`
        UPDATE rides
        SET status = 'cancelled',
            cancelled_at = CURRENT_TIMESTAMP,
            cancellation_reason = ${cancellationReason},
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${ride_id}
          AND status IN ('requested', 'accepted')
        RETURNING *
      `;
      if (updated.length > 0) {
        await tx`
          UPDATE ride_driver_notifications
          SET status = 'skipped',
              error = ${`Ride cancelled: ${cancellationReason}`},
              delivered_at = COALESCE(delivered_at, CURRENT_TIMESTAMP)
          WHERE ride_id = ${ride_id}
            AND status IN ('pending', 'failed', 'sent')
        `;
        await writeAdminAudit(session.user.id, "ride.cancel", "ride", updated[0].id, {
          reason: cancellationReason,
        }, tx);
      }
      return updated;
    });

    if (rows.length === 0) {
      return Response.json(
        { error: "Ride not found or already closed" },
        { status: 404 },
      );
    }

    return Response.json({ ride: rows[0] });
  } catch (err) {
    console.error("PATCH /api/admin/rides error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
