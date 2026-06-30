import sql from "@/app/api/utils/sql";
import {
  institutionError,
  requireInstitutionAccess,
} from "@/app/api/utils/institution-auth";
export async function GET(request, { params }) {
  try {
    await requireInstitutionAccess(request, params.id);
    const url = new URL(request.url);
    const limit = Math.min(
      100,
      Math.max(1, Number(url.searchParams.get("limit")) || 30),
    );
    const trips =
      await sql`SELECT t.*,r.route_name,r.direction,u.name AS driver_name FROM institution_trips t JOIN institution_routes r ON r.id=t.route_id LEFT JOIN drivers d ON d.id=COALESCE(t.reassigned_driver_id,t.driver_id) LEFT JOIN auth_users u ON u.id=d.user_id WHERE t.institution_id=${params.id} ORDER BY t.scheduled_date DESC,r.scheduled_time LIMIT ${limit}`;
    return Response.json({ trips });
  } catch (error) {
    return institutionError(error);
  }
}
