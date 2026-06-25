import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";
import {
  findZoneForPoint,
  getDriverHeartbeatTimeoutSeconds,
} from "@/app/api/utils/dispatch";

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
      await sql`
        SELECT id, is_approved, subscription_expiry
        FROM drivers
        WHERE user_id = ${session.user.id}
        LIMIT 1
      `;
    if (driver.length === 0)
      return Response.json(
        { error: "Driver profile not found" },
        { status: 404 },
      );

    const now = new Date();
    const expiry = driver[0].subscription_expiry
      ? new Date(driver[0].subscription_expiry)
      : null;

    if (nextOnline && !driver[0].is_approved) {
      return Response.json(
        { error: "Driver must be approved before going online.", code: "DRIVER_NOT_APPROVED" },
        { status: 403 },
      );
    }

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

    let zone = null;
    if (nextOnline) {
      if (nextLat === null || nextLng === null) {
        return Response.json(
          { error: "Location is required to go online", code: "LOCATION_REQUIRED" },
          { status: 400 },
        );
      }
      zone = await findZoneForPoint(nextLat, nextLng);
      if (!zone) {
        return Response.json(
          { error: "You are outside all active service zones", code: "NO_SERVICE_ZONE" },
          { status: 422 },
        );
      }

      const capacityRows = await sql`
        SELECT count(d.id)::int AS online_count, max_online_drivers
        FROM geo_zones z
        LEFT JOIN drivers d ON d.zone_id = z.id
          AND d.is_online = true
          AND d.is_approved = true
          AND d.id <> ${driver[0].id}
          AND d.subscription_expiry > CURRENT_TIMESTAMP
          AND d.last_heartbeat_at >= CURRENT_TIMESTAMP - make_interval(secs => ${getDriverHeartbeatTimeoutSeconds()})
        WHERE z.id = ${zone.id}
        GROUP BY z.max_online_drivers
      `;
      const capacity = capacityRows[0];
      if (capacity && capacity.online_count >= capacity.max_online_drivers) {
        return Response.json(
          { error: "This zone is at its online driver cap.", code: "ZONE_DRIVER_CAP_REACHED" },
          { status: 409 },
        );
      }
    }

    const rows = nextOnline === false
      ? await sql`
          UPDATE drivers
          SET is_online = false,
              zone_id = NULL,
              online_since = NULL,
              last_heartbeat_at = CURRENT_TIMESTAMP,
              last_lat = COALESCE(${nextLat}, last_lat),
              last_lng = COALESCE(${nextLng}, last_lng),
              location = CASE
                WHEN COALESCE(${nextLat}, last_lat) IS NOT NULL
                 AND COALESCE(${nextLng}, last_lng) IS NOT NULL
                THEN ST_SetSRID(ST_MakePoint(COALESCE(${nextLng}, last_lng), COALESCE(${nextLat}, last_lat)), 4326)::geography
                ELSE NULL
              END,
              updated_at = CURRENT_TIMESTAMP
          WHERE user_id = ${session.user.id}
          RETURNING *
        `
      : await sql`
          UPDATE drivers 
          SET is_online = COALESCE(${nextOnline}, is_online),
              zone_id = COALESCE(${zone?.id || null}, zone_id),
              online_since = CASE
                WHEN ${nextOnline} AND online_since IS NULL THEN CURRENT_TIMESTAMP
                ELSE online_since
              END,
              last_heartbeat_at = CURRENT_TIMESTAMP,
              last_lat = COALESCE(${nextLat}, last_lat),
              last_lng = COALESCE(${nextLng}, last_lng),
              location = CASE
                WHEN COALESCE(${nextLat}, last_lat) IS NOT NULL
                 AND COALESCE(${nextLng}, last_lng) IS NOT NULL
                THEN ST_SetSRID(ST_MakePoint(COALESCE(${nextLng}, last_lng), COALESCE(${nextLat}, last_lat)), 4326)::geography
                ELSE NULL
              END,
              updated_at = CURRENT_TIMESTAMP
          WHERE user_id = ${session.user.id}
          RETURNING *
        `;

    return Response.json({ driver: rows[0], zone });
  } catch (err) {
    console.error("PATCH /api/drivers/status error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
