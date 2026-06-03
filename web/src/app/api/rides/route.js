import sql from "@/app/api/utils/sql";
import { getRouteEstimate } from "@/app/api/utils/locations";
import { auth } from "@/auth";

const MAX_NEARBY_RIDE_KM = 8;

function isFiniteLatitude(value) {
  return Number.isFinite(value) && value >= -90 && value <= 90;
}

function isFiniteLongitude(value) {
  return Number.isFinite(value) && value >= -180 && value <= 180;
}

function readString(value) {
  return typeof value === "string" ? value.trim() : "";
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
    const pickupAddress = readString(pickup_address);
    const destAddress = readString(dest_address);
    const pickupPlaceId = readString(pickup_place_id) || null;
    const destPlaceId = readString(dest_place_id) || null;

    if (
      !isFiniteLatitude(pickupLat) ||
      !isFiniteLongitude(pickupLng) ||
      !isFiniteLatitude(destLat) ||
      !isFiniteLongitude(destLng) ||
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
        await sql`SELECT id, last_lat, last_lng FROM drivers WHERE user_id = ${session.user.id} LIMIT 1`;
      const driver = driverRows[0];
      if (!driver) {
        return Response.json({ rides: [] });
      }
      const hasLocation =
        isFiniteLatitude(Number(driver.last_lat)) &&
        isFiniteLongitude(Number(driver.last_lng));
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
            ) <= ${MAX_NEARBY_RIDE_KM}
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
