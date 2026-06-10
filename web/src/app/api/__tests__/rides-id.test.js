import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  sql: vi.fn(),
}));

vi.mock("@/auth", () => ({
  auth: mocks.auth,
}));

vi.mock("@/app/api/utils/sql", () => ({
  default: mocks.sql,
}));

describe("ride detail route", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.auth.mockReset();
    mocks.sql.mockReset();
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
});
