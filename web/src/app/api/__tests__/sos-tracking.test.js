import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sql: vi.fn() }));

vi.mock("@/app/api/utils/sql", () => ({ default: mocks.sql }));

describe("GET /api/track/[token]", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.sql.mockReset();
  });

  it("rejects malformed public tracking tokens before querying", async () => {
    const { GET } = await import("@/app/api/track/[token]/route.js");
    const response = await GET(new Request("http://localhost/api/track/bad"), { params: { token: "bad" } });
    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(mocks.sql).not.toHaveBeenCalled();
  });

  it("returns stopped for a revoked tracking token", async () => {
    mocks.sql.mockResolvedValue([{ revoked_at: new Date(), expires_at: new Date(Date.now() + 1000), ride_status: "accepted" }]);
    const token = "a".repeat(64);
    const { GET } = await import("@/app/api/track/[token]/route.js");
    const response = await GET(new Request(`http://localhost/api/track/${token}`), { params: { token } });
    expect(await response.json()).toEqual({ status: "stopped" });
  });
});
