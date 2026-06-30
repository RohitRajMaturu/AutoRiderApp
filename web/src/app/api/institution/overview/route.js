import sql from "@/app/api/utils/sql";
import { institutionError, requireInstitutionAdmin } from "@/app/api/utils/institution-auth";

export async function GET(request) {
  try {
    const { institution } = await requireInstitutionAdmin(request);
    const trips = await sql`
      SELECT t.*, r.route_name, r.direction, r.max_capacity,
        u.name AS driver_name, d.vehicle_number,
        cardinality(t.members_picked_up) AS picked_up_count,
        cardinality(t.members_expected) AS expected_count
      FROM institution_trips t
      JOIN institution_routes r ON r.id = t.route_id
      LEFT JOIN drivers d ON d.id = COALESCE(t.reassigned_driver_id, t.driver_id)
      LEFT JOIN auth_users u ON u.id = d.user_id
      WHERE t.institution_id = ${institution.id} AND t.scheduled_date = CURRENT_DATE
      ORDER BY r.scheduled_time
    `;
    const stats = trips.reduce((result, trip) => {
      result.total += 1;
      result[trip.status.toLowerCase()] = (result[trip.status.toLowerCase()] || 0) + 1;
      result.studentsTransported += Number(trip.picked_up_count || 0);
      return result;
    }, { total: 0, scheduled: 0, in_progress: 0, completed: 0, cancelled: 0, studentsTransported: 0 });
    return Response.json({ institution, trips, stats });
  } catch (error) {
    return institutionError(error);
  }
}
