import sql from "@/app/api/utils/sql";

function line(name, value) {
  return `${name} ${Number(value || 0)}`;
}

export async function GET() {
  try {
    const [rideRows, subscriptionRows, driverRows] = await Promise.all([
      sql`
        SELECT
          count(*) FILTER (WHERE status IN ('requested', 'negotiating', 'accepted', 'completed', 'cancelled'))::int AS created,
          count(*) FILTER (WHERE status = 'completed')::int AS completed,
          count(*) FILTER (WHERE status = 'cancelled')::int AS cancelled,
          count(*) FILTER (WHERE negotiation_mode = 'negotiated')::int AS negotiated,
          count(*) FILTER (WHERE status IN ('requested', 'negotiating'))::int AS open_requests
        FROM rides
      `,
      sql`
        SELECT
          count(*) FILTER (WHERE event_type = 'subscription.charged')::int AS renewals,
          count(*) FILTER (WHERE event_type IN ('subscription.halted', 'payment.failed'))::int AS failures
        FROM subscription_events
      `,
      sql`
        SELECT count(*)::int AS active
        FROM drivers
        WHERE is_online = true
          AND is_approved = true
          AND (subscription_expiry IS NULL OR subscription_expiry > CURRENT_TIMESTAMP)
      `,
    ]);

    const rides = rideRows[0] || {};
    const subscriptions = subscriptionRows[0] || {};
    const drivers = driverRows[0] || {};
    const body = [
      "# HELP autoride_rides_created_total Total rides created.",
      "# TYPE autoride_rides_created_total counter",
      line("autoride_rides_created_total", rides.created),
      "# TYPE autoride_rides_completed_total counter",
      line("autoride_rides_completed_total", rides.completed),
      "# TYPE autoride_rides_cancelled_total counter",
      line("autoride_rides_cancelled_total", rides.cancelled),
      "# TYPE autoride_fare_negotiations_total counter",
      line("autoride_fare_negotiations_total", rides.negotiated),
      "# TYPE autoride_subscription_renewals_total counter",
      line("autoride_subscription_renewals_total", subscriptions.renewals),
      "# TYPE autoride_subscription_failures_total counter",
      line("autoride_subscription_failures_total", subscriptions.failures),
      "# TYPE autoride_active_drivers_gauge gauge",
      line("autoride_active_drivers_gauge", drivers.active),
      "# TYPE autoride_open_ride_requests_gauge gauge",
      line("autoride_open_ride_requests_gauge", rides.open_requests),
      "",
    ].join("\n");

    return new Response(body, {
      headers: { "Content-Type": "text/plain; version=0.0.4; charset=utf-8" },
    });
  } catch (err) {
    console.error("GET /api/metrics error:", err);
    return new Response("metrics_error 1\n", {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
