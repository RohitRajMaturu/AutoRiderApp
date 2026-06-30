import { describe, expect, it, vi } from "vitest";
import { calculatePassFare, countScheduledRides, readDays, readTime } from "@/app/api/utils/phase2";
import { assertDriverAvailable } from "@/app/api/utils/driver-conflicts";

describe("TukTukPass pricing and schedule validation", () => {
  it("calculates integer-paise fare with a 15 percent pass discount", () => {
    expect(calculatePassFare({ estimatedFareRupees: 100, rideCount: 5 })).toEqual({
      marketPerRidePaise: 10000,
      perRideFarePaise: 8500,
      agreedFarePaise: 42500,
      platformFeePaise: 4250,
      driverPayoutPaise: 38250,
    });
  });

  it("counts only selected schedule days", () => {
    expect(countScheduledRides("2026-06-29", "2026-07-05", ["MON", "WED", "FRI"])).toBe(3);
  });

  it("rejects malformed days and time", () => {
    expect(readDays(["MON", "FUNDAY"])).toBeNull();
    expect(readTime("25:00")).toBeNull();
  });
});

describe("Phase 2 driver assignment priority", () => {
  it("locks the driver and blocks a pass that overlaps an institution route", async () => {
    const tx = vi.fn(async (strings) => {
      const text = strings.join(" ");
      if (text.includes("FOR UPDATE")) return [{ id: "driver-1" }];
      if (text.includes("FROM institution_routes")) return [{ id: "route-1", source_type: "INSTITUTION" }];
      return [];
    });
    await expect(assertDriverAvailable(tx, {
      driverId: "driver-1",
      scheduledDays: ["MON"],
      scheduledTime: "08:30",
      sourceType: "PASS",
    })).rejects.toMatchObject({ code: "DRIVER_SCHEDULE_CONFLICT", status: 409 });
    expect(tx.mock.calls[0][0].join(" ")).toContain("FOR UPDATE");
  });

  it("allows a non-overlapping assignment", async () => {
    const tx = vi.fn(async (strings) => strings.join(" ").includes("FOR UPDATE") ? [{ id: "driver-1" }] : []);
    await expect(assertDriverAvailable(tx, {
      driverId: "driver-1",
      scheduledDays: ["SAT"],
      scheduledTime: "16:00",
      sourceType: "PASS",
    })).resolves.toBeUndefined();
  });
});
