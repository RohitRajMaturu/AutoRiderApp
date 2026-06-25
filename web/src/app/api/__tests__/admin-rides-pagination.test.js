import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  sql: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/app/api/utils/sql", () => ({ default: mocks.sql }));
vi.mock("@/app/api/utils/admin", () => ({ writeAdminAudit: vi.fn() }));

describe("GET /api/admin/rides", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.auth.mockReset();
    mocks.sql.mockReset();
  });

  it("returns server-side pagination, filters, sorting, and counts", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "admin-1" } });
    mocks.sql
      .mockResolvedValueOnce([{ role: "admin" }])
      .mockResolvedValueOnce([{
        total: 42,
        requested: 5,
        negotiating: 2,
        accepted: 4,
        completed: 28,
        cancelled: 3,
      }])
      .mockResolvedValueOnce([{ id: "ride-21", status: "completed" }]);
    const { GET } = await import("@/app/api/admin/rides/route.js");

    const response = await GET(
      new Request(
        "http://localhost/api/admin/rides?status=completed&sort=fare_high&page=2&pageSize=20&search=station",
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.rides).toHaveLength(1);
    expect(body.counts.all).toBe(42);
    expect(body.pagination).toEqual({
      page: 2,
      pageSize: 20,
      total: 28,
      totalPages: 2,
    });
    expect(body.filters).toEqual({
      status: "completed",
      sort: "fare_high",
      search: "station",
    });
  });
});
