import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  sql: Object.assign(vi.fn(), { transaction: vi.fn() }),
  getRouteEstimate: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/app/api/utils/sql", () => ({ default: mocks.sql }));
vi.mock("@/app/api/utils/locations", () => ({
  getPlaceDetails: vi.fn(),
  getRouteEstimate: mocks.getRouteEstimate,
}));

describe("passenger pass schedule exclusivity", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.auth.mockReset();
    mocks.sql.mockReset();
    mocks.sql.transaction.mockReset();
    mocks.getRouteEstimate.mockReset();
  });

  it("rejects overlapping days and pickup times before inserting another pass", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "passenger-1", role: "passenger" } });
    mocks.getRouteEstimate.mockResolvedValue({ distanceKm: 8, estimatedFare: 180 });
    mocks.sql.mockResolvedValueOnce([{ average_fare: null, sample_size: 0 }]);
    const tx = vi.fn()
      .mockResolvedValueOnce([{ id: "passenger-1" }])
      .mockResolvedValueOnce([{
        id: "existing-pass",
        pickup_label: "Home",
        dropoff_label: "Office",
        scheduled_time: "08:30:00",
        scheduled_days: ["MON", "TUE"],
      }]);
    mocks.sql.transaction.mockImplementation((callback) => callback(tx));

    const { POST } = await import("@/app/api/passes/route.js");
    const response = await POST(new Request("http://localhost/api/passes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pickup: { label: "Secunderabad", lat: 17.4399, lng: 78.4983 },
        dropoff: { label: "Financial District", lat: 17.4165, lng: 78.3428 },
        scheduledDays: ["MON", "TUE"],
        scheduledTime: "10:30",
        durationType: "MONTHLY",
      }),
    }));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe("PASSENGER_SCHEDULE_CONFLICT");
    expect(tx).toHaveBeenCalledTimes(2);
    expect(tx.mock.calls[1][0].join(" ")).toContain("<= 7200");
  });
});
