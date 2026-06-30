import sql from "@/app/api/utils/sql";
import {
  authorizeTripAction,
  notifyPickup,
} from "@/app/api/utils/institution-trip";
export async function POST(request, { params }) {
  try {
    const trip = await sql.transaction(async (tx) => {
      const access = await authorizeTripAction(request, tx, params.id);
      if (access.trip.status !== "IN_PROGRESS") {
        const e = new Error("Trip is not in progress");
        e.status = 409;
        throw e;
      }
      const member =
        await tx`SELECT id FROM institution_members WHERE id=${params.memberId} AND institution_id=${access.trip.institution_id} AND id=ANY(${access.trip.members_expected}::uuid[])`;
      if (!member[0]) {
        const e = new Error("Member is not assigned to this trip");
        e.status = 404;
        throw e;
      }
      const rows =
        await tx`UPDATE institution_trips SET members_picked_up=array_append(array_remove(members_picked_up,${params.memberId}::uuid),${params.memberId}::uuid),members_absent=array_remove(members_absent,${params.memberId}::uuid),updated_at=CURRENT_TIMESTAMP WHERE id=${params.id} RETURNING *`;
      await tx`UPDATE member_tracking_tokens SET pickup_confirmed_at=CURRENT_TIMESTAMP WHERE trip_id=${params.id} AND member_id=${params.memberId}`;
      return rows[0];
    });
    const origin =
      process.env.PUBLIC_APP_URL?.replace(/\/$/, "") ||
      new URL(request.url).origin;
    await notifyPickup(trip.id, params.memberId, origin);
    return Response.json({ trip });
  } catch (error) {
    return Response.json(
      { error: error.message || "Pickup confirmation failed" },
      { status: error.status || 500 },
    );
  }
}
