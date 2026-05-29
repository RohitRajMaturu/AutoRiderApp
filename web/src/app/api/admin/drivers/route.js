import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

export async function GET() {
  try {
    const session = await auth();
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
    const session = await auth();
    const { driver_id, is_approved, subscription_days } = await request.json();

    const user =
      await sql`SELECT role FROM auth_users WHERE id = ${session.user.id} LIMIT 1`;
    if (user[0]?.role !== "admin") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    let expiryUpdate = "";
    if (subscription_days) {
      expiryUpdate = `, subscription_expiry = CURRENT_TIMESTAMP + INTERVAL '${subscription_days} days'`;
    }

    const query = `
      UPDATE drivers 
      SET is_approved = $1
      ${expiryUpdate}
      WHERE id = $2
      RETURNING *
    `;

    const rows = await sql(query, [is_approved, driver_id]);

    return Response.json({ driver: rows[0] });
  } catch (err) {
    console.error("PATCH /api/admin/drivers error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
