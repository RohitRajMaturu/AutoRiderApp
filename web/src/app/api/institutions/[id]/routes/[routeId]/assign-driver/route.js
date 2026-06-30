import sql from "@/app/api/utils/sql";
import { assertDriverAvailable } from "@/app/api/utils/driver-conflicts";
import {
  institutionError,
  requireInstitutionAccess,
} from "@/app/api/utils/institution-auth";

export async function POST(request, { params }) {
  try {
    await requireInstitutionAccess(request, params.id);
    const { driverId } = await request.json();
    if (!driverId)
      return Response.json({ error: "driverId is required" }, { status: 400 });
    const route = await sql.transaction(async (tx) => {
      const found =
        await tx`SELECT * FROM institution_routes WHERE id=${params.routeId} AND institution_id=${params.id} FOR UPDATE`;
      if (!found[0]) return null;
      await assertDriverAvailable(tx, {
        driverId,
        scheduledDays: found[0].scheduled_days,
        scheduledTime: String(found[0].scheduled_time).slice(0, 5),
        sourceType: "INSTITUTION",
        excludeId: found[0].id,
      });
      const rows =
        await tx`UPDATE institution_routes SET driver_id=${driverId},updated_at=CURRENT_TIMESTAMP WHERE id=${found[0].id} RETURNING *`;
      return rows[0];
    });
    if (!route)
      return Response.json({ error: "Route not found" }, { status: 404 });
    return Response.json({ route });
  } catch (error) {
    return institutionError(error);
  }
}
