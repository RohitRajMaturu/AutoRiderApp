import sql from "@/app/api/utils/sql";
import {
  institutionError,
  requireInstitutionAccess,
} from "@/app/api/utils/institution-auth";
export async function GET(request, { params }) {
  try {
    await requireInstitutionAccess(request, params.id);
    const trips =
      await sql`SELECT t.*,r.route_name,r.direction,u.name AS driver_name,d.vehicle_number FROM institution_trips t JOIN institution_routes r ON r.id=t.route_id LEFT JOIN drivers d ON d.id=COALESCE(t.reassigned_driver_id,t.driver_id) LEFT JOIN auth_users u ON u.id=d.user_id WHERE t.institution_id=${params.id} AND t.scheduled_date=CURRENT_DATE ORDER BY r.scheduled_time`;
    return Response.json({ trips });
  } catch (error) {
    return institutionError(error);
  }
}
