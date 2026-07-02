import { describe, expect, it, vi } from "vitest";
import { autoCancelGhostRides, selectZoneDrivers } from "@/app/api/utils/dispatch";

describe("driver dispatch zone recovery", () => {
  it("refreshes a driver's stored zone from their live location before selection", async () => {
    const scopedSql = vi.fn().mockResolvedValue([
      { id: "driver-1", user_id: "user-1" },
    ]);

    const drivers = await selectZoneDrivers(
      "zone-1",
      17.4,
      78.4,
      "auto",
      scopedSql,
    );
    const query = scopedSql.mock.calls[0][0].join(" ");

    expect(drivers).toEqual([{ id: "driver-1", user_id: "user-1" }]);
    expect(query).toContain("refreshed_drivers");
    expect(query).toContain("ST_Covers");
    expect(query).toContain("SET zone_id");
    expect(query).toContain("current_ride.started_at IS NOT NULL");
    expect(query).toContain("ST_DWithin");
    expect(query).toContain("institution_routes");
    expect(query).toContain("commuter_passes");
    expect(query).toContain("IN_PROGRESS");
    expect(query).toContain("BETWEEN recurring_pass.start_date AND recurring_pass.end_date");
    expect(query).toContain("active_institution_trip.actual_start_time");
    expect(query).toContain("active_pass_ride.start_time");
    expect(query).toContain("make_interval(hours =>");
  });

  it("never expires a ride that has already started", async () => {
    const scopedSql = vi.fn().mockResolvedValue([]);

    await autoCancelGhostRides(scopedSql);

    const query = scopedSql.mock.calls[0][0].join(" ");
    expect(query).toContain("started_at IS NULL");
    expect(query).toContain("current_ride.started_at IS NOT NULL");
  });
});
