import sql from "@/app/api/utils/sql";
import {
  institutionError,
  requireInstitutionAccess,
} from "@/app/api/utils/institution-auth";

export async function POST(request, { params }) {
  try {
    await requireInstitutionAccess(request, params.id);
    const rows = await sql`
    UPDATE institution_trips t SET members_absent=array_append(array_remove(members_absent,${params.memberId}::uuid),${params.memberId}::uuid),
      members_picked_up=array_remove(members_picked_up,${params.memberId}::uuid),updated_at=CURRENT_TIMESTAMP
    FROM institution_members m WHERE m.id=${params.memberId} AND m.institution_id=${params.id}
      AND t.institution_id=${params.id} AND t.scheduled_date=CURRENT_DATE AND m.id=ANY(t.members_expected) AND t.status='SCHEDULED'
    RETURNING t.*`;
    if (!rows[0])
      return Response.json(
        { error: "Today's scheduled trip was not found" },
        { status: 404 },
      );
    return Response.json({ trip: rows[0] });
  } catch (error) {
    return institutionError(error);
  }
}
