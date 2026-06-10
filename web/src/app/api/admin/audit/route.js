import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";
import { requireAdmin } from "@/app/api/utils/admin";

export async function GET(request) {
  try {
    const { response } = await requireAdmin(request, auth);
    if (response) return response;

    const logs = await sql`
      SELECT l.*, u.email, u.phone
      FROM admin_audit_log l
      JOIN auth_users u ON u.id = l.actor_id
      ORDER BY l.created_at DESC
      LIMIT 200
    `;

    return Response.json({ logs });
  } catch (err) {
    console.error("GET /api/admin/audit error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
