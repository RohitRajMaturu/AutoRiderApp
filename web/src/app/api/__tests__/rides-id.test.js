import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  sql: vi.fn(),
  sendPushToUsers: vi.fn(),
  triggerRideEvent: vi.fn(),
}));

vi.mock("@/auth", () => ({
  auth: mocks.auth,
}));

vi.mock("@/app/api/utils/sql", () => ({
  default: mocks.sql,
}));

vi.mock("@/app/api/utils/push-notifications", () => ({
  sendPushToUsers: mocks.sendPushToUsers,
}));

vi.mock("@/lib/pusher/server", () => ({
  triggerRideEvent: mocks.triggerRideEvent,
}));

describe("ride detail route", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.auth.mockReset();
    mocks.sql.mockReset();
    mocks.sendPushToUsers.mockReset();
    mocks.triggerRideEvent.mockReset();
    mocks.sql.transaction = vi.fn((callback) => callback(mocks.sql));
  });

  it("requires auth before returning ride details", async () => {
    mocks.auth.mockResolvedValue(null);
    const { GET } = await import("@/app/api/rides/[id]/route.js");

    const response = await GET(new Request("http://localhost/api/rides/r1"), {
      params: { id: "r1" },
    });

    expect(response.status).toBe(401);
    expect(mocks.sql).not.toHaveBeenCalled();
  });

  it("returns 409 when cancelling a ride outside the user's accessible active rides", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
    mocks.sql.mockResolvedValueOnce([]);
    mocks.sql.mockResolvedValueOnce([]);
    mocks.sql.mockResolvedValueOnce([]);
    mocks.sql.mockResolvedValueOnce([]);
    const { PATCH } = await import("@/app/api/rides/[id]/route.js");

    const response = await PATCH(
      new Request("http://localhost/api/rides/r1", {
        method: "PATCH",
        body: JSON.stringify({ action: "cancel" }),
      }),
      { params: { id: "r1" } },
    );

    expect(response.status).toBe(409);
  });

  it("returns ride cancelled when a driver accepts a request already cancelled by the passenger", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "driver-user-1" } });
    mocks.sql.mockResolvedValueOnce([
      {
        id: "driver-1",
        zone_id: "zone-1",
        is_online: true,
        is_approved: true,
        subscription_expiry: new Date(Date.now() + 60000).toISOString(),
      },
    ]);
    mocks.sql.mockResolvedValueOnce([]);
    mocks.sql.mockResolvedValueOnce([]);
    mocks.sql.mockResolvedValueOnce([]);
    mocks.sql.mockResolvedValueOnce([
      {
        status: "cancelled",
        driver_id: null,
        zone_id: "zone-1",
      },
    ]);
    const { PATCH } = await import("@/app/api/rides/[id]/route.js");

    const response = await PATCH(
      new Request("http://localhost/api/rides/ride-1", {
        method: "PATCH",
        body: JSON.stringify({ action: "accept" }),
      }),
      { params: { id: "ride-1" } },
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe("RIDE_CANCELLED");
    expect(body.error).toBe("Passenger cancelled this ride");
  });

  it("rejects a second ride while the driver already has an active ride", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "driver-user-1" } });
    mocks.sql
      .mockResolvedValueOnce([{
        id: "driver-1",
        zone_id: "zone-1",
        is_online: true,
        is_approved: true,
        subscription_expiry: "2099-01-01T00:00:00.000Z",
      }])
      .mockResolvedValueOnce([{ id: "driver-1" }])
      .mockResolvedValueOnce([{ id: "ride-in-progress", started_at: null, can_queue_next: false }]);
    const { PATCH } = await import("@/app/api/rides/[id]/route.js");

    const response = await PATCH(
      new Request("http://localhost/api/rides/ride-2", {
        method: "PATCH",
        body: JSON.stringify({ action: "accept" }),
      }),
      { params: { id: "ride-2" } },
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe("DRIVER_ACTIVE_RIDE");
    expect(body.activeRideId).toBe("ride-in-progress");
    expect(mocks.sendPushToUsers).not.toHaveBeenCalled();
  });

  it("allows one next ride when the current trip is started and near drop-off", async () => {
    const nextRide = {
      id: "ride-next",
      passenger_id: "passenger-2",
      status: "accepted",
      driver_id: "driver-1",
      accepted_at: "2026-06-29T11:00:00.000Z",
    };
    mocks.auth.mockResolvedValue({ user: { id: "driver-user-1" } });
    mocks.sql
      .mockResolvedValueOnce([{
        id: "driver-1",
        zone_id: "zone-1",
        is_online: true,
        is_approved: true,
        subscription_expiry: "2099-01-01T00:00:00.000Z",
      }])
      .mockResolvedValueOnce([{ id: "driver-1" }])
      .mockResolvedValueOnce([{
        id: "ride-current",
        started_at: "2026-06-29T10:00:00.000Z",
        can_queue_next: true,
      }])
      .mockResolvedValueOnce([nextRide])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    const { PATCH } = await import("@/app/api/rides/[id]/route.js");

    const response = await PATCH(
      new Request("http://localhost/api/rides/ride-next", {
        method: "PATCH",
        body: JSON.stringify({ action: "accept" }),
      }),
      { params: { id: "ride-next" } },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ride.id).toBe("ride-next");
    expect(mocks.sendPushToUsers).toHaveBeenCalledWith(
      ["passenger-2"],
      expect.objectContaining({
        title: "Driver accepted your ride as next",
        body: expect.stringMatching(/finishing a nearby trip/i),
      }),
    );
  });

  it("notifies the driver when a passenger cancels an accepted ride", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "passenger-1" } });
    mocks.sql
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{
        id: "ride-1",
        status: "cancelled",
        passenger_id: "passenger-1",
        driver_id: "driver-1",
        cancellation_reason: "plans_changed",
        cancelled_at: "2026-06-25T12:00:00.000Z",
      }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ user_id: "driver-user-1" }]);
    mocks.triggerRideEvent.mockResolvedValue(true);
    const { PATCH } = await import("@/app/api/rides/[id]/route.js");

    const response = await PATCH(
      new Request("http://localhost/api/rides/ride-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel", reason: "plans_changed" }),
      }),
      { params: { id: "ride-1" } },
    );

    expect(response.status).toBe(200);
    const cancellationValues = mocks.sql.mock.calls[1].slice(1);
    expect(cancellationValues).toContain(null);
    expect(mocks.sendPushToUsers).toHaveBeenCalledWith(
      ["driver-user-1"],
      expect.objectContaining({
        title: "Passenger cancelled the ride",
        data: expect.objectContaining({ actorRole: "passenger" }),
      }),
    );
    expect(mocks.triggerRideEvent).toHaveBeenCalledWith(
      "ride-1",
      "ride-cancelled",
      expect.objectContaining({
        actorRole: "passenger",
        reason: "plans_changed",
      }),
    );
  });

  it("allows a passenger to rate their completed ride once", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "passenger-1" } });
    mocks.sql.mockResolvedValueOnce([
      {
        id: "ride-1",
        status: "completed",
        passenger_id: "passenger-1",
        driver_rating: 5,
        rating_feedback: "Great ride",
      },
    ]);
    const { PATCH } = await import("@/app/api/rides/[id]/route.js");

    const response = await PATCH(
      new Request("http://localhost/api/rides/ride-1", {
        method: "PATCH",
        body: JSON.stringify({
          action: "rate",
          driver_rating: 5,
          rating_feedback: "Great ride",
        }),
      }),
      { params: { id: "ride-1" } },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ride.driver_rating).toBe(5);
  });

  it("publishes a realtime event when the driver starts the ride", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "driver-user-1" } });
    mocks.sql
      .mockResolvedValueOnce([{
        id: "driver-1",
        zone_id: "zone-1",
        is_online: true,
        is_approved: true,
        subscription_expiry: "2099-01-01T00:00:00.000Z",
      }])
      .mockResolvedValueOnce([{
        id: "ride-1",
        passenger_id: "passenger-1",
        status: "accepted",
        started_at: "2026-06-26T08:00:00.000Z",
      }]);
    const { PATCH } = await import("@/app/api/rides/[id]/route.js");

    const response = await PATCH(
      new Request("http://localhost/api/rides/ride-1", {
        method: "PATCH",
        body: JSON.stringify({ action: "start" }),
      }),
      { params: { id: "ride-1" } },
    );

    expect(response.status).toBe(200);
    expect(mocks.triggerRideEvent).toHaveBeenCalledWith(
      "ride-1",
      "ride-started",
      {
        rideId: "ride-1",
        startedAt: "2026-06-26T08:00:00.000Z",
      },
    );
  });

  it("alerts the queued passenger when the current trip completes", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "driver-user-1" } });
    mocks.sql
      .mockResolvedValueOnce([{
        id: "driver-1",
        zone_id: "zone-1",
        is_online: true,
        is_approved: true,
        subscription_expiry: "2099-01-01T00:00:00.000Z",
      }])
      .mockResolvedValueOnce([{
        id: "ride-current",
        passenger_id: "passenger-1",
        driver_id: "driver-1",
        status: "completed",
        completed_at: "2026-06-29T12:00:00.000Z",
      }])
      .mockResolvedValueOnce([{ id: "ride-next", passenger_id: "passenger-2" }]);
    const { PATCH } = await import("@/app/api/rides/[id]/route.js");

    const response = await PATCH(
      new Request("http://localhost/api/rides/ride-current", {
        method: "PATCH",
        body: JSON.stringify({ action: "complete" }),
      }),
      { params: { id: "ride-current" } },
    );

    expect(response.status).toBe(200);
    expect(mocks.sendPushToUsers).toHaveBeenCalledWith(
      ["passenger-2"],
      expect.objectContaining({
        title: "Driver is heading to you",
        data: { type: "driver_ready", rideId: "ride-next" },
      }),
    );
    expect(mocks.triggerRideEvent).toHaveBeenCalledWith(
      "ride-next",
      "driver-ready",
      { rideId: "ride-next", previousRideId: "ride-current" },
    );
  });

  it("allows the assigned driver to rate the passenger once", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "driver-user-1" } });
    mocks.sql
      .mockResolvedValueOnce([{
        id: "driver-1",
        zone_id: "zone-1",
        is_online: true,
        is_approved: true,
        subscription_expiry: "2099-01-01T00:00:00.000Z",
      }])
      .mockResolvedValueOnce([{
        id: "ride-1",
        status: "completed",
        driver_id: "driver-1",
        passenger_rating: 5,
        passenger_rating_feedback: "Ready on time",
      }]);
    const { PATCH } = await import("@/app/api/rides/[id]/route.js");

    const response = await PATCH(
      new Request("http://localhost/api/rides/ride-1", {
        method: "PATCH",
        body: JSON.stringify({
          action: "rate_passenger",
          passenger_rating: 5,
          passenger_rating_feedback: "Ready on time",
        }),
      }),
      { params: { id: "ride-1" } },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ride.passenger_rating).toBe(5);
  });

  it("rejects invalid ride ratings before updating data", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "passenger-1" } });
    const { PATCH } = await import("@/app/api/rides/[id]/route.js");

    const response = await PATCH(
      new Request("http://localhost/api/rides/ride-1", {
        method: "PATCH",
        body: JSON.stringify({ action: "rate", driver_rating: 6 }),
      }),
      { params: { id: "ride-1" } },
    );

    expect(response.status).toBe(400);
    expect(mocks.sql).not.toHaveBeenCalled();
  });
});
