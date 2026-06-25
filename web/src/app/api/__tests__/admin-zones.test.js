import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  sql: vi.fn(),
  writeAdminAudit: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/app/api/utils/sql", () => ({ default: mocks.sql }));
vi.mock("@/app/api/utils/admin", () => ({
  requireAdmin: vi.fn(async () => ({ session: { user: { id: "admin-1" } } })),
  writeAdminAudit: mocks.writeAdminAudit,
}));

describe("admin zones route", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.auth.mockReset();
    mocks.sql.mockReset();
    mocks.writeAdminAudit.mockReset();
    mocks.sql.transaction = vi.fn((callback) => callback(mocks.sql));
  });

  it("allows an existing zone to be made inactive", async () => {
    mocks.sql.mockResolvedValueOnce([{
      id: "zone-123456",
      name: "Secunderabad",
      is_active: false,
      dispatch_enabled: true,
    }]);
    const { PATCH } = await import("@/app/api/admin/zones/route.js");

    const response = await PATCH(
      new Request("http://localhost/api/admin/zones", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zone_id: "zone-123456", is_active: false }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.zone.is_active).toBe(false);
    expect(mocks.writeAdminAudit).toHaveBeenCalled();
  });
});
