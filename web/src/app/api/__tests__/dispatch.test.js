import { describe, expect, it, vi } from "vitest";
import { selectZoneDrivers } from "@/app/api/utils/dispatch";

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
  });
});
