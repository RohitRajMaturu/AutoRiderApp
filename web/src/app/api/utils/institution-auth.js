import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

export async function requireInstitutionAdmin(request) {
  const session = await auth(request);
  if (!session?.user?.id) {
    const error = new Error("Unauthorized");
    error.status = 401;
    error.code = "UNAUTHORIZED";
    throw error;
  }
  if (session.user.role !== "institution_admin") {
    const error = new Error("Institution administrator access required");
    error.status = 403;
    error.code = "INSTITUTION_ADMIN_REQUIRED";
    throw error;
  }
  const rows = await sql`
    SELECT i.*
    FROM institution_admin_users ia
    JOIN institutions i ON i.id = ia.institution_id
    WHERE ia.user_id = ${session.user.id}
    LIMIT 1
  `;
  if (!rows[0]) {
    const error = new Error("Institution account is not linked");
    error.status = 403;
    error.code = "INSTITUTION_NOT_LINKED";
    throw error;
  }
  return { session, institution: rows[0] };
}

export function institutionError(error) {
  return Response.json(
    { error: error.message || "Institution request failed", code: error.code || "INSTITUTION_REQUEST_FAILED" },
    { status: error.status || 500 },
  );
}
