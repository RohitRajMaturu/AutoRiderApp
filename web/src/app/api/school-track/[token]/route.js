import sql from "@/app/api/utils/sql";

export async function GET(_request, { params }) {
  const rows = await sql`
    SELECT t.status, t.actual_start_time, t.actual_end_time, r.route_name, r.direction,
      m.member_name, d.last_lat AS driver_lat, d.last_lng AS driver_lng, d.vehicle_number,
      u.name AS driver_name, token.pickup_confirmed_at, token.expires_at, token.revoked_at
    FROM member_tracking_tokens token
    JOIN institution_trips t ON t.id = token.trip_id
    JOIN institution_routes r ON r.id = t.route_id
    JOIN institution_members m ON m.id = token.member_id
    LEFT JOIN drivers d ON d.id = COALESCE(t.reassigned_driver_id, t.driver_id)
    LEFT JOIN auth_users u ON u.id = d.user_id
    WHERE token.token = ${params.token} AND token.expires_at > CURRENT_TIMESTAMP AND token.revoked_at IS NULL
    LIMIT 1
  `;
  if (!rows[0]) return Response.json({ error: "Tracking link expired or invalid" }, { status: 404 });
  return Response.json({ tracking: rows[0] });
}
