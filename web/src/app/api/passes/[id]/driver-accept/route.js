import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";
import { assertDriverAvailable } from "@/app/api/utils/driver-conflicts";
import { sendPushToUsers } from "@/app/api/utils/push-notifications";

export async function POST(request, { params }) {
  try {
    const session = await auth(request);
    if (!session?.user?.id)
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (session.user.role !== "driver")
      return Response.json(
        { error: "Only drivers can accept pass offers" },
        { status: 403 },
      );
    const result = await sql.transaction(async (tx) => {
      const driverRows = await tx`
        SELECT d.id, p.accepts_pass_subscriptions, p.max_active_passes,
          p.preferred_zone_lat, p.preferred_zone_lng, p.preferred_zone_radius_km,
          p.preferred_shift
        FROM drivers d
        JOIN driver_pass_preferences p ON p.driver_id = d.id
        WHERE d.user_id = ${session.user.id} AND p.accepts_pass_subscriptions = true
        LIMIT 1
      `;
      const driver = driverRows[0];
      if (!driver)
        return {
          status: 403,
          error: "Enable pass subscriptions before accepting offers",
        };
      const passRows = await tx`
        SELECT pass.*
        FROM commuter_passes pass
        WHERE pass.id = ${params.id}
          AND pass.status = 'PENDING_MATCH'
          AND pass.payment_status = 'PAID'
          AND pass.driver_id IS NULL
          AND ${driver.preferred_zone_lat}::double precision IS NOT NULL
          AND ${driver.preferred_zone_lng}::double precision IS NOT NULL
          AND ST_DWithin(
            ST_SetSRID(ST_MakePoint(pass.pickup_lng, pass.pickup_lat), 4326)::geography,
            ST_SetSRID(ST_MakePoint(${driver.preferred_zone_lng}, ${driver.preferred_zone_lat}), 4326)::geography,
            ${driver.preferred_zone_radius_km} * 1000
          )
          AND (
            ${driver.preferred_shift} IN ('ANY', 'BOTH')
            OR (${driver.preferred_shift} = 'MORNING' AND pass.scheduled_time < '12:00'::time)
            OR (${driver.preferred_shift} = 'EVENING' AND pass.scheduled_time >= '12:00'::time)
          )
        FOR UPDATE
      `;
      const pass = passRows[0];
      if (!pass)
        return { status: 409, error: "Pass is unavailable, unpaid, or outside your preferred pickup zone" };
      await assertDriverAvailable(tx, {
        driverId: driver.id,
        scheduledDays: pass.scheduled_days,
        scheduledTime: String(pass.scheduled_time).slice(0, 5),
        sourceType: "PASS",
        excludeId: pass.id,
      });
      const countRows = await tx`
        SELECT count(*)::int AS count FROM commuter_passes
        WHERE driver_id = ${driver.id} AND status = 'ACTIVE'
      `;
      if (Number(countRows[0]?.count || 0) >= driver.max_active_passes) {
        return { status: 409, error: "Maximum active passes reached" };
      }
      const updated = await tx`
        UPDATE commuter_passes
        SET driver_id = ${driver.id}, status = 'ACTIVE', match_attempts = match_attempts + 1,
            last_match_attempt_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${pass.id} AND status = 'PENDING_MATCH' AND driver_id IS NULL
        RETURNING *
      `;
      return updated[0]
        ? { status: 200, pass: updated[0] }
        : { status: 409, error: "Another driver accepted this pass" };
    });
    if (result.error)
      return Response.json({ error: result.error }, { status: result.status });
    await Promise.allSettled([
      sendPushToUsers([result.pass.passenger_id], {
        title: "Driver found for your TukTukPass",
        body: "Your guaranteed commute driver is confirmed.",
        data: { type: "pass_match_found", passId: result.pass.id },
      }),
    ]);
    return Response.json({ pass: result.pass });
  } catch (error) {
    return Response.json(
      {
        error: error.message || "Pass acceptance failed",
        code: error.code || "PASS_ACCEPT_FAILED",
        conflict: error.conflict,
      },
      { status: error.status || 500 },
    );
  }
}
