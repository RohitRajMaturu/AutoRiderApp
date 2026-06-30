import sql from "@/app/api/utils/sql";
import {
  authorizeTripAction,
  createTrackingTokens,
  notifyTripStart,
} from "@/app/api/utils/institution-trip";
export async function POST(request, { params }) {
  try {
    const trip = await sql.transaction(async (tx) => {
      const access = await authorizeTripAction(request, tx, params.id);
      if (access.trip.status !== "SCHEDULED") {
        const e = new Error("Only a scheduled trip can start");
        e.status = 409;
        throw e;
      }
      await createTrackingTokens(tx, access.trip);
      const rows =
        await tx`UPDATE institution_trips SET status='IN_PROGRESS',actual_start_time=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=${params.id} RETURNING *`;
      return rows[0];
    });
    const origin =
      process.env.PUBLIC_APP_URL?.replace(/\/$/, "") ||
      new URL(request.url).origin;
    await notifyTripStart(trip.id, origin);
    return Response.json({ trip });
  } catch (error) {
    return Response.json(
      { error: error.message || "Trip start failed" },
      { status: error.status || 500 },
    );
  }
}
