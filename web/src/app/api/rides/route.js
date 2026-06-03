import sql from "@/app/api/utils/sql";
import { getRouteEstimate } from "@/app/api/utils/locations";
import {
  getEnvNumber,
  isLatitude,
  isLongitude,
  readBoundedString,
} from "@/app/api/utils/validation";
import { auth } from "@/auth";

function getNearbyRideRadiusKm() {
  return getEnvNumber("DRIVER_RIDE_RADIUS_KM", 8, { min: 1, max: 50 });
}

function getDriverLocationMaxAgeMinutes() {
  return getEnvNumber("DRIVER_LOCATION_MAX_AGE_MINUTES", 10, {
    min: 1,
    max: 240,
  });
}

function hasFreshDriverLocation(driver) {
  if (!isLatitude(Number(driver?.last_lat)) || !isLongitude(Number(driver?.last_lng))) {
    return false;
  }
  const updatedAt = driver?.updated_at ? new Date(driver.updated_at).getTime() : 0;
  if (!Number.isFinite(updatedAt)) return false;
  const maxAgeMs = getDriverLocationMaxAgeMinutes() * 60 * 1000;
  return Date.now() - updatedAt <= maxAgeMs;
}

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

    // Check if user already has an active ride
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
        route_provider
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
        ${estimate.provider}
      )
      RETURNING *
    `;

    return Response.json({ ride: rows[0] });
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
        await sql`SELECT id, last_lat, last_lng, updated_at FROM drivers WHERE user_id = ${session.user.id} LIMIT 1`;
      const driver = driverRows[0];
      if (!driver) {
        return Response.json({ rides: [] });
      }
      const hasLocation = hasFreshDriverLocation(driver);
      const nearbyRideRadiusKm = getNearbyRideRadiusKm();
      rides = await sql`
        SELECT
          r.*,
          u.phone as passenger_phone,
          CASE
            WHEN ${hasLocation} THEN (
              6371 * acos(
                least(
                  1,
                  greatest(
                    -1,
                    cos(radians(${driver.last_lat})) *
                    cos(radians(r.pickup_lat)) *
                    cos(radians(r.pickup_lng) - radians(${driver.last_lng})) +
                    sin(radians(${driver.last_lat})) *
                    sin(radians(r.pickup_lat))
                  )
                )
              )
            )
            ELSE NULL
          END as pickup_distance_km
        FROM rides r
        JOIN auth_users u ON r.passenger_id = u.id
        WHERE
          r.driver_id = ${driver.id}
          OR (
            ${hasLocation}
            AND r.status = 'requested'
            AND r.driver_id IS NULL
            AND (
              6371 * acos(
                least(
                  1,
                  greatest(
                    -1,
                    cos(radians(${driver.last_lat})) *
                    cos(radians(r.pickup_lat)) *
                    cos(radians(r.pickup_lng) - radians(${driver.last_lng})) +
                    sin(radians(${driver.last_lat})) *
                    sin(radians(r.pickup_lat))
                  )
                )
              )
            ) <= ${nearbyRideRadiusKm}
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
