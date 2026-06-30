import sql from "@/app/api/utils/sql";
import { authorizeTripAction } from "@/app/api/utils/institution-trip";
export async function POST(request, { params }) {
  try {
    const trip = await sql.transaction(async (tx) => {
      const access = await authorizeTripAction(request, tx, params.id);
      if (access.trip.status !== "IN_PROGRESS") {
        const e = new Error("Only an active trip can complete");
        e.status = 409;
        throw e;
      }
      const rows =
        await tx`UPDATE institution_trips SET status='COMPLETED',actual_end_time=CURRENT_TIMESTAMP,members_unconfirmed=ARRAY(SELECT unnest(members_expected) EXCEPT SELECT unnest(members_picked_up) EXCEPT SELECT unnest(members_absent)),updated_at=CURRENT_TIMESTAMP WHERE id=${params.id} RETURNING *`;
      await tx`UPDATE member_tracking_tokens SET revoked_at=COALESCE(revoked_at,CURRENT_TIMESTAMP) WHERE trip_id=${params.id}`;
      return rows[0];
    });
    return Response.json({ trip });
  } catch (error) {
    return Response.json(
      { error: error.message || "Trip completion failed" },
      { status: error.status || 500 },
    );
  }
}
