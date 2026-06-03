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

describe("admin drivers route", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.auth.mockReset();
    mocks.sql.mockReset();
  });

  it("rejects invalid subscription_days before updating data", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "admin-1" } });
    const { PATCH } = await import("@/app/api/admin/drivers/route.js");

    const response = await PATCH(
      new Request("http://localhost/api/admin/drivers", {
        method: "PATCH",
        body: JSON.stringify({
          driver_id: "driver-1",
          subscription_days: 900,
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(mocks.sql).not.toHaveBeenCalled();
  });

  it("returns 403 for non-admin users", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
    mocks.sql.mockResolvedValueOnce([{ role: "passenger" }]);
    const { PATCH } = await import("@/app/api/admin/drivers/route.js");

    const response = await PATCH(
      new Request("http://localhost/api/admin/drivers", {
        method: "PATCH",
        body: JSON.stringify({
          driver_id: "driver-1",
          is_approved: true,
        }),
      }),
    );

    expect(response.status).toBe(403);
  });

  it("returns 404 when the target driver row is missing", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "admin-1" } });
    mocks.sql.mockResolvedValueOnce([{ role: "admin" }]);
    mocks.sql.mockResolvedValueOnce([]);
    const { PATCH } = await import("@/app/api/admin/drivers/route.js");

    const response = await PATCH(
      new Request("http://localhost/api/admin/drivers", {
        method: "PATCH",
        body: JSON.stringify({
          driver_id: "missing-driver",
          is_approved: true,
          subscription_days: 30,
        }),
      }),
    );

    expect(response.status).toBe(404);
  });
});
