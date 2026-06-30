import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";
import { getRouteEstimate } from "@/app/api/utils/locations";
import {
  addDays,
  calculatePassFare,
  countScheduledRides,
  phase2Error,
  haversineMeters,
  readCoordinate,
  readDays,
  readTime,
} from "@/app/api/utils/phase2";

export async function GET(request) {
  const session = await auth(request);
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await sql`
    SELECT
      p.*,
      u.name AS driver_name,
      u.image AS driver_image,
      d.vehicle_number,
      COALESCE((
        SELECT json_agg(pr ORDER BY pr.scheduled_date ASC)
        FROM pass_rides pr
        WHERE pr.pass_id = p.id
          AND pr.scheduled_date >= CURRENT_DATE
          AND pr.scheduled_date < CURRENT_DATE + 8
      ), '[]'::json) AS upcoming_rides
    FROM commuter_passes p
    LEFT JOIN drivers d ON d.id = p.driver_id
    LEFT JOIN auth_users u ON u.id = d.user_id
    WHERE p.passenger_id = ${session.user.id}
    ORDER BY p.created_at DESC
  `;
  return Response.json({ passes: rows });
}

export async function POST(request) {
  try {
    const session = await auth(request);
    if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (session.user.role !== "passenger") {
      return Response.json({ error: "Only passengers can create a TukTukPass" }, { status: 403 });
    }
    const body = await request.json();
    const pickup = readCoordinate(body.pickup || { lat: body.pickup_lat, lng: body.pickup_lng, label: body.pickup_label });
    const dropoff = readCoordinate(body.dropoff || { lat: body.dropoff_lat, lng: body.dropoff_lng, label: body.dropoff_label });
    const scheduledDays = readDays(body.scheduledDays || body.scheduled_days);
    const scheduledTime = readTime(body.scheduledTime || body.scheduled_time);
    const requestedDuration = String(body.durationType || body.duration_type || "").toUpperCase();
    const durationType = requestedDuration === "WEEKLY" || requestedDuration === "MONTHLY" ? requestedDuration : null;
    const startDate = /^\d{4}-\d{2}-\d{2}$/.test(body.startDate || "") ? body.startDate : new Date().toISOString().slice(0, 10);
    if (!pickup || !dropoff || !scheduledDays || !scheduledTime || !durationType) {
      return Response.json(
        { error: "Valid route, days, time, and duration are required", code: "INVALID_PASS_INPUT" },
        { status: 400 },
      );
    }
    if (Number(scheduledTime.slice(0, 2)) < 5) {
      return Response.json({ error: "Pass rides are not available before 5 AM", code: "PASS_TIME_TOO_EARLY" }, { status: 400 });
    }
    const distanceMeters = haversineMeters(pickup.lat, pickup.lng, dropoff.lat, dropoff.lng);
    if (!Number.isFinite(distanceMeters) || distanceMeters < 100) {
      return Response.json({ error: "Pickup and drop must be different locations", code: "PASS_ROUTE_TOO_SHORT" }, { status: 400 });
    }
    const endDate = addDays(startDate, durationType === "WEEKLY" ? 6 : 29);
    const rideCount = countScheduledRides(startDate, endDate, scheduledDays);
    if (rideCount < 1) {
      return Response.json({ error: "Schedule does not contain any rides", code: "EMPTY_PASS_SCHEDULE" }, { status: 400 });
    }
    const estimate = await getRouteEstimate(pickup.lat, pickup.lng, dropoff.lat, dropoff.lng);
    const comparable = await sql`
      SELECT round(avg(estimated_fare))::int AS average_fare, count(*)::int AS sample_size
      FROM rides
      WHERE status = 'completed' AND created_at > CURRENT_TIMESTAMP - INTERVAL '30 days'
        AND distance_km IS NOT NULL AND estimated_fare > 0
        AND abs(distance_km - ${estimate.distanceKm}) <= greatest(1, ${estimate.distanceKm} * 0.2)
    `;
    const marketFare = Number(comparable[0]?.sample_size || 0) >= 5
      ? Number(comparable[0].average_fare)
      : estimate.estimatedFare;
    const fare = calculatePassFare({ estimatedFareRupees: marketFare, rideCount });
    const passRows = await sql`
      INSERT INTO commuter_passes (
        passenger_id, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, pickup_label, dropoff_label,
        scheduled_days, scheduled_time, duration_type, agreed_fare,
        platform_fee, driver_payout, start_date, end_date
      ) VALUES (
        ${session.user.id},
        ${pickup.lat}, ${pickup.lng}, ${dropoff.lat}, ${dropoff.lng},
        ${pickup.label}, ${dropoff.label}, ${scheduledDays}::text[], ${scheduledTime}::time,
        ${durationType}, ${fare.agreedFare}, ${fare.platformFee},
        ${fare.driverPayout}, ${startDate}::date, ${endDate}::date
      ) RETURNING *
    `;
    const pass = passRows[0];
    const overlapRows = await sql`
      SELECT count(*)::int AS count
      FROM commuter_passes existing
      WHERE existing.id <> ${pass.id}
        AND existing.status = 'ACTIVE'
        AND abs(existing.pickup_lat - ${pickup.lat}) < 0.004
        AND abs(existing.pickup_lng - ${pickup.lng}) < 0.004
        AND abs(existing.dropoff_lat - ${dropoff.lat}) < 0.004
        AND abs(existing.dropoff_lng - ${dropoff.lng}) < 0.004
        AND existing.scheduled_days && ${scheduledDays}::text[]
        AND abs(extract(epoch FROM (existing.scheduled_time - ${scheduledTime}::time))) < 900
    `;
    return Response.json(
      {
        pass,
        paymentRequired: true,
        fare: { ...fare, rideCount },
        sharedRouteOpportunity: Number(overlapRows[0]?.count || 0) > 0,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/passes error:", error);
    return phase2Error(error, "Could not create TukTukPass");
  }
}
