import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";
import {
  getBackToBackDispatchRadiusMeters,
  getAcceptedRideTimeoutMinutes,
} from "@/app/api/utils/dispatch";
import { sendPushToUsers } from "@/app/api/utils/push-notifications";
import { triggerRideEvent } from "@/lib/pusher/server";
import { currentServiceSlot, findDriverConflict } from "@/app/api/utils/driver-conflicts";

function readCancellationReason(value, fallback) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, 180);
}

function readRatingFeedback(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > 280) return undefined;
  return trimmed;
}

export async function PATCH(request, { params }) {
  try {
    const session = await auth(request);
    if (!session || !session.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const body = await request.json();
    const { action } = body;

    if (action === "rate") {
      const driverRating = Number(body.driver_rating);
      const ratingFeedback = readRatingFeedback(body.rating_feedback);
      if (
        !Number.isInteger(driverRating) ||
        driverRating < 1 ||
        driverRating > 5 ||
        ratingFeedback === undefined
      ) {
        return Response.json(
          { error: "driver_rating must be 1-5 and rating_feedback must be 280 characters or fewer" },
          { status: 400 },
        );
      }

      const result = await sql`
        UPDATE rides
        SET driver_rating = ${driverRating},
            rating_feedback = ${ratingFeedback},
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id}
          AND passenger_id = ${session.user.id}
          AND status = 'completed'
          AND driver_rating IS NULL
        RETURNING *
      `;
      if (result.length === 0) {
        return Response.json(
          { error: "Ride cannot be rated because it is not completed, already rated, or not accessible to this user" },
          { status: 409 },
        );
      }
      return Response.json({ ride: result[0] });
    }

    const driverRows =
      await sql`
        UPDATE drivers
        SET zone_id = CASE
              WHEN location IS NOT NULL THEN COALESCE((
                SELECT z.id
                FROM geo_zones z
                WHERE z.is_active = true
                  AND z.dispatch_enabled = true
                  AND ST_Covers(z.boundary::geometry, location::geometry)
                ORDER BY z.created_at ASC
                LIMIT 1
              ), zone_id)
              ELSE zone_id
            END,
            updated_at = CASE
              WHEN is_online = true THEN CURRENT_TIMESTAMP
              ELSE updated_at
            END
        WHERE user_id = ${session.user.id}
        RETURNING id, zone_id, is_online, is_approved, subscription_expiry
      `;
    const driver = driverRows[0];
    const driverId = driver?.id || null;

    if (action === "rate_passenger") {
      const passengerRating = Number(body.passenger_rating);
      const passengerFeedback = readRatingFeedback(
        body.passenger_rating_feedback,
      );
      if (
        !driverId ||
        !Number.isInteger(passengerRating) ||
        passengerRating < 1 ||
        passengerRating > 5 ||
        passengerFeedback === undefined
      ) {
        return Response.json(
          {
            error:
              "passenger_rating must be 1-5 and feedback must be 280 characters or fewer",
          },
          { status: 400 },
        );
      }

      const result = await sql`
        UPDATE rides
        SET passenger_rating = ${passengerRating},
            passenger_rating_feedback = ${passengerFeedback},
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id}
          AND driver_id = ${driverId}
          AND status = 'completed'
          AND passenger_rating IS NULL
        RETURNING *
      `;
      if (result.length === 0) {
        return Response.json(
          {
            error:
              "Passenger cannot be rated because the ride is not completed, already rated, or not assigned to this driver",
          },
          { status: 409 },
        );
      }
      return Response.json({ ride: result[0] });
    }

    if (action === "accept") {
      if (!driverId)
        return Response.json(
          { error: "Only drivers can accept rides" },
          { status: 403 },
        );

      if (
        !driver.is_online ||
        !driver.is_approved ||
        !driver.subscription_expiry ||
        new Date(driver.subscription_expiry) <= new Date()
      ) {
        return Response.json(
          { error: "Driver must be online, approved, and subscribed to accept rides" },
          { status: 403 },
        );
      }

      const backToBackRadiusMeters = getBackToBackDispatchRadiusMeters();
      const serviceSlot = currentServiceSlot();
      const acceptance = await sql.transaction(async (tx) => {
        await tx`
          SELECT id
          FROM drivers
          WHERE id = ${driverId}
          FOR UPDATE
        `;
        const scheduleConflict = await findDriverConflict(tx, {
          driverId,
          scheduledDays: serviceSlot.days,
          scheduledTime: serviceSlot.time,
          sourceType: "ON_DEMAND",
        });
        if (scheduleConflict) {
          return {
            busyRide: null,
            busyCode: "DRIVER_SCHEDULE_CONFLICT",
            scheduleConflict,
            rows: [],
          };
        }
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
          ORDER BY active_ride.started_at DESC NULLS LAST, active_ride.accepted_at ASC
        `;
        if (activeRideRows.length > 0) {
          const currentRide = activeRideRows[0];
          const canQueueNext = activeRideRows.length === 1 && currentRide.can_queue_next;
          if (!canQueueNext) {
            return {
              busyRide: currentRide,
              busyCode: activeRideRows.length > 1
                ? "DRIVER_QUEUE_FULL"
                : currentRide.started_at
                  ? "DRIVER_NOT_NEAR_DROPOFF"
                  : "DRIVER_ACTIVE_RIDE",
              rows: [],
            };
          }
        }

        const rows = await tx`
          UPDATE rides 
          SET driver_id = ${driverId}, 
              status = 'accepted',
              final_fare = COALESCE(final_fare, estimated_fare),
              accepted_at = CURRENT_TIMESTAMP,
              expires_at = CURRENT_TIMESTAMP + make_interval(mins => ${getAcceptedRideTimeoutMinutes()}),
              updated_at = CURRENT_TIMESTAMP
          FROM drivers d -- PATCHED:
          WHERE rides.id = ${id} -- PATCHED:
            AND rides.status = 'requested' -- PATCHED:
            AND rides.driver_id IS NULL -- PATCHED:
            AND rides.zone_id = ${driver.zone_id} -- PATCHED:
            AND d.id = ${driverId}
            AND d.subscription_expiry > NOW() -- PATCHED:
            AND EXISTS (
              SELECT 1
              FROM ride_driver_notifications n
              WHERE n.ride_id = rides.id AND n.driver_id = ${driverId}
            )
          RETURNING *
        `;
        if (rows.length > 0) {
          await tx`
            UPDATE ride_driver_notifications
            SET status = 'sent', delivered_at = CURRENT_TIMESTAMP
            WHERE ride_id = ${id} AND driver_id = ${driverId} AND channel = 'websocket'
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
        }
        return {
          busyRide: null,
          busyCode: null,
          queuedNext: activeRideRows.length === 1,
          rows,
        };
      });

      if (acceptance.scheduleConflict) {
        return Response.json(
          {
            error: "You have a higher-priority recurring assignment at this time",
            code: "DRIVER_SCHEDULE_CONFLICT",
            conflict: acceptance.scheduleConflict,
          },
          { status: 409 },
        );
      }

      if (acceptance.busyRide) {
        return Response.json(
          {
            error: acceptance.busyCode === "DRIVER_QUEUE_FULL"
              ? "You already have a next ride. Complete the current ride before accepting more."
              : "Next rides become available when you are close to the current drop-off.",
            code: acceptance.busyCode,
            activeRideId: acceptance.busyRide.id,
          },
          { status: 409 },
        );
      }
      const result = acceptance.rows;

      if (result.length === 0) {
        const rideRows = await sql`
          SELECT status, driver_id, zone_id
          FROM rides
          WHERE id = ${id}
          LIMIT 1
        `;
        const ride = rideRows[0];
        if (!ride) {
          return Response.json(
            { error: "Ride is no longer available", code: "RIDE_UNAVAILABLE" },
            { status: 409 },
          );
        }
        if (ride.status === "cancelled") {
          return Response.json(
            { error: "Passenger cancelled this ride", code: "RIDE_CANCELLED" },
            { status: 409 },
          );
        }
        if (ride.driver_id || ride.status === "accepted") {
          return Response.json(
            { error: "Ride was already accepted by another driver", code: "RIDE_ALREADY_ACCEPTED" },
            { status: 409 },
          );
        }
        if (ride.status !== "requested") {
          return Response.json(
            { error: "Ride is no longer available", code: "RIDE_UNAVAILABLE" },
            { status: 409 },
          );
        }
        return Response.json(
          { error: "Ride cannot be accepted right now", code: "RIDE_ACCEPT_UNAVAILABLE" },
          { status: 409 },
        );
      }
      await sendPushToUsers([result[0].passenger_id], {
        title: acceptance.queuedNext ? "Driver accepted your ride as next" : "Driver accepted your ride",
        body: acceptance.queuedNext
          ? "Your driver is finishing a nearby trip and will come to you next."
          : "Your driver is heading to the pickup location.",
        data: { type: "ride_accepted", rideId: result[0].id },
      });
      await triggerRideEvent(result[0].id, "ride-accepted", {
        rideId: result[0].id,
        acceptedAt: result[0].accepted_at,
        queuedNext: acceptance.queuedNext,
      });
      return Response.json({ ride: result[0] });
    }

    if (action === "complete") {
      if (!driverId) {
        return Response.json(
          { error: "Only the assigned driver can complete a ride" },
          { status: 403 },
        );
      }
      const result = await sql`
        UPDATE rides 
        SET status = 'completed',
            final_fare = COALESCE(final_fare, estimated_fare),
            completed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id}
          AND driver_id = ${driverId}
          AND status = 'accepted'
          AND started_at IS NOT NULL
        RETURNING *
      `;
      if (result.length === 0) {
        return Response.json(
          { error: "Ride must be started before it can be completed" },
          { status: 409 },
        );
      }
      await sendPushToUsers([result[0].passenger_id], {
        title: "Ride completed",
        body: "Your trip has been marked complete.",
        data: { type: "ride_completed", rideId: result[0].id },
      });
      await triggerRideEvent(result[0].id, "ride-completed", {
        rideId: result[0].id,
        completedAt: result[0].completed_at,
      });
      const nextRideRows = await sql`
        UPDATE rides
        SET accepted_at = CURRENT_TIMESTAMP,
            expires_at = CURRENT_TIMESTAMP + make_interval(mins => ${getAcceptedRideTimeoutMinutes()}),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = (
          SELECT id
          FROM rides
          WHERE driver_id = ${driverId}
            AND status = 'accepted'
            AND started_at IS NULL
            AND id <> ${result[0].id}
          ORDER BY accepted_at ASC
          LIMIT 1
        )
        RETURNING id, passenger_id
      `;
      const nextRide = nextRideRows[0];
      if (nextRide) {
        await sendPushToUsers([nextRide.passenger_id], {
          title: "Driver is heading to you",
          body: "The previous trip is complete. Your driver is now coming to your pickup.",
          data: { type: "driver_ready", rideId: nextRide.id },
        });
        await triggerRideEvent(nextRide.id, "driver-ready", {
          rideId: nextRide.id,
          previousRideId: result[0].id,
        });
      }
      return Response.json({ ride: result[0] });
    }

    if (action === "start") {
      if (!driverId) {
        return Response.json(
          { error: "Only the assigned driver can start a ride" },
          { status: 403 },
        );
      }
      const result = await sql`
        UPDATE rides
        SET started_at = COALESCE(started_at, CURRENT_TIMESTAMP),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id}
          AND driver_id = ${driverId}
          AND status = 'accepted'
        RETURNING *
      `;
      if (result.length === 0) {
        return Response.json(
          { error: "Ride cannot be started because it is not assigned to this driver or is no longer active" },
          { status: 409 },
        );
      }
      await Promise.allSettled([
        sendPushToUsers([result[0].passenger_id], {
          title: "Ride started",
          body: "Your trip has started.",
          data: { type: "ride_started", rideId: result[0].id },
        }),
        triggerRideEvent(result[0].id, "ride-started", {
          rideId: result[0].id,
          startedAt: result[0].started_at,
        }),
      ]);
      return Response.json({ ride: result[0] });
    }

    if (action === "cancel") {
      // Both passenger and driver can cancel requested/accepted rides
      const actorReason = readCancellationReason(
        body.reason,
        driverId ? "driver_cancelled" : "passenger_cancelled",
      );
      const result = await sql.transaction(async (tx) => {
        const rows = await tx`
          UPDATE rides
          SET status = 'cancelled',
              cancelled_at = CURRENT_TIMESTAMP,
              cancellation_reason = ${actorReason},
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ${id}
          AND (passenger_id = ${session.user.id} OR driver_id = ${driverId})
          AND status IN ('requested', 'negotiating', 'accepted')
          RETURNING *
        `;
        if (rows.length > 0) {
          await tx`
            UPDATE ride_driver_notifications
            SET status = 'skipped',
                error = ${`Ride cancelled: ${actorReason}`},
                delivered_at = COALESCE(delivered_at, CURRENT_TIMESTAMP)
            WHERE ride_id = ${id}
              AND status IN ('pending', 'failed', 'sent')
          `;
        }
        return rows;
      });
      if (result.length === 0) {
        return Response.json(
          { error: "Ride cannot be cancelled because it was not found, is already closed, or is not accessible to this user" },
          { status: 409 },
        );
      }
      const cancelledRide = result[0];
      const notifyUserIds = [];
      if (driverId && cancelledRide.passenger_id) {
        notifyUserIds.push(cancelledRide.passenger_id);
      } else if (cancelledRide.driver_id) {
        const driverUserRows = await sql`
          SELECT user_id
          FROM drivers
          WHERE id = ${cancelledRide.driver_id}
          LIMIT 1
        `;
        if (driverUserRows[0]?.user_id) notifyUserIds.push(driverUserRows[0].user_id);
      }
      await sendPushToUsers(notifyUserIds, {
        title: driverId ? "Driver cancelled the ride" : "Passenger cancelled the ride",
        body: driverId
          ? "Your driver can no longer complete this ride."
          : "The passenger has cancelled this ride.",
        data: {
          type: "ride_cancelled",
          rideId: cancelledRide.id,
          actorRole: driverId ? "driver" : "passenger",
          reason: actorReason,
        },
      });
      await triggerRideEvent(cancelledRide.id, "ride-cancelled", {
        rideId: cancelledRide.id,
        actorRole: driverId ? "driver" : "passenger",
        reason: actorReason,
        cancelledAt: cancelledRide.cancelled_at || new Date().toISOString(),
      });
      return Response.json({ ride: result[0] });
    }

    return Response.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    console.error("PATCH /api/rides/[id] error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function GET(request, { params }) {
  try {
    const session = await auth(request);
    if (!session || !session.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const rows = await sql`
      SELECT
        r.*,
        d.vehicle_number,
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
      JOIN auth_users requester ON requester.id = ${session.user.id}
      WHERE r.id = ${id}
      AND (
        r.passenger_id = ${session.user.id}
        OR d.user_id = ${session.user.id}
        OR requester.role = 'admin'
      )
      LIMIT 1
    `;
    return Response.json({ ride: rows[0] || null });
  } catch (err) {
    console.error("GET /api/rides/[id] error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
