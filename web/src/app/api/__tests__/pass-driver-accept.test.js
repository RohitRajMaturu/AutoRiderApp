import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  sql: Object.assign(vi.fn(), { transaction: vi.fn() }),
  sendPushToUsers: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/app/api/utils/sql", () => ({ default: mocks.sql }));
vi.mock("@/app/api/utils/push-notifications", () => ({ sendPushToUsers: mocks.sendPushToUsers }));

describe("driver pass acceptance zone enforcement", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.auth.mockReset();
    mocks.sql.mockReset();
    mocks.sql.transaction.mockReset();
  });

  it("rejects a pass when the pickup is outside the driver's preferred zone", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "driver-user", role: "driver" } });
    const tx = vi.fn()
      .mockResolvedValueOnce([{
        id: "driver-1",
        accepts_pass_subscriptions: true,
        max_active_passes: 3,
        preferred_zone_lat: 17.4399,
        preferred_zone_lng: 78.4983,
        preferred_zone_radius_km: 5,
        preferred_shift: "ANY",
      }])
      .mockResolvedValueOnce([]);
    mocks.sql.transaction.mockImplementation((callback) => callback(tx));

    const { POST } = await import("@/app/api/passes/[id]/driver-accept/route.js");
    const response = await POST(new Request("http://localhost/api/passes/pass-1/driver-accept", { method: "POST" }), { params: { id: "pass-1" } });
    const body = await response.json();
    const passQuery = tx.mock.calls[1][0].join(" ");

    expect(response.status).toBe(409);
    expect(body.error).toContain("outside your preferred pickup zone");
    expect(passQuery).toContain("ST_DWithin");
    expect(passQuery).toContain("payment_status = 'PAID'");
    expect(tx.mock.calls[1].slice(1)).toContain("ANY");
  });
});
