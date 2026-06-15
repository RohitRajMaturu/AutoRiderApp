import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";
import { writeAdminAudit } from "@/app/api/utils/admin";

function parseSubscriptionDays(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const days = Number(value);
  if (!Number.isInteger(days) || days < 1 || days > 365) {
    return undefined;
  }
  return days;
}

async function runTransaction(callback) {
  if (typeof sql.transaction === "function") {
    return sql.transaction(callback);
  }
  return callback(sql);
}

export async function GET(request) {
  try {
    const session = await auth(request);
    if (!session || !session.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user =
      await sql`SELECT role FROM auth_users WHERE id = ${session.user.id} LIMIT 1`;
    if (user[0]?.role !== "admin") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const drivers = await sql`
      SELECT
        d.*,
        u.email,
        u.phone,
        ROUND(AVG(r.driver_rating) FILTER (
          WHERE r.completed_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'
        )::numeric, 1) as avg_driver_rating_30d,
        COUNT(DISTINCT CASE WHEN r2.status = 'completed' THEN r2.id END) as completed_rides_count,
        COUNT(DISTINCT CASE WHEN r2.status = 'completed'
          AND r2.completed_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'
          THEN r2.id END) as completed_rides_30d
      FROM drivers d
      JOIN auth_users u ON d.user_id = u.id
      LEFT JOIN rides r ON r.driver_id = d.id AND r.driver_rating IS NOT NULL
      LEFT JOIN rides r2 ON r2.driver_id = d.id
      GROUP BY d.id, u.email, u.phone
      ORDER BY d.created_at DESC
    `;

    return Response.json({ drivers });
  } catch (err) {
    console.error("GET /api/admin/drivers error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const session = await auth(request);
    if (!session || !session.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { driver_id, is_approved, subscription_days, force_offline } =
      await request.json();
    const subscriptionDays = parseSubscriptionDays(subscription_days);

    if (typeof driver_id !== "string" || !driver_id.trim()) {
      return Response.json({ error: "driver_id is required" }, { status: 400 });
    }
    if (is_approved !== undefined && typeof is_approved !== "boolean") {
      return Response.json(
        { error: "is_approved must be a boolean when provided" },
        { status: 400 },
      );
    }
    if (subscriptionDays === undefined) {
      return Response.json(
        { error: "subscription_days must be an integer between 1 and 365" },
        { status: 400 },
      );
    }
    if (force_offline !== undefined && force_offline !== true) {
      return Response.json(
        { error: "force_offline must be true when provided" },
        { status: 400 },
      );
    }
    if (
      is_approved === undefined &&
      subscriptionDays === null &&
      force_offline !== true
    ) {
      return Response.json(
        { error: "Provide is_approved, subscription_days, or force_offline" },
        { status: 400 },
      );
    }

    const user =
      await sql`SELECT role FROM auth_users WHERE id = ${session.user.id} LIMIT 1`;
    if (user[0]?.role !== "admin") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const rows = await runTransaction(async (tx) => {
      const updated =
        force_offline === true
          ? await tx`
              UPDATE drivers
              SET is_online = false,
                  online_since = NULL,
                  updated_at = CURRENT_TIMESTAMP
              WHERE id = ${driver_id}
              RETURNING *
            `
          : subscriptionDays === null
            ? await tx`
              UPDATE drivers
              SET is_approved = COALESCE(${is_approved}, is_approved),
                  is_online = CASE WHEN ${is_approved} = false THEN false ELSE is_online END,
                  online_since = CASE WHEN ${is_approved} = false THEN NULL ELSE online_since END,
                  updated_at = CURRENT_TIMESTAMP
              WHERE id = ${driver_id}
              RETURNING *
            `
            : await tx`
              UPDATE drivers
              SET is_approved = COALESCE(${is_approved}, is_approved),
                  subscription_expiry = CURRENT_TIMESTAMP + make_interval(days => ${subscriptionDays}),
                  updated_at = CURRENT_TIMESTAMP
              WHERE id = ${driver_id}
              RETURNING *
            `;

      if (updated.length > 0) {
        await writeAdminAudit(
          session.user.id,
          force_offline === true ? "driver.force_offline" : "driver.update",
          "driver",
          updated[0].id,
          force_offline === true
            ? { force_offline: true }
            : {
                is_approved,
                subscription_days: subscriptionDays,
              },
          tx,
        );
      }
      return updated;
    });

    if (rows.length === 0) {
      return Response.json({ error: "Driver not found" }, { status: 404 });
    }

    return Response.json({ driver: rows[0] });
  } catch (err) {
    console.error("PATCH /api/admin/drivers error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
