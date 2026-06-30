import sql from "@/app/api/utils/sql";
import {
  authorizeTripAction,
  notifyTripCancellation,
} from "@/app/api/utils/institution-trip";
export async function POST(request, { params }) {
  try {
    const body = await request.json().catch(() => ({}));
    const result = await sql.transaction(async (tx) => {
      const access = await authorizeTripAction(request, tx, params.id);
      if (!["SCHEDULED", "IN_PROGRESS"].includes(access.trip.status)) {
        const e = new Error("Trip cannot be cancelled");
        e.status = 409;
        throw e;
      }
      const cancelledBy = access.isDriver
        ? "DRIVER"
        : access.session.user.role === "admin"
          ? "OPS"
          : "INSTITUTION";
      const rows =
        await tx`UPDATE institution_trips SET status='CANCELLED',cancellation_reason=${String(body.reason || "Service cancelled").slice(0, 280)},cancelled_by=${cancelledBy},updated_at=CURRENT_TIMESTAMP WHERE id=${params.id} RETURNING *`;
      if (access.isDriver && access.trip.driver_id) {
        await tx`INSERT INTO driver_sla_events(driver_id,event_type,reference_type,reference_id,points_delta,metadata) VALUES(${access.trip.driver_id},'INSTITUTION_TRIP_CANCELLED','INSTITUTION_TRIP',${params.id},-10,${JSON.stringify({ reason: body.reason || null })}::jsonb)`;
        await tx`UPDATE drivers SET sla_score=greatest(0,sla_score-10),updated_at=CURRENT_TIMESTAMP WHERE id=${access.trip.driver_id}`;
      }
      await tx`UPDATE member_tracking_tokens SET revoked_at=COALESCE(revoked_at,CURRENT_TIMESTAMP) WHERE trip_id=${params.id}`;
      return rows[0];
    });
    await notifyTripCancellation(params.id);
    return Response.json({ trip: result });
  } catch (error) {
    return Response.json(
      { error: error.message || "Trip cancellation failed" },
      { status: error.status || 500 },
    );
  }
}
