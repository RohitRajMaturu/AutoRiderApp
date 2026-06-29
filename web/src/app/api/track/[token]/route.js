import sql from "@/app/api/utils/sql";

const noStore = { "Cache-Control": "no-store, no-cache, must-revalidate" };

export async function GET(_request, { params }) {
  try {
    if (!/^[a-f0-9]{64}$/i.test(params.token || "")) {
      return Response.json({ error: "Invalid tracking link" }, { status: 400, headers: noStore });
    }
    const rows = await sql`
      SELECT
        st.revoked_at, st.expires_at,
        r.status AS ride_status, r.pickup_address, r.dest_address, r.started_at,
        pu.name AS passenger_name,
        du.name AS driver_name, d.vehicle_number, d.last_lat, d.last_lng
      FROM sos_tracking_tokens st
      JOIN rides r ON r.id = st.ride_id
      JOIN auth_users pu ON pu.id = st.passenger_id
      LEFT JOIN drivers d ON d.id = r.driver_id
      LEFT JOIN auth_users du ON du.id = d.user_id
      WHERE st.token = ${params.token}
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) return Response.json({ error: "Tracking link not found" }, { status: 404, headers: noStore });
    if (row.revoked_at) return Response.json({ status: "stopped" }, { headers: noStore });
    if (new Date(row.expires_at) <= new Date()) return Response.json({ status: "expired" }, { headers: noStore });
    if (["completed", "cancelled"].includes(row.ride_status)) {
      return Response.json({ status: "ended" }, { headers: noStore });
    }
    return Response.json({
      status: "active",
      passenger: { name: row.passenger_name || "Passenger" },
      driver: {
        name: row.driver_name || "Assigned driver",
        vehicle: row.vehicle_number || "Not available",
        lat: row.last_lat === null ? null : Number(row.last_lat),
        lng: row.last_lng === null ? null : Number(row.last_lng),
      },
      ride: {
        pickupAddress: row.pickup_address,
        destAddress: row.dest_address,
        status: row.ride_status,
        startedAt: row.started_at,
      },
    }, { headers: noStore });
  } catch (err) {
    console.error("GET /api/track/[token] error:", err);
    return Response.json({ error: "Unable to load tracking" }, { status: 500, headers: noStore });
  }
}
