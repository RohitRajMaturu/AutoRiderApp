import sql from "@/app/api/utils/sql";
import { dispatchRideRequest } from "@/app/api/utils/dispatch";
import { auth } from "@/auth";
import { triggerRideEvent } from "@/lib/pusher/server";

export async function POST(request, { params }) {
  try {
    const session = await auth(request);
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const rows = await sql`
      UPDATE rides
      SET status = 'requested',
          negotiation_mode = 'fixed',
          fare_min = NULL,
          fare_max = NULL,
          negotiation_expires_at = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
        AND passenger_id = ${session.user.id}
        AND status = 'negotiating'
        AND negotiation_expires_at < CURRENT_TIMESTAMP
      RETURNING *
    `;
    if (rows.length === 0) {
      return Response.json(
        { error: "Negotiation cannot be expired yet or is already closed" },
        { status: 409 },
      );
    }

    const dispatchedDrivers = await dispatchRideRequest(rows[0]);
    await triggerRideEvent(id, "negotiation-expired", { rideId: id });

    return Response.json({ ride: rows[0], dispatchedDrivers });
  } catch (err) {
    console.error("POST /api/rides/[id]/expire-negotiation error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
