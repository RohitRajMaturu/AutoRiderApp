import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

export async function GET(request) {
  const session = await auth(request);
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await sql`
    SELECT p.*, u.name AS passenger_name,
      COALESCE((SELECT count(*)::int FROM pass_rides pr WHERE pr.pass_id = p.id AND pr.status = 'COMPLETED'), 0) AS completed_rides,
      COALESCE((SELECT count(*)::int FROM pass_rides pr WHERE pr.pass_id = p.id), 0) AS total_rides
    FROM commuter_passes p
    JOIN drivers d ON d.id = p.driver_id
    JOIN auth_users u ON u.id = p.passenger_id
    WHERE d.user_id = ${session.user.id} AND p.status IN ('ACTIVE', 'PAUSED')
    ORDER BY p.scheduled_time, p.created_at
  `;
  return Response.json({ passes: rows });
}
