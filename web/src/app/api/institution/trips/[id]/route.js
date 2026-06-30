import crypto from "node:crypto";
import sql from "@/app/api/utils/sql";
import { institutionError, requireInstitutionAdmin } from "@/app/api/utils/institution-auth";

export async function PATCH(request, { params }) {
  try {
    const { institution } = await requireInstitutionAdmin(request);
    const body = await request.json();
    const action = body.action;
    if (!["start", "pickup", "absent", "complete", "cancel"].includes(action)) {
      return Response.json({ error: "Unsupported trip action" }, { status: 400 });
    }
    const result = await sql.transaction(async (tx) => {
      const tripRows = await tx`
        SELECT * FROM institution_trips
        WHERE id = ${params.id} AND institution_id = ${institution.id}
        FOR UPDATE
      `;
      const trip = tripRows[0];
      if (!trip) return { status: 404, error: "Trip not found" };
      if (action === "start") {
        if (trip.status !== "SCHEDULED") return { status: 409, error: "Only a scheduled trip can start" };
        const members = await tx`
          SELECT id, guardian_phone FROM institution_members
          WHERE id = ANY(${trip.members_expected}::uuid[]) AND active = true AND sms_opted_out = false
        `;
        for (const member of members) {
          await tx`
            INSERT INTO member_tracking_tokens (trip_id, member_id, token, guardian_phone, expires_at)
            VALUES (${trip.id}, ${member.id}, ${crypto.randomBytes(32).toString("hex")}, ${member.guardian_phone}, CURRENT_TIMESTAMP + INTERVAL '12 hours')
            ON CONFLICT (trip_id, member_id) DO NOTHING
          `;
        }
        const updated = await tx`
          UPDATE institution_trips SET status = 'IN_PROGRESS', actual_start_time = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
          WHERE id = ${trip.id} RETURNING *
        `;
        return { status: 200, trip: updated[0] };
      }
      if (action === "pickup" || action === "absent") {
        if (trip.status !== "IN_PROGRESS" && !(action === "absent" && trip.status === "SCHEDULED")) {
          return { status: 409, error: "Attendance cannot be changed in the current trip state" };
        }
        const memberRows = await tx`
          SELECT id FROM institution_members WHERE id = ${body.memberId} AND institution_id = ${institution.id} LIMIT 1
        `;
        if (!memberRows[0]) return { status: 404, error: "Member not found" };
        const updated = action === "pickup"
          ? await tx`
              UPDATE institution_trips
              SET members_picked_up = array_append(array_remove(members_picked_up, ${body.memberId}::uuid), ${body.memberId}::uuid),
                  members_absent = array_remove(members_absent, ${body.memberId}::uuid), updated_at = CURRENT_TIMESTAMP
              WHERE id = ${trip.id} RETURNING *
            `
          : await tx`
              UPDATE institution_trips
              SET members_absent = array_append(array_remove(members_absent, ${body.memberId}::uuid), ${body.memberId}::uuid),
                  members_picked_up = array_remove(members_picked_up, ${body.memberId}::uuid), updated_at = CURRENT_TIMESTAMP
              WHERE id = ${trip.id} RETURNING *
            `;
        if (action === "pickup") {
          await tx`UPDATE member_tracking_tokens SET pickup_confirmed_at = CURRENT_TIMESTAMP WHERE trip_id = ${trip.id} AND member_id = ${body.memberId}`;
        }
        return { status: 200, trip: updated[0] };
      }
      if (action === "complete") {
        const updated = await tx`
          UPDATE institution_trips SET status = 'COMPLETED', actual_end_time = CURRENT_TIMESTAMP,
            members_unconfirmed = ARRAY(SELECT unnest(members_expected) EXCEPT SELECT unnest(members_picked_up) EXCEPT SELECT unnest(members_absent)),
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ${trip.id} AND status = 'IN_PROGRESS' RETURNING *
        `;
        if (!updated[0]) return { status: 409, error: "Only an active trip can complete" };
        await tx`UPDATE member_tracking_tokens SET revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP) WHERE trip_id = ${trip.id}`;
        return { status: 200, trip: updated[0] };
      }
      const updated = await tx`
        UPDATE institution_trips SET status = 'CANCELLED', cancellation_reason = ${String(body.reason || "Institution cancelled").slice(0, 280)},
          cancelled_by = 'INSTITUTION', updated_at = CURRENT_TIMESTAMP
        WHERE id = ${trip.id} AND status IN ('SCHEDULED', 'IN_PROGRESS') RETURNING *
      `;
      return updated[0] ? { status: 200, trip: updated[0] } : { status: 409, error: "Trip cannot be cancelled" };
    });
    if (result.error) return Response.json({ error: result.error }, { status: result.status });
    return Response.json({ trip: result.trip });
  } catch (error) {
    return institutionError(error);
  }
}
