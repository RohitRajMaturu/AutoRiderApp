import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

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
      SELECT d.*, u.email, u.phone 
      FROM drivers d
      JOIN auth_users u ON d.user_id = u.id
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

    const { driver_id, is_approved, subscription_days } = await request.json();
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
    if (is_approved === undefined && subscriptionDays === null) {
      return Response.json(
        { error: "Provide is_approved or subscription_days" },
        { status: 400 },
      );
    }

    const user =
      await sql`SELECT role FROM auth_users WHERE id = ${session.user.id} LIMIT 1`;
    if (user[0]?.role !== "admin") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const rows =
      subscriptionDays === null
        ? await sql`
            UPDATE drivers
            SET is_approved = COALESCE(${is_approved}, is_approved),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ${driver_id}
            RETURNING *
          `
        : await sql`
            UPDATE drivers
            SET is_approved = COALESCE(${is_approved}, is_approved),
                subscription_expiry = CURRENT_TIMESTAMP + make_interval(days => ${subscriptionDays}),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ${driver_id}
            RETURNING *
          `;

    if (rows.length === 0) {
      return Response.json({ error: "Driver not found" }, { status: 404 });
    }

    return Response.json({ driver: rows[0] });
  } catch (err) {
    console.error("PATCH /api/admin/drivers error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
