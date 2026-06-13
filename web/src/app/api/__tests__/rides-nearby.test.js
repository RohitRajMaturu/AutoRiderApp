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

describe("driver zone ride filtering", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.auth.mockReset();
    mocks.sql.mockReset();
    mocks.getRouteEstimate.mockReset();
  });

  it("uses the driver's zone and dispatch record for requested ride discovery", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "driver-user-1" } });
    mocks.sql.mockResolvedValueOnce([{ role: "driver" }]);
    mocks.sql.mockResolvedValueOnce([{ id: "driver-1", zone_id: "zone-1" }]);
    mocks.sql.mockResolvedValueOnce([]);
    const { GET } = await import("@/app/api/rides/route.js");

    const response = await GET(new Request("http://localhost/api/rides"));
    const body = await response.json();
    const rideQueryValues = mocks.sql.mock.calls[2].slice(1);

    expect(response.status).toBe(200);
    expect(body).toEqual({ rides: [] });
    expect(rideQueryValues).toContain("driver-1");
    expect(rideQueryValues).toContain("zone-1");
  });

  it("returns no ride discovery rows when the driver profile is missing", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "driver-user-1" } });
    mocks.sql.mockResolvedValueOnce([{ role: "driver" }]);
    mocks.sql.mockResolvedValueOnce([]);
    const { GET } = await import("@/app/api/rides/route.js");

    const response = await GET(new Request("http://localhost/api/rides"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ rides: [] });
  });
});
