import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  estimateRoute: vi.fn(),
}));

vi.mock("@/app/api/utils/locations", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    estimateRoute: mocks.estimateRoute,
  };
});

describe("location estimate route", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.estimateRoute.mockReset();
  });

  it("returns route and fare range estimates for valid coordinates", async () => {
    mocks.estimateRoute.mockResolvedValue({
      distanceKm: 6.2,
      durationMins: 19,
      fareEstimate: 147,
      fareRange: { minFare: 130, maxFare: 160 },
      currency: "INR",
    });
    const { GET } = await import("@/app/api/locations/estimate/route.js");

    const response = await GET(
      new Request(
        "http://localhost/api/locations/estimate?pickup_lat=17.44&pickup_lng=78.38&dest_lat=17.49&dest_lng=78.41",
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.fareEstimate).toBe(147);
    expect(body.fareRange).toEqual({ minFare: 130, maxFare: 160 });
  });

  it("rejects incomplete coordinate pairs before estimating", async () => {
    const { GET } = await import("@/app/api/locations/estimate/route.js");

    const response = await GET(
      new Request(
        "http://localhost/api/locations/estimate?pickup_lat=17.44&pickup_lng=78.38&dest_lat=120&dest_lng=78.41",
      ),
    );

    expect(response.status).toBe(400);
    expect(mocks.estimateRoute).not.toHaveBeenCalled();
  });
});
