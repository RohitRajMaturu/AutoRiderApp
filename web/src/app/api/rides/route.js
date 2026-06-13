import sql from "@/app/api/utils/sql";
import { getRouteEstimate } from "@/app/api/utils/locations";
import {
  isLatitude,
  isLongitude,
  readBoundedString,
} from "@/app/api/utils/validation";
import {
  createBackgroundTask,
  dispatchRideRequest,
  findZoneForPoint,
  getPassengerPostCancelCooldownSeconds,
  getPassengerSpamCooldownSeconds,
} from "@/app/api/utils/dispatch";
import { auth } from "@/auth";

export async function POST(request) {
  try {
    const session = await auth(request);
    if (!session || !session.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {
      pickup_lat,
      pickup_lng,
      dest_lat,
      dest_lng,
      pickup_address,
      dest_address,
      pickup_place_id,
      dest_place_id,
    } = await request.json();
    const pickupLat = Number(pickup_lat);
    const pickupLng = Number(pickup_lng);
    const destLat = Number(dest_lat);
    const destLng = Number(dest_lng);
    const pickupAddress = readBoundedString(pickup_address, { min: 3, max: 500 });
    const destAddress = readBoundedString(dest_address, { min: 3, max: 500 });
    const pickupPlaceId = readBoundedString(pickup_place_id, { max: 255 });
    const destPlaceId = readBoundedString(dest_place_id, { max: 255 });

    if (
      !isLatitude(pickupLat) ||
      !isLongitude(pickupLng) ||
      !isLatitude(destLat) ||
      !isLongitude(destLng) ||
      !pickupAddress ||
      !destAddress
    ) {
      return Response.json(
        { error: "Pickup and destination addresses with valid coordinates are required" },
        { status: 400 },
      );
    }

    // Check if user already has an active ride.
    const active = await sql`
      SELECT id FROM rides 
      WHERE passenger_id = ${session.user.id} 
      AND status IN ('requested', 'accepted') 
      LIMIT 1
    `;
    if (active.length > 0) {
      return Response.json(
        { error: "You already have an active ride request" },
        { status: 400 },
      );
    }

    const spamCooldownSeconds = getPassengerSpamCooldownSeconds();
    if (spamCooldownSeconds > 0) {
      const recent = await sql`
        SELECT id, created_at
        FROM rides
        WHERE passenger_id = ${session.user.id}
          AND created_at > CURRENT_TIMESTAMP - make_interval(secs => ${spamCooldownSeconds})
        ORDER BY created_at DESC
        LIMIT 1
      `;
      if (recent.length > 0) {
        return Response.json(
          {
            error: `Please wait ${spamCooldownSeconds} seconds before requesting again.`,
            code: "REQUEST_COOLDOWN",
            retry_after_seconds: spamCooldownSeconds,
          },
          { status: 429 },
        );
      }
    }

    const postCancelCooldownSeconds = getPassengerPostCancelCooldownSeconds();
    if (postCancelCooldownSeconds > 0) {
      const cancelled = await sql`
        SELECT id, cancelled_at
        FROM rides
        WHERE passenger_id = ${session.user.id}
          AND status = 'cancelled'
          AND cancelled_at > CURRENT_TIMESTAMP - make_interval(secs => ${postCancelCooldownSeconds})
        ORDER BY cancelled_at DESC
        LIMIT 1
      `;
      if (cancelled.length > 0) {
        return Response.json(
          {
            error: `Please wait ${postCancelCooldownSeconds} seconds after cancellation before requesting again.`,
            code: "POST_CANCEL_COOLDOWN",
            retry_after_seconds: postCancelCooldownSeconds,
          },
          { status: 429 },
        );
      }
    }

    const zone = await findZoneForPoint(pickupLat, pickupLng);
    if (!zone) {
      return Response.json(
        { error: "Pickup is outside all active service zones", code: "NO_SERVICE_ZONE" },
        { status: 422 },
      );
    }

    const estimate = await getRouteEstimate(pickupLat, pickupLng, destLat, destLng);

    const rows = await sql`
      INSERT INTO rides (
        passenger_id,
        pickup_lat,
        pickup_lng,
        dest_lat,
        dest_lng,
        pickup_address,
        dest_address,
        pickup_place_id,
        dest_place_id,
        distance_km,
        duration_mins,
        estimated_fare,
        route_polyline,
        route_provider,
        zone_id
      )
      VALUES (
        ${session.user.id},
        ${pickupLat},
        ${pickupLng},
        ${destLat},
        ${destLng},
        ${pickupAddress},
        ${destAddress},
        ${pickupPlaceId},
        ${destPlaceId},
        ${estimate.distanceKm},
        ${estimate.durationMins},
        ${estimate.estimatedFare},
        ${estimate.polyline},
        ${estimate.provider},
        ${zone.id}
      )
      RETURNING *
    `;

    createBackgroundTask(() => dispatchRideRequest(rows[0]));

    return Response.json({ ride: rows[0], zone }, { status: 202 });
  } catch (err) {
    console.error("POST /api/rides error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const session = await auth(request);
    if (!session || !session.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Determine if we're fetching as passenger or driver
    const userRows =
      await sql`SELECT role FROM auth_users WHERE id = ${session.user.id} LIMIT 1`;
    const role = userRows[0]?.role;

    let rides;
    if (role === "driver") {
      const driverRows =
        await sql`SELECT id, zone_id FROM drivers WHERE user_id = ${session.user.id} LIMIT 1`;
      const driver = driverRows[0];
      if (!driver) {
        return Response.json({ rides: [] });
      }
      rides = await sql`
        SELECT
          r.*,
          u.phone as passenger_phone,
          z.name as zone_name
        FROM rides r
        JOIN auth_users u ON r.passenger_id = u.id
        LEFT JOIN geo_zones z ON z.id = r.zone_id
        WHERE
          r.driver_id = ${driver.id}
          OR (
            r.status = 'requested'
            AND r.driver_id IS NULL
            AND r.zone_id = ${driver.zone_id}
            AND EXISTS (
              SELECT 1
              FROM ride_driver_notifications n
              WHERE n.ride_id = r.id AND n.driver_id = ${driver.id}
            )
          )
        ORDER BY r.created_at DESC
      `;
    } else {
      rides = await sql`
        SELECT r.*, d.vehicle_number, d.auto_photo_url, u.phone as driver_phone
        FROM rides r
        LEFT JOIN drivers d ON r.driver_id = d.id
        LEFT JOIN auth_users u ON d.user_id = u.id
        WHERE r.passenger_id = ${session.user.id}
        ORDER BY r.created_at DESC
      `;
    }

    return Response.json({ rides });
  } catch (err) {
    console.error("GET /api/rides error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
