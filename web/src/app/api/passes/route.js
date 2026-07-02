import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";
import { getPlaceDetails, getRouteEstimate } from "@/app/api/utils/locations";
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
import { PASS_TERMS_VERSION } from "@/app/api/utils/pass-terms";

async function resolveCoordinateInput(value) {
  const direct = readCoordinate(value);
  if (direct) return direct;

  const label = String(value?.label || value?.address || "").trim();
  if (label.length < 3) return null;

  // Do not guess from free text: the first autocomplete result may be a
  // different destination. Clients must send selected coordinates/placeId.
  let place = value?.placeId ? await getPlaceDetails(String(value.placeId)) : null;
  if (place?.placeId && (!Number.isFinite(Number(place.lat)) || !Number.isFinite(Number(place.lng)))) {
    place = await getPlaceDetails(place.placeId);
  }
  return readCoordinate({
    label: place?.address || place?.label || label,
    lat: place?.lat,
    lng: place?.lng,
  });
}

export async function GET(request) {
  const session = await auth(request);
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await sql`
    SELECT
      p.*,
      (p.end_date < (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date) AS is_stale,
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
    const requestedConsentId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.termsConsentId || "")
      ? body.termsConsentId
      : null;
    const pickup = await resolveCoordinateInput(body.pickup || { lat: body.pickup_lat, lng: body.pickup_lng, label: body.pickup_label });
    const dropoff = await resolveCoordinateInput(body.dropoff || { lat: body.dropoff_lat, lng: body.dropoff_lng, label: body.dropoff_label });
    const scheduledDays = readDays(body.scheduledDays || body.scheduled_days);
    const scheduledTime = readTime(body.scheduledTime || body.scheduled_time);
    const requestedDuration = String(body.durationType || body.duration_type || "").toUpperCase();
    const durationType = requestedDuration === "WEEKLY" || requestedDuration === "MONTHLY" ? requestedDuration : null;
    const startDate = /^\d{4}-\d{2}-\d{2}$/.test(body.startDate || "") ? body.startDate : new Date().toISOString().slice(0, 10);
    if (!pickup || !dropoff || !scheduledDays || !scheduledTime || !durationType) {
      const fieldErrors = {
        ...(!pickup ? { pickup: "We couldn't verify the pickup. Search again or use current location." } : {}),
        ...(!dropoff ? { dropoff: "We couldn't verify the destination. Enter a more specific address and try again." } : {}),
        ...(!scheduledDays ? { scheduledDays: "Choose at least one travel day" } : {}),
        ...(!scheduledTime ? { scheduledTime: "Choose a valid pickup time" } : {}),
        ...(!durationType ? { durationType: "Choose weekly or monthly" } : {}),
      };
      return Response.json(
        {
          error: Object.values(fieldErrors)[0] || "Complete the pass details before continuing",
          code: "INVALID_PASS_INPUT",
          fieldErrors,
        },
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
    const creation = await sql.transaction(async (tx) => {
      // Serialize pass creation per passenger so two simultaneous requests
      // cannot both pass the overlap check.
      await tx`SELECT id FROM auth_users WHERE id = ${session.user.id} FOR UPDATE`;
      const conflictRows = await tx`
        SELECT id, pickup_label, dropoff_label, scheduled_time, scheduled_days
        FROM commuter_passes
        WHERE passenger_id = ${session.user.id}
          AND status IN ('PENDING_MATCH', 'ACTIVE', 'PAUSED')
          AND start_date <= ${endDate}::date
          AND end_date >= ${startDate}::date
          AND scheduled_days && ${scheduledDays}::text[]
          AND abs(extract(epoch FROM (scheduled_time - ${scheduledTime}::time))) <= 7200
        ORDER BY created_at DESC
        LIMIT 1
      `;
      if (conflictRows[0]) return { conflict: conflictRows[0] };

      const currentPassRows = await tx`
        SELECT EXISTS(
          SELECT 1 FROM commuter_passes
          WHERE passenger_id = ${session.user.id}
            AND status IN ('PENDING_MATCH', 'ACTIVE', 'PAUSED')
            AND end_date >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date
        ) AS has_current_pass
      `;
      let consentId = null;
      if (!currentPassRows[0]?.has_current_pass) {
        const consentRows = await tx`
          SELECT id FROM pass_terms_consents
          WHERE id = ${requestedConsentId}
            AND passenger_id = ${session.user.id}
            AND terms_version = ${PASS_TERMS_VERSION}
            AND pass_id IS NULL
            AND consumed_at IS NULL
          FOR UPDATE
        `;
        if (!consentRows[0]) return { consentRequired: true };
        consentId = consentRows[0].id;
      }

      const passRows = await tx`
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
      if (consentId) {
        await tx`
          UPDATE pass_terms_consents
          SET pass_id = ${passRows[0].id}, consumed_at = CURRENT_TIMESTAMP
          WHERE id = ${consentId} AND pass_id IS NULL AND consumed_at IS NULL
        `;
      }
      return { pass: passRows[0] };
    });
    if (creation.conflict) {
      return Response.json(
        {
          error: `This schedule overlaps your existing ${creation.conflict.pickup_label} to ${creation.conflict.dropoff_label} pass. Choose different days or a pickup time more than 2 hours apart.`,
          code: "PASSENGER_SCHEDULE_CONFLICT",
          conflict: creation.conflict,
        },
        { status: 409 },
      );
    }
    if (creation.consentRequired) {
      return Response.json(
        {
          error: "Review and accept the TukTukPass terms before creating this pass.",
          code: "PASS_TERMS_CONSENT_REQUIRED",
          termsVersion: PASS_TERMS_VERSION,
        },
        { status: 428 },
      );
    }
    const pass = creation.pass;
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
        AND abs(extract(epoch FROM (existing.scheduled_time - ${scheduledTime}::time))) <= 7200
    `;
    return Response.json(
      {
        pass,
        paymentRequired: true,
        fare: { ...fare, rideCount },
        sharedRouteOpportunity: Number(overlapRows[0]?.count || 0) > 0,
        warnings: [],
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/passes error:", error);
    return phase2Error(error, "Could not create TukTukPass");
  }
}
