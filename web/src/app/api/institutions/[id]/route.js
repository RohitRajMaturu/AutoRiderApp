import sql from "@/app/api/utils/sql";
import {
  institutionError,
  requireInstitutionAccess,
} from "@/app/api/utils/institution-auth";

export async function GET(request, { params }) {
  try {
    await requireInstitutionAccess(request, params.id);
    const rows = await sql`
      SELECT i.*,
        (SELECT count(*)::int FROM institution_routes r WHERE r.institution_id=i.id) AS route_count,
        (SELECT count(*)::int FROM institution_members m WHERE m.institution_id=i.id AND m.active=true) AS active_members
      FROM institutions i WHERE i.id=${params.id} LIMIT 1
    `;
    return Response.json({ institution: rows[0] });
  } catch (error) {
    return institutionError(error);
  }
}
