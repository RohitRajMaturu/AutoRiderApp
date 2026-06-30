import sql from "@/app/api/utils/sql";
import {
  institutionError,
  requireInstitutionAccess,
} from "@/app/api/utils/institution-auth";
import {
  isLatitude,
  isLongitude,
  readBoundedString,
} from "@/app/api/utils/validation";

export async function GET(request, { params }) {
  try {
    await requireInstitutionAccess(request, params.id);
    const members = await sql`SELECT m.*,r.route_name FROM institution_members m
    LEFT JOIN institution_routes r ON r.id=m.route_id WHERE m.institution_id=${params.id}
    ORDER BY m.active DESC,r.route_name,m.stop_order,m.member_name`;
    return Response.json({ members });
  } catch (error) {
    return institutionError(error);
  }
}

export async function POST(request, { params }) {
  try {
    await requireInstitutionAccess(request, params.id);
    const body = await request.json();
    const items = Array.isArray(body.members) ? body.members : [body];
    if (!items.length || items.length > 500)
      return Response.json(
        { error: "Import must contain 1-500 members" },
        { status: 400 },
      );
    const parsed = items.map((item, index) => {
      const name = readBoundedString(item.memberName, { min: 2, max: 100 });
      const phone = readBoundedString(item.guardianPhone, { min: 10, max: 15 });
      const lat = item.pickupLat == null ? null : Number(item.pickupLat),
        lng = item.pickupLng == null ? null : Number(item.pickupLng);
      const valid =
        name &&
        phone &&
        ((lat === null && lng === null) ||
          (isLatitude(lat) && isLongitude(lng)));
      return { item, index, name, phone, lat, lng, valid };
    });
    const errors = parsed
      .filter((x) => !x.valid)
      .map((x) => ({
        row: x.index + 1,
        error: "Invalid name, phone, or coordinates",
      }));
    if (errors.length)
      return Response.json(
        { error: "Member validation failed", errors },
        { status: 400 },
      );
    const members = [];
    await sql.transaction(async (tx) => {
      for (const x of parsed) {
        const i = x.item;
        const memberType = ["STUDENT", "STAFF"].includes(String(i.memberType || "").toUpperCase())
          ? String(i.memberType).toUpperCase()
          : "STUDENT";
        const rows = await tx`INSERT INTO institution_members
      (institution_id,route_id,member_name,member_type,pickup_lat,pickup_lng,pickup_address,stop_order,guardian_name,guardian_phone,guardian_phone_2)
      VALUES(${params.id},${i.routeId || null},${x.name},${memberType},${x.lat},${x.lng},${i.pickupAddress || null},${Number(i.stopOrder) || null},${i.guardianName || null},${x.phone},${i.guardianPhone2 || null}) RETURNING *`;
        members.push(rows[0]);
      }
    });
    return Response.json({ members }, { status: 201 });
  } catch (error) {
    return institutionError(error);
  }
}
