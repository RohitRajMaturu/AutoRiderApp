import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";
export async function POST(request, { params }) {
  const session = await auth(request);
  if (!session?.user?.id)
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(body.startDate || "") ||
    !/^\d{4}-\d{2}-\d{2}$/.test(body.endDate || "")
  )
    return Response.json(
      { error: "Pause startDate and endDate are required" },
      { status: 400 },
    );
  const rows =
    await sql`UPDATE commuter_passes SET status='PAUSED',pause_start_date=${body.startDate}::date,pause_end_date=${body.endDate}::date,updated_at=CURRENT_TIMESTAMP WHERE id=${params.id} AND passenger_id=${session.user.id} AND status='ACTIVE' AND ${body.endDate}::date>=${body.startDate}::date RETURNING *`;
  if (!rows[0])
    return Response.json(
      { error: "Only an active pass can be paused with valid dates" },
      { status: 409 },
    );
  return Response.json({ pass: rows[0] });
}
