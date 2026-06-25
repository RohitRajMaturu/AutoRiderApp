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

vi.mock("@/app/api/utils/object-storage", () => ({
  resolveDriverUploadUrls: (driver) => driver,
}));

describe("POST /api/drivers", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.auth.mockReset();
    mocks.sql.mockReset();
  });

  it("forces new driver registrations to auto", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "driver-user-1" } });
    let insertedVehicleType;
    mocks.sql.mockImplementation(async (strings, ...values) => {
      const text = Array.isArray(strings) ? strings.join(" ") : String(strings);
      if (text.includes("SELECT id FROM drivers")) return [];
      if (text.includes("INSERT INTO drivers")) {
        insertedVehicleType = values[2];
        return [
          {
            id: "driver-1",
            user_id: "driver-user-1",
            vehicle_number: "TS09AB1234",
            vehicle_type: insertedVehicleType,
          },
        ];
      }
      if (text.includes("UPDATE auth_users")) return [];
      throw new Error(`Unexpected SQL: ${text}`);
    });

    const { POST } = await import("@/app/api/drivers/route.js");
    const response = await POST(
      new Request("http://localhost/api/drivers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicle_number: "TS09AB1234",
          vehicle_type: "bike",
          license_url: "uploads/license.jpg",
          dataConsentGiven: true,
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(insertedVehicleType).toBe("auto");
  });
});
