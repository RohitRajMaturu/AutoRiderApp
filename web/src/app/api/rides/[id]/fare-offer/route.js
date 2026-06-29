import sql from "@/app/api/utils/sql";
import { getAcceptedRideTimeoutMinutes } from "@/app/api/utils/dispatch";
import { auth } from "@/auth";
import { triggerRideEvent } from "@/lib/pusher/server";
import { sendPushToUsers } from "@/app/api/utils/push-notifications";

const OFFER_TYPES = new Set(["accept", "counter", "decline"]);

function readPositiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

export async function POST(request, { params }) {
  try {
    const session = await auth(request);
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const body = await request.json();
    const offerType = body.offerType || body.offer_type;
    const offeredFare = readPositiveInteger(body.offeredFare ?? body.offered_fare);

    if (!OFFER_TYPES.has(offerType)) {
      return Response.json({ error: "offerType must be accept, counter, or decline" }, { status: 400 });
    }

    const driverRows = await sql`
      SELECT id, is_online, is_approved, subscription_expiry
      FROM drivers
      WHERE user_id = ${session.user.id}
      LIMIT 1
    `;
    const driver = driverRows[0];
    if (!driver) {
      return Response.json({ error: "Only drivers can submit fare offers" }, { status: 403 });
    }
    if (
      !driver.is_online ||
      !driver.is_approved ||
      !driver.subscription_expiry ||
      new Date(driver.subscription_expiry) <= new Date()
    ) {
      return Response.json(
        { error: "Driver must be online, approved, and subscribed to respond" },
        { status: 403 },
      );
    }

    const result = await sql.transaction(async (tx) => {
      if (offerType !== "decline") {
        await tx`
          SELECT id
          FROM drivers
          WHERE id = ${driver.id}
          FOR UPDATE
        `;
        const activeRideRows = await tx`
          SELECT id
          FROM rides
          WHERE driver_id = ${driver.id}
            AND status = 'accepted'
            AND id <> ${id}
          LIMIT 1
        `;
        if (activeRideRows.length > 0) {
          return {
            status: 409,
            code: "DRIVER_ACTIVE_RIDE",
            error: "Finish your current ride before responding to another request",
          };
        }
      }

      const rideRows = await tx`
        SELECT r.*
        FROM rides r
        WHERE r.id = ${id}
          AND EXISTS (
            SELECT 1
            FROM ride_driver_notifications n
            WHERE n.ride_id = r.id
              AND n.driver_id = ${driver.id}
              AND n.status IN ('pending', 'sent')
          )
        LIMIT 1
      `;
      const ride = rideRows[0];
      if (!ride) return { status: 404, error: "Negotiated ride not found for this driver" };
      if (ride.status !== "negotiating") {
        return { status: 409, error: "This ride is no longer negotiating" };
      }
      if (new Date(ride.negotiation_expires_at) <= new Date()) {
        return { status: 409, error: "Negotiation window has expired" };
      }

      const existing = await tx`
        SELECT id
        FROM ride_fare_offers
        WHERE ride_id = ${id} AND driver_id = ${driver.id}
        LIMIT 1
      `;
      if (existing.length > 0) {
        return { status: 409, error: "You have already responded to this negotiation" };
      }

      if (offerType === "accept" && offeredFare !== null) {
        const minFare = Number(ride.fare_min);
        const maxFare = Number(ride.fare_max);
        if (offeredFare < minFare || offeredFare > maxFare) {
          return { status: 400, error: "Accepted fare must be within the passenger range" };
        }
      }
      if (offerType === "counter") {
        if (offeredFare === null || offeredFare <= Number(ride.fare_max)) {
          return { status: 400, error: "Counter fare must be greater than fare_max" };
        }
      }

      const finalOfferFare =
        offerType === "accept" ? offeredFare || ride.fare_max : offeredFare;

      if (offerType !== "accept") {
        const offerRows = await tx`
          INSERT INTO ride_fare_offers (ride_id, driver_id, offer_type, offered_fare)
          VALUES (${id}, ${driver.id}, ${offerType}, ${finalOfferFare})
          RETURNING *
        `;
        return { status: 200, ride, offer: offerRows[0] };
      }

      const acceptedRows = await tx`
        UPDATE rides
        SET status = 'accepted',
            driver_id = ${driver.id},
            final_fare = ${finalOfferFare},
            accepted_at = CURRENT_TIMESTAMP,
            expires_at = CURRENT_TIMESTAMP + make_interval(mins => ${getAcceptedRideTimeoutMinutes()}),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id}
          AND status = 'negotiating'
          AND negotiation_expires_at > CURRENT_TIMESTAMP
        RETURNING *
      `;
      if (acceptedRows.length === 0) {
        return { status: 409, error: "This ride was just accepted by another driver" };
      }

      const offerRows = await tx`
        INSERT INTO ride_fare_offers (ride_id, driver_id, offer_type, offered_fare)
        VALUES (${id}, ${driver.id}, ${offerType}, ${finalOfferFare})
        RETURNING *
      `;

      await tx`
        UPDATE ride_driver_notifications
        SET status = CASE WHEN driver_id = ${driver.id} THEN 'sent' ELSE 'skipped' END,
            delivered_at = CURRENT_TIMESTAMP
        WHERE ride_id = ${id}
          AND status IN ('pending', 'sent')
      `;
      await tx`
        UPDATE ride_driver_notifications
        SET status = 'skipped',
            error = 'Driver is completing another ride',
            delivered_at = COALESCE(delivered_at, CURRENT_TIMESTAMP)
        WHERE driver_id = ${driver.id}
          AND ride_id <> ${id}
          AND status IN ('pending', 'sent')
      `;

      return { status: 200, ride: acceptedRows[0], offer: offerRows[0] };
    });

    if (result.error) {
      return Response.json(
        { error: result.error, code: result.code },
        { status: result.status },
      );
    }

    if (offerType === "accept") {
      await triggerRideEvent(id, "ride-locked", {
        rideId: id,
        driverId: driver.id,
        finalFare: result.ride.final_fare,
      });
      await sendPushToUsers([result.ride.passenger_id], {
        title: "Driver accepted your fare",
        body: "Your negotiated ride is confirmed.",
        data: { type: "ride_accepted", rideId: id },
      });
    } else if (offerType === "counter") {
      await triggerRideEvent(id, "counter-offer", {
        rideId: id,
        driverId: driver.id,
        offeredFare: result.offer.offered_fare,
        respondedAt: result.offer.responded_at,
      });
      await sendPushToUsers([result.ride.passenger_id], {
        title: "New counter offer",
        body: "A driver sent a fare counter offer.",
        data: { type: "counter_offer", rideId: id },
      });
    }

    return Response.json({ ride: result.ride, offer: result.offer });
  } catch (err) {
    if (err?.code === "23505") {
      return Response.json(
        { error: "You have already responded to this negotiation" },
        { status: 409 },
      );
    }
    console.error("POST /api/rides/[id]/fare-offer error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
