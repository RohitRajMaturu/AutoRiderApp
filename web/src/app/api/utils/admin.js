import sql from "@/app/api/utils/sql";

export async function requireAdmin(request, auth) {
  const session = await auth(request);
  if (!session?.user?.id) {
    return { response: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const rows = await sql`
    SELECT role FROM auth_users WHERE id = ${session.user.id} LIMIT 1
  `;
  if (rows[0]?.role !== "admin") {
    return { response: Response.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { session };
}

// `admin` is the persisted compatibility value for the platform owner role.
// Use this alias in new global-operations code to distinguish it from an
// institution-scoped administrator.
export const requireSuperAdmin = requireAdmin;

export async function writeAdminAudit(
  actorId,
  action,
  targetType,
  targetId = null,
  metadata = {},
  scopedSql = sql,
) {
  await scopedSql`
    INSERT INTO admin_audit_log (actor_id, action, target_type, target_id, metadata)
    VALUES (${actorId}, ${action}, ${targetType}, ${targetId}, ${JSON.stringify(metadata)}::jsonb)
  `;
}
