import sql from "@/app/api/utils/sql";
import { getAcceptedRideTimeoutMinutes, getBackToBackDispatchRadiusMeters } from "@/app/api/utils/dispatch";
import { auth } from "@/auth";
import { triggerRideEvent } from "@/lib/pusher/server";
import { sendPushToUsers } from "@/app/api/utils/push-notifications";

export async function POST(request, { params }) {
  try {
    const session = await auth(request);
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const { driverId } = await request.json();
    if (!driverId) {
      return Response.json({ error: "driverId is required" }, { status: 400 });
    }

    const result = await sql.transaction(async (tx) => {
      const backToBackRadiusMeters = getBackToBackDispatchRadiusMeters();
      await tx`
        SELECT id
        FROM drivers
        WHERE id = ${driverId}
        FOR UPDATE
      `;
      const activeRideRows = await tx`
        SELECT
          active_ride.id,
          active_ride.started_at,
          (
            active_ride.started_at IS NOT NULL
            AND driver.location IS NOT NULL
            AND ST_DWithin(
              driver.location,
              ST_SetSRID(ST_MakePoint(active_ride.dest_lng, active_ride.dest_lat), 4326)::geography,
              ${backToBackRadiusMeters}
            )
          ) AS can_queue_next
        FROM rides active_ride
        JOIN drivers driver ON driver.id = ${driverId}
        WHERE active_ride.driver_id = ${driverId}
          AND active_ride.status = 'accepted'
          AND active_ride.id <> ${id}
      `;
      if (
        activeRideRows.length > 0 &&
        !(activeRideRows.length === 1 && activeRideRows[0].can_queue_next)
      ) {
        return {
          status: 409,
          code: "DRIVER_UNAVAILABLE_FOR_NEXT_RIDE",
          error: "This driver is not available for another queued ride. Please choose a different offer.",
        };
      }

      const offerRows = await tx`
        SELECT o.*
        FROM ride_fare_offers o
        JOIN rides r ON r.id = o.ride_id
        WHERE o.ride_id = ${id}
          AND o.driver_id = ${driverId}
          AND o.offer_type = 'counter'
          AND r.passenger_id = ${session.user.id}
        LIMIT 1
      `;
      const offer = offerRows[0];
      if (!offer) {
        return { status: 404, error: "Counter offer not found" };
      }

      const rideRows = await tx`
        UPDATE rides
        SET status = 'accepted',
            driver_id = ${driverId},
            final_fare = ${offer.offered_fare},
            accepted_at = CURRENT_TIMESTAMP,
            expires_at = CURRENT_TIMESTAMP + make_interval(mins => ${getAcceptedRideTimeoutMinutes()}),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id}
          AND passenger_id = ${session.user.id}
          AND status = 'negotiating'
          AND negotiation_expires_at > CURRENT_TIMESTAMP
        RETURNING *
      `;
      if (rideRows.length === 0) {
        return { status: 409, error: "This ride is no longer available for this counter" };
      }

      await tx`
        UPDATE ride_driver_notifications
        SET status = CASE WHEN driver_id = ${driverId} THEN 'sent' ELSE 'skipped' END,
            delivered_at = CURRENT_TIMESTAMP
        WHERE ride_id = ${id}
          AND status IN ('pending', 'sent')
      `;
      await tx`
        UPDATE ride_driver_notifications
        SET status = 'skipped',
            error = 'Driver is completing another ride',
            delivered_at = COALESCE(delivered_at, CURRENT_TIMESTAMP)
        WHERE driver_id = ${driverId}
          AND ride_id <> ${id}
          AND status IN ('pending', 'sent')
      `;

      return {
        status: 200,
        ride: rideRows[0],
        offer,
        queuedNext: activeRideRows.length === 1,
      };
    });

    if (result.error) {
      return Response.json(
        { error: result.error, code: result.code },
        { status: result.status },
      );
    }

    await triggerRideEvent(id, "ride-locked", {
      rideId: id,
      driverId,
      finalFare: result.ride.final_fare,
      queuedNext: result.queuedNext,
    });
    const driverUserRows = await sql`
      SELECT user_id
      FROM drivers
      WHERE id = ${driverId}
      LIMIT 1
    `;
    await sendPushToUsers(
      driverUserRows[0]?.user_id ? [driverUserRows[0].user_id] : [],
      {
        title: "Counter offer accepted",
        body: "The passenger accepted your fare.",
        data: { type: "ride_accepted", rideId: id },
      },
    );

    return Response.json({ ride: result.ride, offer: result.offer, queuedNext: result.queuedNext || false });
  } catch (err) {
    console.error("POST /api/rides/[id]/approve-counter error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
