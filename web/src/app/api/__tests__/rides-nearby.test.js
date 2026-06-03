import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  sql: vi.fn(),
  getRouteEstimate: vi.fn(),
}));

vi.mock("@/auth", () => ({
  auth: mocks.auth,
}));

vi.mock("@/app/api/utils/sql", () => ({
  default: mocks.sql,
}));

vi.mock("@/app/api/utils/locations", () => ({
  getRouteEstimate: mocks.getRouteEstimate,
}));

describe("driver nearby ride filtering", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.auth.mockReset();
    mocks.sql.mockReset();
    mocks.getRouteEstimate.mockReset();
    process.env.DRIVER_RIDE_RADIUS_KM = "12";
    process.env.DRIVER_LOCATION_MAX_AGE_MINUTES = "30";
  });

  it("uses configured radius and fresh driver coordinates for requested ride discovery", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "driver-user-1" } });
    mocks.sql.mockResolvedValueOnce([{ role: "driver" }]);
    mocks.sql.mockResolvedValueOnce([
      {
        id: "driver-1",
        last_lat: 12.97,
        last_lng: 77.59,
        updated_at: new Date().toISOString(),
      },
    ]);
    mocks.sql.mockResolvedValueOnce([]);
    const { GET } = await import("@/app/api/rides/route.js");

    const response = await GET(new Request("http://localhost/api/rides"));
    const body = await response.json();
    const nearbyQueryValues = mocks.sql.mock.calls[2].slice(1);

    expect(response.status).toBe(200);
    expect(body).toEqual({ rides: [] });
    expect(nearbyQueryValues).toContain(true);
    expect(nearbyQueryValues).toContain(12);
  });

  it("does not expose unassigned ride discovery when driver location is stale", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "driver-user-1" } });
    mocks.sql.mockResolvedValueOnce([{ role: "driver" }]);
    mocks.sql.mockResolvedValueOnce([
      {
        id: "driver-1",
        last_lat: 12.97,
        last_lng: 77.59,
        updated_at: new Date(Date.now() - 31 * 60 * 1000).toISOString(),
      },
    ]);
    mocks.sql.mockResolvedValueOnce([]);
    const { GET } = await import("@/app/api/rides/route.js");

    const response = await GET(new Request("http://localhost/api/rides"));
    const nearbyQueryValues = mocks.sql.mock.calls[2].slice(1);

    expect(response.status).toBe(200);
    expect(nearbyQueryValues).toContain(false);
  });
});
