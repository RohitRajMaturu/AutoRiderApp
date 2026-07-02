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
      1000,
      Math.max(1, Number(url.searchParams.get("limit")) || 500),
    );
    const defaultFrom = new Date();
    defaultFrom.setUTCDate(defaultFrom.getUTCDate() - 30);
    const isDate = (value) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
      const parsed = new Date(`${value}T00:00:00Z`);
      return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
    };
    const dateFrom = isDate(url.searchParams.get("date_from"))
      ? url.searchParams.get("date_from")
      : defaultFrom.toISOString().slice(0, 10);
    const dateTo = isDate(url.searchParams.get("date_to"))
      ? url.searchParams.get("date_to")
      : new Date().toISOString().slice(0, 10);
    const requestedRouteId = url.searchParams.get("route_id");
    const routeId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestedRouteId || "")
      ? requestedRouteId
      : null;
    const requestedStatus = url.searchParams.get("status");
    const attendanceStatus = ["PICKED_UP", "ABSENT", "UNCONFIRMED", "PENDING", "NOT_RECORDED", "CANCELLED"].includes(requestedStatus)
      ? requestedStatus
      : null;
    const trips =
      await sql`SELECT t.*,r.route_name,r.direction,u.name AS driver_name FROM institution_trips t JOIN institution_routes r ON r.id=t.route_id LEFT JOIN drivers d ON d.id=COALESCE(t.reassigned_driver_id,t.driver_id) LEFT JOIN auth_users u ON u.id=d.user_id WHERE t.institution_id=${params.id} AND t.scheduled_date BETWEEN ${dateFrom}::date AND ${dateTo}::date AND (${routeId}::uuid IS NULL OR t.route_id=${routeId}::uuid) ORDER BY t.scheduled_date DESC,r.scheduled_time LIMIT ${limit}`;
    const attendance = await sql`
      SELECT t.id AS trip_id, t.scheduled_date, t.status AS trip_status,
        r.id AS route_id, r.route_name, r.direction, m.id AS member_id,
        m.member_name, u.name AS driver_name,
        CASE
          WHEN t.status = 'CANCELLED' THEN 'CANCELLED'
          WHEN m.id = ANY(t.members_picked_up) THEN 'PICKED_UP'
          WHEN m.id = ANY(t.members_absent) THEN 'ABSENT'
          WHEN m.id = ANY(t.members_unconfirmed) THEN 'UNCONFIRMED'
          WHEN t.status = 'COMPLETED' THEN 'NOT_RECORDED'
          ELSE 'PENDING'
        END AS attendance_status
      FROM institution_trips t
      JOIN institution_routes r ON r.id = t.route_id
      CROSS JOIN LATERAL unnest(t.members_expected) expected(member_id)
      JOIN institution_members m ON m.id = expected.member_id
      LEFT JOIN drivers d ON d.id = COALESCE(t.reassigned_driver_id, t.driver_id)
      LEFT JOIN auth_users u ON u.id = d.user_id
      WHERE t.institution_id = ${params.id}
        AND t.scheduled_date BETWEEN ${dateFrom}::date AND ${dateTo}::date
        AND (${routeId}::uuid IS NULL OR t.route_id = ${routeId}::uuid)
        AND (${attendanceStatus}::text IS NULL OR
          CASE
            WHEN t.status = 'CANCELLED' THEN 'CANCELLED'
            WHEN m.id = ANY(t.members_picked_up) THEN 'PICKED_UP'
            WHEN m.id = ANY(t.members_absent) THEN 'ABSENT'
            WHEN m.id = ANY(t.members_unconfirmed) THEN 'UNCONFIRMED'
            WHEN t.status = 'COMPLETED' THEN 'NOT_RECORDED'
            ELSE 'PENDING'
          END = ${attendanceStatus})
      ORDER BY t.scheduled_date DESC, r.scheduled_time, m.stop_order NULLS LAST, m.member_name
      LIMIT ${limit}
    `;
    return Response.json({ trips, attendance, dateFrom, dateTo });
  } catch (error) {
    return institutionError(error);
  }
}
