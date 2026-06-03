import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

function isFiniteLatitude(value) {
  return Number.isFinite(value) && value >= -90 && value <= 90;
}

function isFiniteLongitude(value) {
  return Number.isFinite(value) && value >= -180 && value <= 180;
}

export async function PATCH(request) {
  try {
    const session = await auth(request);
    if (!session || !session.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { is_online, lat, lng } = await request.json();
    const nextOnline =
      is_online === undefined || is_online === null ? null : Boolean(is_online);
    const nextLat = lat === undefined || lat === null ? null : Number(lat);
    const nextLng = lng === undefined || lng === null ? null : Number(lng);

    if (is_online !== undefined && typeof is_online !== "boolean") {
      return Response.json(
        { error: "is_online must be a boolean" },
        { status: 400 },
      );
    }
    if (
      (nextLat !== null && !isFiniteLatitude(nextLat)) ||
      (nextLng !== null && !isFiniteLongitude(nextLng)) ||
      ((nextLat === null) !== (nextLng === null))
    ) {
      return Response.json(
        { error: "lat and lng must be valid coordinates when provided" },
        { status: 400 },
      );
    }

    // Check if subscription is active
    const driver =
      await sql`SELECT id, subscription_expiry FROM drivers WHERE user_id = ${session.user.id} LIMIT 1`;
    if (driver.length === 0)
      return Response.json(
        { error: "Driver profile not found" },
        { status: 404 },
      );

    const now = new Date();
    const expiry = driver[0].subscription_expiry
      ? new Date(driver[0].subscription_expiry)
      : null;

    // If trying to go online but subscription expired
    if (nextOnline && (!expiry || expiry < now)) {
      return Response.json(
        {
          error: "Subscription expired. Please renew to go online.",
          code: "SUBSCRIPTION_EXPIRED",
        },
        { status: 403 },
      );
    }

    const rows = await sql`
      UPDATE drivers 
      SET is_online = COALESCE(${nextOnline}, is_online),
          last_lat = COALESCE(${nextLat}, last_lat),
          last_lng = COALESCE(${nextLng}, last_lng),
          updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ${session.user.id}
      RETURNING *
    `;

    return Response.json({ driver: rows[0] });
  } catch (err) {
    console.error("PATCH /api/drivers/status error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
