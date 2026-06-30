import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  sql: vi.fn(),
  triggerRideEvent: vi.fn(),
  dispatchRideRequest: vi.fn(),
  sendPushToUsers: vi.fn(),
}));

vi.mock("@/auth", () => ({
  auth: mocks.auth,
}));

vi.mock("@/app/api/utils/sql", () => ({
  default: mocks.sql,
}));

vi.mock("@/lib/pusher/server", () => ({
  triggerRideEvent: mocks.triggerRideEvent,
}));

vi.mock("@/app/api/utils/dispatch", () => ({
  getAcceptedRideTimeoutMinutes: () => 45,
  getBackToBackDispatchRadiusMeters: () => 2000,
  dispatchRideRequest: mocks.dispatchRideRequest,
}));

vi.mock("@/app/api/utils/push-notifications", () => ({
  sendPushToUsers: mocks.sendPushToUsers,
}));

vi.mock("@/app/api/utils/driver-conflicts", () => ({
  currentServiceSlot: () => ({ days: ["MON"], time: "12:00" }),
  findDriverConflict: vi.fn().mockResolvedValue(null),
}));

function textOf(strings) {
  return Array.isArray(strings) ? strings.join(" ") : String(strings);
}

describe("fare negotiation race handling", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.auth.mockReset();
    mocks.sql.mockReset();
    mocks.triggerRideEvent.mockReset();
    mocks.dispatchRideRequest.mockReset();
    mocks.sendPushToUsers.mockReset();
    mocks.sql.transaction = vi.fn((callback) => callback(mocks.sql));
  });

  it("returns 409 when a second driver accepts after another driver already locked the ride", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "driver-user-2" } });
    mocks.sql.mockImplementation(async (strings) => {
      const text = textOf(strings);
      if (text.includes("FROM drivers")) {
        return [{ id: "driver-2", is_online: true, is_approved: true, subscription_expiry: "2099-01-01T00:00:00Z" }];
      }
      if (text.includes("SELECT r.*")) {
        return [{
          id: "ride-1",
          status: "negotiating",
          fare_min: 100,
          fare_max: 150,
          negotiation_expires_at: "2099-01-01T00:00:00Z",
        }];
      }
      if (text.includes("status = 'accepted'")) return [];
      if (text.includes("FROM ride_fare_offers")) return [];
      if (text.includes("UPDATE rides")) return [];
      throw new Error(`Unexpected SQL: ${text}`);
    });

    const { POST } = await import("@/app/api/rides/[id]/fare-offer/route.js");
    const response = await POST(
      new Request("http://localhost/api/rides/ride-1/fare-offer", {
        method: "POST",
        body: JSON.stringify({ offerType: "accept" }),
      }),
      { params: { id: "ride-1" } },
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toMatch(/accepted by another driver/i);
    expect(mocks.triggerRideEvent).not.toHaveBeenCalled();
  });

  it("rejects a fare response while the driver is completing another ride", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "driver-user-2" } });
    mocks.sql.mockImplementation(async (strings) => {
      const text = textOf(strings);
      if (text.includes("FROM drivers")) {
        return [{ id: "driver-2", is_online: true, is_approved: true, subscription_expiry: "2099-01-01T00:00:00Z" }];
      }
      if (text.includes("status = 'accepted'")) return [{ id: "ride-in-progress" }];
      throw new Error(`Unexpected SQL: ${text}`);
    });

    const { POST } = await import("@/app/api/rides/[id]/fare-offer/route.js");
    const response = await POST(
      new Request("http://localhost/api/rides/ride-2/fare-offer", {
        method: "POST",
        body: JSON.stringify({ offerType: "counter", offeredFare: 200 }),
      }),
      { params: { id: "ride-2" } },
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe("DRIVER_ACTIVE_RIDE");
    expect(mocks.triggerRideEvent).not.toHaveBeenCalled();
  });

  it("returns 409 when the passenger approves a counter after the ride already locked", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "passenger-1" } });
    mocks.sql.mockImplementation(async (strings) => {
      const text = textOf(strings);
      if (text.includes("FROM drivers")) return [{ id: "driver-1" }];
      if (text.includes("status = 'accepted'")) return [];
      if (text.includes("FROM ride_fare_offers")) {
        return [{ ride_id: "ride-1", driver_id: "driver-1", offer_type: "counter", offered_fare: 175 }];
      }
      if (text.includes("UPDATE rides")) return [];
      throw new Error(`Unexpected SQL: ${text}`);
    });

    const { POST } = await import("@/app/api/rides/[id]/approve-counter/route.js");
    const response = await POST(
      new Request("http://localhost/api/rides/ride-1/approve-counter", {
        method: "POST",
        body: JSON.stringify({ driverId: "driver-1" }),
      }),
      { params: { id: "ride-1" } },
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toMatch(/no longer available/i);
    expect(mocks.triggerRideEvent).not.toHaveBeenCalled();
  });

  it("expires a negotiation back to fixed dispatch and publishes negotiation-expired", async () => {
    const expiredRide = {
      id: "ride-1",
      status: "requested",
      negotiation_mode: "fixed",
      zone_id: "zone-1",
      pickup_lat: 17.4,
      pickup_lng: 78.4,
    };
    mocks.auth.mockResolvedValue({ user: { id: "passenger-1" } });
    mocks.sql.mockResolvedValueOnce([expiredRide]);
    mocks.dispatchRideRequest.mockResolvedValueOnce(3);
    mocks.triggerRideEvent.mockResolvedValueOnce(true);

    const { POST } = await import("@/app/api/rides/[id]/expire-negotiation/route.js");
    const response = await POST(
      new Request("http://localhost/api/rides/ride-1/expire-negotiation", {
        method: "POST",
      }),
      { params: { id: "ride-1" } },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ride: expiredRide, dispatchedDrivers: 3 });
    expect(mocks.dispatchRideRequest).toHaveBeenCalledWith(expiredRide);
    expect(mocks.triggerRideEvent).toHaveBeenCalledWith("ride-1", "negotiation-expired", { rideId: "ride-1" });
  });
});
