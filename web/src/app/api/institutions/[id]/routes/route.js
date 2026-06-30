import sql from "@/app/api/utils/sql";
import { assertDriverAvailable } from "@/app/api/utils/driver-conflicts";
import {
  institutionError,
  requireInstitutionAccess,
} from "@/app/api/utils/institution-auth";
import { readDays, readTime } from "@/app/api/utils/phase2";
import { readBoundedString } from "@/app/api/utils/validation";

export async function GET(request, { params }) {
  try {
    await requireInstitutionAccess(request, params.id);
    const routes =
      await sql`SELECT r.*,u.name AS driver_name,d.vehicle_number FROM institution_routes r
      LEFT JOIN drivers d ON d.id=r.driver_id LEFT JOIN auth_users u ON u.id=d.user_id
      WHERE r.institution_id=${params.id} ORDER BY r.scheduled_time,r.route_name`;
    return Response.json({ routes });
  } catch (error) {
    return institutionError(error);
  }
}

export async function POST(request, { params }) {
  try {
    await requireInstitutionAccess(request, params.id);
    const body = await request.json();
    const routeName = readBoundedString(body.routeName, { min: 2, max: 100 });
    const days = readDays(body.scheduledDays);
    const time = readTime(body.scheduledTime);
    const direction = String(body.direction || "").toUpperCase();
    const capacity = Number(body.maxCapacity || 6);
    if (
      !routeName ||
      !days ||
      !time ||
      !["PICKUP", "DROPOFF"].includes(direction) ||
      !Number.isInteger(capacity) ||
      capacity < 1 ||
      capacity > 20
    )
      return Response.json({ error: "Invalid route details" }, { status: 400 });
    const route = await sql.transaction(async (tx) => {
      if (body.driverId)
        await assertDriverAvailable(tx, {
          driverId: body.driverId,
          scheduledDays: days,
          scheduledTime: time,
          sourceType: "INSTITUTION",
        });
      const rows =
        await tx`INSERT INTO institution_routes(institution_id,route_name,driver_id,scheduled_days,scheduled_time,direction,max_capacity)
        VALUES(${params.id},${routeName},${body.driverId || null},${days}::text[],${time}::time,${direction},${capacity}) RETURNING *`;
      return rows[0];
    });
    return Response.json({ route }, { status: 201 });
  } catch (error) {
    return institutionError(error);
  }
}
