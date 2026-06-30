import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";
import { processPassRefund } from "@/app/api/utils/pass-refund";

export async function GET(request, { params }) {
  const session = await auth(request);
  if (!session?.user?.id)
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await sql`
    SELECT p.*, u.name AS driver_name, u.image AS driver_image, d.vehicle_number,
      passenger.name AS passenger_name,
      COALESCE((SELECT json_agg(pr ORDER BY pr.scheduled_date) FROM pass_rides pr WHERE pr.pass_id = p.id), '[]'::json) AS rides
    FROM commuter_passes p
    LEFT JOIN drivers d ON d.id = p.driver_id
    LEFT JOIN auth_users u ON u.id = d.user_id
    JOIN auth_users passenger ON passenger.id = p.passenger_id
    WHERE p.id = ${params.id}
      AND (p.passenger_id = ${session.user.id} OR d.user_id = ${session.user.id} OR ${session.user.role} = 'admin')
    LIMIT 1
  `;
  if (!rows[0])
    return Response.json({ error: "Pass not found" }, { status: 404 });
  return Response.json({ pass: rows[0] });
}

export async function PATCH(request, { params }) {
  const session = await auth(request);
  if (!session?.user?.id)
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  if (body.action === "pause") {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(body.startDate || "") ||
      !/^\d{4}-\d{2}-\d{2}$/.test(body.endDate || "")
    ) {
      return Response.json(
        {
          error: "Pause startDate and endDate are required",
          code: "INVALID_PAUSE_DATES",
        },
        { status: 400 },
      );
    }
    const rows = await sql`
      UPDATE commuter_passes
      SET status = 'PAUSED', pause_start_date = ${body.startDate}::date,
          pause_end_date = ${body.endDate}::date, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${params.id} AND passenger_id = ${session.user.id} AND status = 'ACTIVE'
      RETURNING *
    `;
    if (!rows[0])
      return Response.json(
        { error: "Only an active pass can be paused" },
        { status: 409 },
      );
    return Response.json({ pass: rows[0] });
  }
  if (body.action === "resume") {
    const rows = await sql`
      UPDATE commuter_passes SET status = 'ACTIVE', pause_start_date = NULL, pause_end_date = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${params.id} AND passenger_id = ${session.user.id} AND status = 'PAUSED'
      RETURNING *
    `;
    if (!rows[0])
      return Response.json({ error: "Pass is not paused" }, { status: 409 });
    return Response.json({ pass: rows[0] });
  }
  if (body.action === "cancel") {
    const rows = await sql`
      UPDATE commuter_passes SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP
      WHERE id = ${params.id} AND passenger_id = ${session.user.id} AND status IN ('PENDING_MATCH', 'ACTIVE', 'PAUSED')
      RETURNING *,
        CASE WHEN start_date > CURRENT_DATE + 2 THEN agreed_fare ELSE round(agreed_fare * 0.5)::int END AS refund_amount
    `;
    if (!rows[0])
      return Response.json(
        { error: "Pass cannot be cancelled" },
        { status: 409 },
      );
    const refund = await processPassRefund(rows[0]);
    return Response.json({ pass: rows[0], ...refund });
  }
  return Response.json({ error: "Unsupported pass action" }, { status: 400 });
}
