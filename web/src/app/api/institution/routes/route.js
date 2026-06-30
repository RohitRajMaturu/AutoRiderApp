import sql from "@/app/api/utils/sql";
import { assertDriverAvailable } from "@/app/api/utils/driver-conflicts";
import { institutionError, requireInstitutionAdmin } from "@/app/api/utils/institution-auth";
import { readDays, readTime } from "@/app/api/utils/phase2";
import { readBoundedString } from "@/app/api/utils/validation";

export async function GET(request) {
  try {
    const { institution } = await requireInstitutionAdmin(request);
    const rows = await sql`
      SELECT r.*, u.name AS driver_name, u.image AS driver_image, d.vehicle_number,
        COALESCE((SELECT count(*)::int FROM institution_members m WHERE m.route_id = r.id AND m.active = true), 0) AS member_count
      FROM institution_routes r
      LEFT JOIN drivers d ON d.id = r.driver_id
      LEFT JOIN auth_users u ON u.id = d.user_id
      WHERE r.institution_id = ${institution.id}
      ORDER BY r.scheduled_time, r.route_name
    `;
    return Response.json({ routes: rows });
  } catch (error) {
    return institutionError(error);
  }
}

export async function POST(request) {
  try {
    const { institution } = await requireInstitutionAdmin(request);
    const body = await request.json();
    const routeName = readBoundedString(body.routeName, { min: 2, max: 100 });
    const days = readDays(body.scheduledDays);
    const time = readTime(body.scheduledTime);
    const direction = ["PICKUP", "DROPOFF"].includes(body.direction) ? body.direction : null;
    const maxCapacity = Number(body.maxCapacity);
    const driverId = body.driverId || null;
    if (!routeName || !days || !time || !direction || !Number.isInteger(maxCapacity) || maxCapacity < 1 || maxCapacity > 20) {
      return Response.json({ error: "Invalid institution route details" }, { status: 400 });
    }
    const route = await sql.transaction(async (tx) => {
      if (driverId) {
        await assertDriverAvailable(tx, {
          driverId,
          scheduledDays: days,
          scheduledTime: time,
          sourceType: "INSTITUTION",
        });
      }
      const rows = await tx`
        INSERT INTO institution_routes (
          institution_id, route_name, driver_id, scheduled_days, scheduled_time, direction, max_capacity
        ) VALUES (
          ${institution.id}, ${routeName}, ${driverId}, ${days}::text[], ${time}::time, ${direction}, ${maxCapacity}
        ) RETURNING *
      `;
      return rows[0];
    });
    return Response.json({ route }, { status: 201 });
  } catch (error) {
    return institutionError(error);
  }
}
