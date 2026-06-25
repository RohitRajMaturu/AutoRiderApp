import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  sql: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/app/api/utils/sql", () => ({ default: mocks.sql }));
vi.mock("@/app/api/utils/admin", () => ({
  requireAdmin: vi.fn(async () => ({ session: { user: { id: "admin-1" } } })),
}));

describe("GET /api/admin/audit", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.sql.mockReset();
  });

  it("returns filtered and sorted audit pagination", async () => {
    mocks.sql
      .mockResolvedValueOnce([{ total: 30, zone: 12, driver: 10, ride: 8 }])
      .mockResolvedValueOnce([{ id: "log-1", action: "zone.create" }]);
    const { GET } = await import("@/app/api/admin/audit/route.js");

    const response = await GET(
      new Request(
        "http://localhost/api/admin/audit?category=zone&sort=oldest&page=2&pageSize=10&search=secunderabad",
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.logs).toHaveLength(1);
    expect(body.counts.zone).toBe(12);
    expect(body.pagination).toEqual({
      page: 2,
      pageSize: 10,
      total: 12,
      totalPages: 2,
    });
    expect(body.filters).toEqual({
      category: "zone",
      search: "secunderabad",
      sort: "oldest",
    });
    const executedQueries = mocks.sql.mock.calls
      .map(([strings]) => strings.join(""))
      .join("\n");
    expect(executedQueries).toContain("l.target_id::text");
  });
});
