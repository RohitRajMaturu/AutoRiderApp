import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), sql: vi.fn() }));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/app/api/utils/sql", () => ({ default: mocks.sql }));

describe("driver TukTukPass listing", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.auth.mockReset();
    mocks.sql.mockReset();
  });

  it("uses the driver id—not the preference record id—when finding offers", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "driver-user-1" } });
    mocks.sql
      .mockResolvedValueOnce([{
        driver_id: "driver-actual-id",
        id: "preference-record-id",
        accepts_pass_subscriptions: true,
        preferred_zone_lat: 12.9716,
        preferred_zone_lng: 77.5946,
        preferred_zone_radius_km: 5,
        preferred_shift: "ANY",
        max_active_passes: 3,
      }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const { GET } = await import("@/app/api/driver/passes/route.js");
    const response = await GET(new Request("http://localhost/api/driver/passes"));
    const body = await response.json();
    const offerValues = mocks.sql.mock.calls[2].slice(1);
    const offerQuery = mocks.sql.mock.calls[2][0].join(" ");
    const institutionTripValues = mocks.sql.mock.calls[3].slice(1);

    expect(response.status).toBe(200);
    expect(offerValues).toContain("driver-actual-id");
    expect(offerValues).not.toContain("preference-record-id");
    expect(offerQuery).toContain("ST_DWithin");
    expect(offerQuery).toContain("IS NOT NULL");
    expect(institutionTripValues).toContain("driver-actual-id");
    expect(body.preferences).toMatchObject({ enabled: true, radiusKm: 5, shift: "ANY" });
  });
});
