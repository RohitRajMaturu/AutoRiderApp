import { auth } from "@/auth";
import sql from "@/app/api/utils/sql";
import { writeAdminAudit } from "@/app/api/utils/admin";

async function requireAdminSession(request) {
  const session = await auth(request);
  if (!session?.user?.id)
    return { response: Response.json({ error: "Unauthorized" }, { status: 401 }) };

  const adminCheck =
    await sql`SELECT role FROM auth_users WHERE id = ${session.user.id}`;
  if (!adminCheck[0] || adminCheck[0].role !== "admin") {
    return { response: Response.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}

export async function GET(request) {
  const { response } = await requireAdminSession(request);
  if (response) return response;

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

export async function PATCH(request) {
  try {
    const { session, response } = await requireAdminSession(request);
    if (response) return response;

    const { ride_id, action, reason } = await request.json();
    if (typeof ride_id !== "string" || !ride_id.trim() || action !== "cancel") {
      return Response.json(
        { error: "ride_id and action=cancel are required" },
        { status: 400 },
      );
    }

    const rows = await sql.transaction(async (tx) => {
      const updated = await tx`
        UPDATE rides
        SET status = 'cancelled',
            cancelled_at = CURRENT_TIMESTAMP,
            cancellation_reason = COALESCE(${reason || null}, 'admin_cancelled'),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${ride_id}
          AND status IN ('requested', 'accepted')
        RETURNING *
      `;
      if (updated.length > 0) {
        await writeAdminAudit(session.user.id, "ride.cancel", "ride", updated[0].id, {
          reason: reason || "admin_cancelled",
        }, tx);
      }
      return updated;
    });

    if (rows.length === 0) {
      return Response.json(
        { error: "Ride not found or already closed" },
        { status: 404 },
      );
    }

    return Response.json({ ride: rows[0] });
  } catch (err) {
    console.error("PATCH /api/admin/rides error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
