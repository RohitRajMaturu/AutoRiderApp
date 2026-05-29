import { auth } from "@/auth";
import sql from "@/app/api/utils/sql";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id)
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  const adminCheck =
    await sql`SELECT role FROM auth_users WHERE id = ${session.user.id}`;
  if (!adminCheck[0] || adminCheck[0].role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const [
    totalRides,
    completedRides,
    cancelledRides,
    requestedRides,
    activeDrivers,
    totalDrivers,
    pendingDrivers,
  ] = await sql.transaction([
    sql`SELECT COUNT(*) as count FROM rides`,
    sql`SELECT COUNT(*) as count FROM rides WHERE status = 'completed'`,
    sql`SELECT COUNT(*) as count FROM rides WHERE status = 'cancelled'`,
    sql`SELECT COUNT(*) as count FROM rides WHERE status IN ('requested', 'accepted')`,
    sql`SELECT COUNT(*) as count FROM drivers WHERE is_online = true AND is_approved = true`,
    sql`SELECT COUNT(*) as count FROM drivers WHERE is_approved = true`,
    sql`SELECT COUNT(*) as count FROM drivers WHERE is_approved = false`,
  ]);

  return Response.json({
    stats: {
      totalRides: parseInt(totalRides[0]?.count || 0),
      completedRides: parseInt(completedRides[0]?.count || 0),
      cancelledRides: parseInt(cancelledRides[0]?.count || 0),
      activeRides: parseInt(requestedRides[0]?.count || 0),
      activeDrivers: parseInt(activeDrivers[0]?.count || 0),
      totalDrivers: parseInt(totalDrivers[0]?.count || 0),
      pendingDrivers: parseInt(pendingDrivers[0]?.count || 0),
    },
  });
}
