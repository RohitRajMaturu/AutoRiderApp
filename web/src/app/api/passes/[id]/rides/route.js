import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";
export async function GET(request, { params }) {
  const session = await auth(request);
  if (!session?.user?.id)
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  const rides =
    await sql`SELECT pr.* FROM pass_rides pr JOIN commuter_passes p ON p.id=pr.pass_id LEFT JOIN drivers d ON d.id=p.driver_id WHERE p.id=${params.id} AND (p.passenger_id=${session.user.id} OR d.user_id=${session.user.id} OR ${session.user.role}='admin') ORDER BY pr.scheduled_date DESC`;
  return Response.json({ rides });
}
