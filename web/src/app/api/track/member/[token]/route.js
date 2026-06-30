import sql from "@/app/api/utils/sql";

const noStore = { "Cache-Control": "no-store, no-cache, must-revalidate" };

export async function GET(_request, { params }) {
  if (!/^[a-f0-9]{64}$/i.test(params.token || "")) {
    return Response.json(
      { error: "Invalid tracking link" },
      { status: 400, headers: noStore },
    );
  }
  const rows = await sql`
    SELECT token.revoked_at,token.expires_at,token.pickup_confirmed_at,
      t.status,t.actual_start_time,t.actual_end_time,r.route_name,r.direction,
      m.member_name,d.last_lat AS driver_lat,d.last_lng AS driver_lng,d.vehicle_number,
      u.name AS driver_name
    FROM member_tracking_tokens token
    JOIN institution_trips t ON t.id=token.trip_id
    JOIN institution_routes r ON r.id=t.route_id
    JOIN institution_members m ON m.id=token.member_id
    LEFT JOIN drivers d ON d.id=COALESCE(t.reassigned_driver_id,t.driver_id)
    LEFT JOIN auth_users u ON u.id=d.user_id
    WHERE token.token=${params.token} LIMIT 1
  `;
  const row = rows[0];
  if (!row)
    return Response.json(
      { error: "Tracking link not found" },
      { status: 404, headers: noStore },
    );
  if (row.revoked_at)
    return Response.json({ status: "stopped" }, { headers: noStore });
  if (new Date(row.expires_at) <= new Date())
    return Response.json({ status: "expired" }, { headers: noStore });
  if (["COMPLETED", "CANCELLED"].includes(row.status))
    return Response.json({ status: "ended" }, { headers: noStore });
  return Response.json(
    {
      status: "active",
      member: {
        name: row.member_name,
        pickupConfirmedAt: row.pickup_confirmed_at,
      },
      driver: {
        name: row.driver_name || "Assigned driver",
        vehicle: row.vehicle_number,
        lat: row.driver_lat == null ? null : Number(row.driver_lat),
        lng: row.driver_lng == null ? null : Number(row.driver_lng),
      },
      trip: {
        status: row.status,
        routeName: row.route_name,
        direction: row.direction,
        startedAt: row.actual_start_time,
      },
    },
    { headers: noStore },
  );
}
