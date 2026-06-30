import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";
import { processPassRefund } from "@/app/api/utils/pass-refund";
export async function POST(request, { params }) {
  const session = await auth(request);
  if (!session?.user?.id)
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  const rows =
    await sql`UPDATE commuter_passes SET status='CANCELLED',updated_at=CURRENT_TIMESTAMP WHERE id=${params.id} AND passenger_id=${session.user.id} AND status IN('PENDING_MATCH','ACTIVE','PAUSED') RETURNING *,CASE WHEN start_date>CURRENT_DATE+2 THEN agreed_fare ELSE round(agreed_fare*0.5)::int END AS refund_amount`;
  if (!rows[0])
    return Response.json(
      { error: "Pass cannot be cancelled" },
      { status: 409 },
    );
  const refund = await processPassRefund(rows[0]);
  return Response.json({ pass: rows[0], ...refund });
}
