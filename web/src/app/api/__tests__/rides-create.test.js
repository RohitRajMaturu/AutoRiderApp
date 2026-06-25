import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  sql: vi.fn(),
  findZoneForPoint: vi.fn(),
  dispatchRideRequest: vi.fn(),
  getRouteEstimate: vi.fn(),
  sendPushToUsers: vi.fn(),
}));

vi.mock("@/auth", () => ({
  auth: mocks.auth,
}));

vi.mock("@/app/api/utils/sql", () => ({
  default: mocks.sql,
}));

vi.mock("@/app/api/utils/dispatch", () => ({
  dispatchRideRequest: mocks.dispatchRideRequest,
  findZoneForPoint: mocks.findZoneForPoint,
  getDriverRideRadiusMeters: () => 8000,
  getPassengerPostCancelCooldownSeconds: () => 0,
  getPassengerSpamCooldownSeconds: () => 0,
}));

vi.mock("@/app/api/utils/locations", () => ({
  getRouteEstimate: mocks.getRouteEstimate,
}));

vi.mock("@/app/api/utils/push-notifications", () => ({
  sendPushToUsers: mocks.sendPushToUsers,
}));

vi.mock("@/lib/pusher/server", () => ({
  triggerRideEvent: vi.fn(),
}));

describe("POST /api/rides", () => {
  beforeEach(() => {
    vi.resetModules();
    Object.values(mocks).forEach((mock) => mock.mockReset());
  });

  it("returns an actionable error when the database schema is outdated", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "passenger-1" } });
    mocks.sql.mockRejectedValue(
      Object.assign(new Error("column vehicle_type does not exist"), {
        code: "42703",
      }),
    );

    const { POST } = await import("@/app/api/rides/route.js");
    const response = await POST(
      new Request("http://localhost/api/rides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickup_address: "Pickup address",
          dest_address: "Destination address",
          pickup_lat: 17.4,
          pickup_lng: 78.4,
          dest_lat: 17.5,
          dest_lng: 78.5,
          vehicle_type: "auto",
          negotiation_mode: "fixed",
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.code).toBe("DATABASE_MIGRATION_REQUIRED");
    expect(body.error).toMatch(/db:migrate/);
  });

  it("forces ride requests to auto even when another type is submitted", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "passenger-1" } });
    mocks.findZoneForPoint.mockResolvedValue({ id: "zone-1", name: "Central" });
    mocks.getRouteEstimate.mockResolvedValue({
      distanceKm: 4.2,
      durationMins: 15,
      estimatedFare: 110,
      polyline: null,
      provider: "local",
    });
    mocks.dispatchRideRequest.mockResolvedValue(0);
    mocks.sendPushToUsers.mockResolvedValue({ sent: 0, failed: 0 });

    let insertedVehicleType;
    mocks.sql.mockImplementation(async (strings, ...values) => {
      const text = Array.isArray(strings) ? strings.join(" ") : String(strings);
      if (text.includes("SELECT id FROM rides")) return [];
      if (text.includes("INSERT INTO rides")) {
        insertedVehicleType = values[14];
        return [
          {
            id: "ride-1",
            zone_id: "zone-1",
            pickup_lat: 17.4,
            pickup_lng: 78.4,
            vehicle_type: insertedVehicleType,
            status: "requested",
          },
        ];
      }
      if (text.includes("FROM ride_driver_notifications")) return [];
      throw new Error(`Unexpected SQL: ${text}`);
    });

    const { POST } = await import("@/app/api/rides/route.js");
    const response = await POST(
      new Request("http://localhost/api/rides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickup_address: "Pickup address",
          dest_address: "Destination address",
          pickup_lat: 17.4,
          pickup_lng: 78.4,
          dest_lat: 17.5,
          dest_lng: 78.5,
          vehicle_type: "car",
          negotiation_mode: "fixed",
        }),
      }),
    );

    expect(response.status).toBe(202);
    expect(insertedVehicleType).toBe("auto");
  });
});
