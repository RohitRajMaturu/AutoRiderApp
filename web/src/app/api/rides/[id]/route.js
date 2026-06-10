import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";
import {
  autoCancelGhostRides,
  getAcceptedRideTimeoutMinutes,
  offlineExpiredDrivers,
} from "@/app/api/utils/dispatch";

export async function PATCH(request, { params }) {
  try {
    const session = await auth(request);
    if (!session || !session.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const { action } = await request.json();
    await autoCancelGhostRides();
    await offlineExpiredDrivers();

    const driverRows =
      await sql`
        SELECT id, zone_id, is_online, is_approved, subscription_expiry
        FROM drivers
        WHERE user_id = ${session.user.id}
        LIMIT 1
      `;
    const driver = driverRows[0];
    const driverId = driver?.id;

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

      const result = await sql.transaction(async (tx) => {
        const rows = await tx`
          UPDATE rides 
          SET driver_id = ${driverId}, 
              status = 'accepted',
              accepted_at = CURRENT_TIMESTAMP,
              expires_at = CURRENT_TIMESTAMP + make_interval(mins => ${getAcceptedRideTimeoutMinutes()}),
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ${id}
            AND status = 'requested'
            AND driver_id IS NULL
            AND zone_id = ${driver.zone_id}
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
        }
        return rows;
      });

      if (result.length === 0) {
        return Response.json(
          { error: "Ride already accepted by another driver or cancelled" },
          { status: 400 },
        );
      }
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
            completed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id} AND driver_id = ${driverId} AND status = 'accepted'
        RETURNING *
      `;
      if (result.length === 0) {
        return Response.json(
          { error: "Ride cannot be completed because it is not assigned to this driver or is no longer active" },
          { status: 409 },
        );
      }
      return Response.json({ ride: result[0] });
    }

    if (action === "cancel") {
      // Both passenger and driver can cancel requested/accepted rides
      const result = await sql`
        UPDATE rides 
        SET status = 'cancelled',
            cancelled_at = CURRENT_TIMESTAMP,
            cancellation_reason = 'user_cancelled',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id} 
        AND (passenger_id = ${session.user.id} OR driver_id = ${driverId})
        AND status IN ('requested', 'accepted')
        RETURNING *
      `;
      if (result.length === 0) {
        return Response.json(
          { error: "Ride cannot be cancelled because it was not found, is already closed, or is not accessible to this user" },
          { status: 409 },
        );
      }
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
      SELECT r.*, d.vehicle_number, d.auto_photo_url, du.phone as driver_phone, pu.phone as passenger_phone
      FROM rides r
      LEFT JOIN drivers d ON r.driver_id = d.id
      LEFT JOIN auth_users du ON d.user_id = du.id
      JOIN auth_users pu ON r.passenger_id = pu.id
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
