import sql from "@/app/api/utils/sql";
import { getRouteEstimate } from "@/app/api/utils/locations";
import {
  isLatitude,
  isLongitude,
  readBoundedString,
} from "@/app/api/utils/validation";
import {
  dispatchRideRequest,
  findZoneForPoint,
  getDriverRideRadiusMeters,
  getPassengerPostCancelCooldownSeconds,
  getPassengerSpamCooldownSeconds,
} from "@/app/api/utils/dispatch";
import { auth } from "@/auth";
import { triggerRideEvent } from "@/lib/pusher/server";
import { sendPushToUsers } from "@/app/api/utils/push-notifications";

const NEGOTIATION_WINDOW_SECONDS = 45;
const DEFAULT_VEHICLE_TYPE = "auto";
const PASSENGER_RIDE_FILTERS = new Set(["all", "pending", "completed", "cancelled"]);

function readFare(value) {
  const fare = Number(value);
  return Number.isInteger(fare) && fare > 0 ? fare : null;
}

function readPageSize(value) {
  if (value === null) return null;
  const pageSize = Number(value);
  if (!Number.isInteger(pageSize)) return 25;
  return Math.min(Math.max(pageSize, 1), 50);
}

function readOffset(value) {
  const offset = Number(value);
  return Number.isInteger(offset) && offset > 0 ? offset : 0;
}

function readPassengerRideFilter(value) {
  return PASSENGER_RIDE_FILTERS.has(value) ? value : "all";
}

