import sql from "@/app/api/utils/sql";
import { institutionError, requireInstitutionAdmin } from "@/app/api/utils/institution-auth";
import { isLatitude, isLongitude, readBoundedString } from "@/app/api/utils/validation";

function validateMember(body) {
  const name = readBoundedString(body.memberName, { min: 2, max: 100 });
  const type = ["STUDENT", "STAFF"].includes(body.memberType) ? body.memberType : "STUDENT";
  const phone = readBoundedString(body.guardianPhone, { min: 10, max: 15 });
  const lat = body.pickupLat === undefined ? null : Number(body.pickupLat);
  const lng = body.pickupLng === undefined ? null : Number(body.pickupLng);
  if (!name || !phone || ((lat !== null || lng !== null) && (!isLatitude(lat) || !isLongitude(lng)))) return null;
  return { name, type, phone, lat, lng };
}

export async function GET(request) {
  try {
    const { institution } = await requireInstitutionAdmin(request);
    const rows = await sql`
      SELECT m.*, r.route_name FROM institution_members m
      LEFT JOIN institution_routes r ON r.id = m.route_id
      WHERE m.institution_id = ${institution.id}
      ORDER BY m.active DESC, r.route_name, m.stop_order, m.member_name
    `;
    return Response.json({ members: rows });
  } catch (error) {
    return institutionError(error);
  }
}

export async function POST(request) {
  try {
    const { institution } = await requireInstitutionAdmin(request);
    const body = await request.json();
    const items = Array.isArray(body.members) ? body.members : [body];
    if (items.length < 1 || items.length > 500) return Response.json({ error: "Import must contain 1-500 members" }, { status: 400 });
    const validated = items.map((item, index) => ({ index, item, value: validateMember(item) }));
    const errors = validated.filter((entry) => !entry.value).map((entry) => ({ row: entry.index + 1, error: "Invalid name, phone, or coordinates" }));
    if (errors.length) return Response.json({ error: "Member validation failed", errors }, { status: 400 });
    const created = [];
    await sql.transaction(async (tx) => {
      for (const entry of validated) {
        const { item, value } = entry;
        const rows = await tx`
          INSERT INTO institution_members (
            institution_id, route_id, member_name, member_type, pickup_location, pickup_address,
            stop_order, guardian_name, guardian_phone, guardian_phone_2
          ) VALUES (
            ${institution.id}, ${item.routeId || null}, ${value.name}, ${value.type},
            ${value.lat === null ? null : `SRID=4326;POINT(${value.lng} ${value.lat})`}::geography,
            ${item.pickupAddress || null}, ${Number(item.stopOrder) || null}, ${item.guardianName || null},
            ${value.phone}, ${item.guardianPhone2 || null}
          ) RETURNING *
        `;
        created.push(rows[0]);
      }
    });
    return Response.json({ members: created }, { status: 201 });
  } catch (error) {
    return institutionError(error);
  }
}
