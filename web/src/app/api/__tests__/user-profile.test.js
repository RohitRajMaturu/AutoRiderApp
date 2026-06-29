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
  resolveUploadUrl: (value) => value,
}));

describe("PUT /api/user-profile", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.auth.mockReset();
    mocks.sql.mockReset();
    mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
  });

  it("requires a valid passenger date of birth when completing a profile", async () => {
    const { PUT } = await import("@/app/api/user-profile/route.js");
    const request = new Request("http://localhost/api/user-profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test Passenger",
        date_of_birth: "not-a-date",
        complete_profile: true,
      }),
    });

    const response = await PUT(request);

    expect(response.status).toBe(400);
    expect(mocks.sql).not.toHaveBeenCalled();
  });

  it("persists the passenger profile fields", async () => {
    mocks.sql.mockResolvedValueOnce([
      {
        id: "user-1",
        role: "passenger",
        name: "Test Passenger",
        date_of_birth: "1995-05-20",
        preferred_language: "Hindi",
      },
    ]);
    const { PUT } = await import("@/app/api/user-profile/route.js");
    const request = new Request("http://localhost/api/user-profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test Passenger",
        phone: "+919000000000",
        date_of_birth: "1995-05-20",
        gender_identity: "prefer_not_to_say",
        emergency_contact_name: "Family",
        emergency_contact_phone: "+919111111111",
        preferred_language: "Hindi",
        accessibility_needs: "Extra boarding time",
        complete_profile: true,
      }),
    });

    const response = await PUT(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.user.name).toBe("Test Passenger");
    expect(mocks.sql).toHaveBeenCalledOnce();
  });

  it("rejects more than five saved places", async () => {
    const { PATCH } = await import("@/app/api/user-profile/route.js");
    const savedPlaces = Array.from({ length: 6 }, (_, index) => ({
      id: `place-${index}`,
      label: "Home",
      address: "Saved address",
      lat: 17.4,
      lng: 78.4,
    }));
    const response = await PATCH(new Request("http://localhost/api/user-profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ savedPlaces }),
    }));

    expect(response.status).toBe(400);
    expect(mocks.sql).not.toHaveBeenCalled();
  });
});
