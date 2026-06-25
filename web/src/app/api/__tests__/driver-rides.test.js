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

describe("driver rides route", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.auth.mockReset();
    mocks.sql.mockReset();
  });

  it("returns paginated completed ride history", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "driver-user-1" } });
    mocks.sql.mockResolvedValueOnce([{ id: "driver-1" }]);
    mocks.sql.mockResolvedValueOnce([
      ...Array.from({ length: 6 }, (_, index) => ({
        id: `ride-${index + 1}`,
        pickup_address: `Pickup ${index + 1}`,
        dest_address: `Drop ${index + 1}`,
        distance_km: String(index + 2),
        fare: String(100 + index * 10),
        completed_at: "2026-06-22T10:00:00.000Z",
      })),
    ]);
    const { GET } = await import("@/app/api/drivers/rides/route.js");

    const response = await GET(
      new Request("http://localhost/api/drivers/rides?pageSize=5&offset=0"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.rides).toHaveLength(5);
    expect(body.rides[0].fare).toBe(100);
    expect(body.nextOffset).toBe(5);
  });
});
