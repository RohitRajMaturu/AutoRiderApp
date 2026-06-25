import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  sql: vi.fn(),
  triggerRideEvent: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/app/api/utils/sql", () => ({ default: mocks.sql }));
vi.mock("@/lib/pusher/server", () => ({ triggerRideEvent: mocks.triggerRideEvent }));

describe("/api/rides/[id]/chat", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.auth.mockReset();
    mocks.sql.mockReset();
    mocks.triggerRideEvent.mockReset();
  });

  it("publishes a trimmed passenger message for an accepted ride", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "passenger-1" } });
    mocks.sql
      .mockResolvedValueOnce([{
        id: "ride-1",
        status: "accepted",
        passenger_id: "passenger-1",
        driver_user_id: "driver-user-1",
      }])
      .mockResolvedValueOnce([]);
    mocks.triggerRideEvent.mockResolvedValue(true);
    const { POST } = await import("@/app/api/rides/[id]/chat/route.js");

    const response = await POST(
      new Request("http://localhost/api/rides/ride-1/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "  I am at the gate  ", clientMessageId: "passenger:123" }),
      }),
      { params: { id: "ride-1" } },
    );

    expect(response.status).toBe(200);
    expect(mocks.triggerRideEvent).toHaveBeenCalledWith(
      "ride-1",
      "chat-message",
      expect.objectContaining({
        id: "passenger:123",
        text: "I am at the gate",
        senderRole: "passenger",
      }),
    );
  });

  it("returns stored messages so clients can poll when realtime is unavailable", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "driver-user-1" } });
    mocks.sql
      .mockResolvedValueOnce([{
        id: "ride-1",
        status: "accepted",
        passenger_id: "passenger-1",
        driver_user_id: "driver-user-1",
      }])
      .mockResolvedValueOnce([{
        id: "passenger:123",
        ride_id: "ride-1",
        sender_role: "passenger",
        text: "I am at the gate",
        sent_at: "2026-06-25T10:00:00.000Z",
        read_at: null,
      }]);
    const { GET } = await import("@/app/api/rides/[id]/chat/route.js");

    const response = await GET(
      new Request("http://localhost/api/rides/ride-1/chat"),
      { params: { id: "ride-1" } },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.messages[0]).toMatchObject({
      id: "passenger:123",
      senderRole: "passenger",
      text: "I am at the gate",
    });
  });

  it("keeps a stored message successful when realtime publishing is unavailable", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "passenger-1" } });
    mocks.sql
      .mockResolvedValueOnce([{
        id: "ride-1",
        status: "accepted",
        passenger_id: "passenger-1",
        driver_user_id: "driver-user-1",
      }])
      .mockResolvedValueOnce([]);
    mocks.triggerRideEvent.mockResolvedValue(false);
    const { POST } = await import("@/app/api/rides/[id]/chat/route.js");

    const response = await POST(
      new Request("http://localhost/api/rides/ride-1/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Please call me", clientMessageId: "passenger:456" }),
      }),
      { params: { id: "ride-1" } },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.realtime).toBe(false);
    expect(body.message.text).toBe("Please call me");
  });

  it("forbids users who are not part of the ride", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "other-user" } });
    mocks.sql
      .mockResolvedValueOnce([{
        id: "ride-1",
        status: "accepted",
        passenger_id: "passenger-1",
        driver_user_id: "driver-user-1",
      }])
      .mockResolvedValueOnce([{ id: "passenger:123" }]);
    const { POST } = await import("@/app/api/rides/[id]/chat/route.js");

    const response = await POST(
      new Request("http://localhost/api/rides/ride-1/chat", {
        method: "POST",
        body: JSON.stringify({ text: "Hello" }),
      }),
      { params: { id: "ride-1" } },
    );

    expect(response.status).toBe(403);
    expect(mocks.triggerRideEvent).not.toHaveBeenCalled();
  });

  it("rejects chat after the ride is completed", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "driver-user-1" } });
    mocks.sql.mockResolvedValue([{
      id: "ride-1",
      status: "completed",
      passenger_id: "passenger-1",
      driver_user_id: "driver-user-1",
    }]);
    const { POST } = await import("@/app/api/rides/[id]/chat/route.js");

    const response = await POST(
      new Request("http://localhost/api/rides/ride-1/chat", {
        method: "POST",
        body: JSON.stringify({ text: "Hello" }),
      }),
      { params: { id: "ride-1" } },
    );

    expect(response.status).toBe(409);
    expect(mocks.triggerRideEvent).not.toHaveBeenCalled();
  });

  it("publishes a read receipt when the other party opens chat", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "driver-user-1" } });
    mocks.sql.mockResolvedValue([{
      id: "ride-1",
      status: "accepted",
      passenger_id: "passenger-1",
      driver_user_id: "driver-user-1",
    }]);
    mocks.triggerRideEvent.mockResolvedValue(true);
    const { PATCH } = await import("@/app/api/rides/[id]/chat/route.js");

    const response = await PATCH(
      new Request("http://localhost/api/rides/ride-1/chat", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lastMessageId: "passenger:123" }),
      }),
      { params: { id: "ride-1" } },
    );

    expect(response.status).toBe(200);
    expect(mocks.triggerRideEvent).toHaveBeenCalledWith(
      "ride-1",
      "chat-read",
      expect.objectContaining({
        lastMessageId: "passenger:123",
        readerRole: "driver",
      }),
    );
  });
});