function rideRequestErrorResponse(error) {
  if (error?.code === "42703" || error?.code === "42P01") {
    return Response.json(
      {
        error:
          "Database schema is out of date. Run `npm run db:migrate` from the web directory.",
        code: "DATABASE_MIGRATION_REQUIRED",
      },
      { status: 503 },
    );
  }
  return Response.json({ error: "Internal Server Error" }, { status: 500 });
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
      negotiation_mode,
      fare_min,
      fare_max,
    } = await request.json();
    const pickupLat = Number(pickup_lat);
    const pickupLng = Number(pickup_lng);
    const destLat = Number(dest_lat);
    const destLng = Number(dest_lng);
    const pickupAddress = readBoundedString(pickup_address, { min: 3, max: 500 });
    const destAddress = readBoundedString(dest_address, { min: 3, max: 500 });
    const pickupPlaceId = readBoundedString(pickup_place_id, { max: 255 });
    const destPlaceId = readBoundedString(dest_place_id, { max: 255 });
    const negotiationMode = negotiation_mode === "negotiated" ? "negotiated" : "fixed";
    const fareMin = readFare(fare_min);
    const fareMax = readFare(fare_max);
    const vehicleType = DEFAULT_VEHICLE_TYPE;

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
      AND status IN ('requested', 'negotiating', 'accepted') 
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
    if (negotiationMode === "negotiated") {
      if (!fareMin || !fareMax || fareMin > fareMax) {
        return Response.json(
          { error: "Negotiated rides require a valid minimum and maximum fare" },
          { status: 400 },
        );
      }
    }

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
        vehicle_type,
        zone_id,
        status,
        negotiation_mode,
        fare_min,
        fare_max,
        negotiation_expires_at
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
        ${vehicleType},
        ${zone.id},
        ${negotiationMode === "negotiated" ? "negotiating" : "requested"},
        ${negotiationMode},
        ${negotiationMode === "negotiated" ? fareMin : null},
        ${negotiationMode === "negotiated" ? fareMax : null},
        ${negotiationMode === "negotiated" ? new Date(Date.now() + NEGOTIATION_WINDOW_SECONDS * 1000) : null}
      )
      RETURNING *
    `;

    const dispatchedDrivers = await dispatchRideRequest(rows[0]);
    const driverUserRows = await sql`
      SELECT d.user_id
      FROM ride_driver_notifications n
      JOIN drivers d ON d.id = n.driver_id
      WHERE n.ride_id = ${rows[0].id}
        AND n.status = 'pending'
    `;
    await sendPushToUsers(
      driverUserRows.map((row) => row.user_id),
      {
        title: rows[0].status === "negotiating" ? "Fare negotiation request" : "New ride request",
        body: `A nearby passenger is requesting a ${vehicleType}.`,
        data: { type: rows[0].status, rideId: rows[0].id },
      },
    );
    if (rows[0].status === "negotiating") {
      await triggerRideEvent(rows[0].id, "negotiation-started", {
        rideId: rows[0].id,
        fareMin: rows[0].fare_min,
        fareMax: rows[0].fare_max,
        expiresAt: rows[0].negotiation_expires_at,
      });
    }

    return Response.json({ ride: rows[0], zone, dispatchedDrivers }, { status: 202 });
  } catch (err) {
    console.error("POST /api/rides error:", err);
    return rideRequestErrorResponse(err);
  }
}

export async function GET(request) {
  try {
    const session = await auth(request);
    if (!session || !session.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = new URL(request.url);
    const pageSize = readPageSize(url.searchParams.get("pageSize"));
    const offset = readOffset(url.searchParams.get("offset"));
    const filter = readPassengerRideFilter(url.searchParams.get("filter"));

    // Determine if we're fetching as passenger or driver
    const userRows =
      await sql`SELECT role FROM auth_users WHERE id = ${session.user.id} LIMIT 1`;
    const role = userRows[0]?.role;

    let rides;
    if (role === "driver") {
      const driverRows =
        await sql`
          UPDATE drivers
          SET last_heartbeat_at = CASE
                WHEN is_online = true THEN CURRENT_TIMESTAMP
                ELSE last_heartbeat_at
              END,
              location = CASE
                WHEN last_lat IS NOT NULL AND last_lng IS NOT NULL
                THEN ST_SetSRID(ST_MakePoint(last_lng, last_lat), 4326)::geography
                ELSE location
              END,
              updated_at = CASE
                WHEN is_online = true THEN CURRENT_TIMESTAMP
                ELSE updated_at
              END
          WHERE user_id = ${session.user.id}
          RETURNING id, zone_id
        `;
      const driver = driverRows[0];
      if (!driver) {
        return Response.json({ rides: [] });
      }

      await sql`
        INSERT INTO ride_driver_notifications (ride_id, driver_id, channel, status, payload)
        SELECT
          r.id,
          ${driver.id},
          'websocket',
          'pending',
          jsonb_build_object(
            'type',
            CASE WHEN r.status = 'negotiating' THEN 'fare_negotiation' ELSE 'ride_request' END,
            'ride_id',
            r.id
          )
        FROM rides r
        JOIN drivers d ON d.id = ${driver.id}
        WHERE r.status IN ('requested', 'negotiating')
          AND r.driver_id IS NULL
          AND r.zone_id = d.zone_id
          AND d.is_online = true
          AND d.is_approved = true
          AND d.subscription_expiry > CURRENT_TIMESTAMP
          AND d.location IS NOT NULL
          AND ST_DWithin(
            d.location,
            ST_SetSRID(ST_MakePoint(r.pickup_lng, r.pickup_lat), 4326)::geography,
            ${getDriverRideRadiusMeters()}
          )
        ON CONFLICT (ride_id, driver_id, channel) DO NOTHING
      `;

      rides = await sql`
        SELECT
          r.*,
          (r.status = 'accepted' AND r.driver_id = ${driver.id}) AS can_call,
          z.name as zone_name,
          COALESCE((
            SELECT json_agg(o ORDER BY o.responded_at DESC)
            FROM ride_fare_offers o
            WHERE o.ride_id = r.id
          ), '[]'::json) as fare_offers
        FROM rides r
        LEFT JOIN geo_zones z ON z.id = r.zone_id
        WHERE
          r.driver_id = ${driver.id}
          OR (
            r.status IN ('requested', 'negotiating')
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
      const countsRows = await sql`
        SELECT
          count(*)::int AS total_all,
          count(*) FILTER (WHERE status IN ('requested', 'negotiating', 'accepted'))::int AS pending,
          count(*) FILTER (WHERE status = 'completed')::int AS completed,
          count(*) FILTER (WHERE status = 'cancelled')::int AS cancelled
        FROM rides
        WHERE passenger_id = ${session.user.id}
      `;
      const countRow = countsRows[0] || {};
      const counts = {
        all: countRow.total_all || 0,
        pending: countRow.pending || 0,
        completed: countRow.completed || 0,
        cancelled: countRow.cancelled || 0,
      };
      const total = counts[filter] ?? counts.all;
      const limitedPageSize = pageSize ?? Math.max(total, 1);

      if (filter === "pending") {
        rides = await sql`
          SELECT
            r.*,
            d.vehicle_number,
            d.vehicle_type as driver_vehicle_type,
            d.auto_photo_url,
            du.name as driver_name,
            du.image as driver_image,
            d.last_lat as driver_last_lat,
            d.last_lng as driver_last_lng,
            (r.status = 'accepted' AND r.driver_id IS NOT NULL) AS can_call,
            COALESCE((
              SELECT json_agg(o ORDER BY o.responded_at DESC)
              FROM ride_fare_offers o
              WHERE o.ride_id = r.id
            ), '[]'::json) as fare_offers
          FROM rides r
          LEFT JOIN drivers d ON r.driver_id = d.id
          LEFT JOIN auth_users du ON d.user_id = du.id
          WHERE r.passenger_id = ${session.user.id}
            AND r.status IN ('requested', 'negotiating', 'accepted')
          ORDER BY r.created_at DESC
          LIMIT ${limitedPageSize}
          OFFSET ${offset}
        `;
      } else if (filter === "completed" || filter === "cancelled") {
        rides = await sql`
          SELECT
            r.*,
            d.vehicle_number,
            d.vehicle_type as driver_vehicle_type,
            d.auto_photo_url,
            du.name as driver_name,
            du.image as driver_image,
            d.last_lat as driver_last_lat,
            d.last_lng as driver_last_lng,
            (r.status = 'accepted' AND r.driver_id IS NOT NULL) AS can_call,
            COALESCE((
              SELECT json_agg(o ORDER BY o.responded_at DESC)
              FROM ride_fare_offers o
              WHERE o.ride_id = r.id
            ), '[]'::json) as fare_offers
          FROM rides r
          LEFT JOIN drivers d ON r.driver_id = d.id
          LEFT JOIN auth_users du ON d.user_id = du.id
          WHERE r.passenger_id = ${session.user.id}
            AND r.status = ${filter}
          ORDER BY r.created_at DESC
          LIMIT ${limitedPageSize}
          OFFSET ${offset}
        `;
      } else {
        rides = await sql`
          SELECT
            r.*,
            d.vehicle_number,
            d.vehicle_type as driver_vehicle_type,
            d.auto_photo_url,
            du.name as driver_name,
            du.image as driver_image,
            d.last_lat as driver_last_lat,
            d.last_lng as driver_last_lng,
            (r.status = 'accepted' AND r.driver_id IS NOT NULL) AS can_call,
            COALESCE((
              SELECT json_agg(o ORDER BY o.responded_at DESC)
              FROM ride_fare_offers o
              WHERE o.ride_id = r.id
            ), '[]'::json) as fare_offers
          FROM rides r
          LEFT JOIN drivers d ON r.driver_id = d.id
          LEFT JOIN auth_users du ON d.user_id = du.id
          WHERE r.passenger_id = ${session.user.id}
          ORDER BY r.created_at DESC
          LIMIT ${limitedPageSize}
          OFFSET ${offset}
        `;
      }

      return Response.json({
        rides,
        counts,
        total,
        nextOffset: pageSize && offset + pageSize < total ? offset + pageSize : null,
        pageSize,
      });
    }

    return Response.json({ rides });
  } catch (err) {
    console.error("GET /api/rides error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
