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

  const rides = await sql`
    SELECT 
      r.*,
      p.phone as passenger_phone,
      p.email as passenger_email,
      d.vehicle_number,
      du.phone as driver_phone
    FROM rides r
    LEFT JOIN auth_users p ON r.passenger_id = p.id
    LEFT JOIN drivers d ON r.driver_id = d.id
    LEFT JOIN auth_users du ON d.user_id = du.id
    ORDER BY r.created_at DESC
    LIMIT 100
  `;

  return Response.json({ rides });
}
