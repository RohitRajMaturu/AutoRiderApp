import { afterEach, describe, expect, it, vi } from "vitest";
import {
  calculatePassFare,
  countScheduledRides,
  haversineMeters,
  readDays,
  readTime,
} from "@/app/api/utils/phase2";
import { assertDriverAvailable } from "@/app/api/utils/driver-conflicts";
import { isCronAuthorized } from "@/app/api/utils/cron-auth";
import { sendWhatsAppTemplate } from "@/app/api/utils/notifications/fast2smsWhatsapp";
import { readJsonResponse } from "@/app/api/utils/client-response";

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.CRON_SECRET;
  delete process.env.FAST2SMS_API_KEY;
  delete process.env.FAST2SMS_WHATSAPP_PHONE_NUMBER_ID;
  delete process.env.FAST2SMS_WHATSAPP_TEMPLATE_PASS_REMINDER;
});

describe("TukTukPass pricing and schedule validation", () => {
  it("calculates integer-rupee fare with a 15 percent pass discount", () => {
    expect(
      calculatePassFare({ estimatedFareRupees: 100, rideCount: 5 }),
    ).toEqual({
      marketPerRide: 100,
      perRideFare: 85,
      agreedFare: 425,
      platformFee: 43,
      driverPayout: 382,
    });
  });

  it("counts only selected schedule days", () => {
    expect(
      countScheduledRides("2026-06-29", "2026-07-05", ["MON", "WED", "FRI"]),
    ).toBe(3);
  });

  it("rejects malformed days and time", () => {
    expect(readDays(["MON", "FUNDAY"])).toBeNull();
    expect(readTime("25:00")).toBeNull();
  });

  it("rejects a pass route shorter than 100 metres", () => {
    expect(haversineMeters(17.4399, 78.4983, 17.43991, 78.49831)).toBeLessThan(
      100,
    );
  });
});

describe("Phase 2 external integrations", () => {
  it("requires an exact bearer token for cron jobs", () => {
    process.env.CRON_SECRET = "cron-secret";
    expect(
      isCronAuthorized(
        new Request("http://local/jobs", {
          headers: { authorization: "Bearer cron-secret" },
        }),
      ),
    ).toBe(true);
    expect(
      isCronAuthorized(
        new Request("http://local/jobs", {
          headers: { authorization: "Bearer wrong" },
        }),
      ),
    ).toBe(false);
  });

  it("uses the Fast2SMS WhatsApp template endpoint", async () => {
    process.env.FAST2SMS_API_KEY = "key";
    process.env.FAST2SMS_WHATSAPP_PHONE_NUMBER_ID = "phone-id";
    process.env.FAST2SMS_WHATSAPP_TEMPLATE_PASS_REMINDER = "42";
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ return: true }) });
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      sendWhatsAppTemplate({
        phone: "+91 98855 53312",
        templateName: "PASS_REMINDER",
        params: ["1234"],
      }),
    ).resolves.toMatchObject({ ok: true });
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.pathname).toBe("/dev/whatsapp");
    expect(url.searchParams.get("message_id")).toBe("42");
    expect(url.searchParams.get("numbers")).toBe("9885553312");
  });
});

describe("Phase 2 client responses", () => {
  it("reports an HTML API response without leaking a JSON parser exception", async () => {
    const response = new Response("<html><body>Sign in</body></html>", {
      status: 500,
      headers: { "Content-Type": "text/html" },
    });
    await expect(
      readJsonResponse(response, "Phase 2 console"),
    ).rejects.toMatchObject({
      code: "NON_JSON_RESPONSE",
      status: 500,
      message: expect.stringContaining("web page instead of API data"),
    });
  });

  it("keeps an admin query failure as a JSON API response", async () => {
    vi.resetModules();
    vi.doMock("@/auth", () => ({ auth: vi.fn() }));
    vi.doMock("@/app/api/utils/admin", () => ({
      requireSuperAdmin: vi.fn().mockResolvedValue({ session: { user: { id: "admin-1" } } }),
    }));
    vi.doMock("@/app/api/utils/sql", () => ({
      default: vi.fn().mockRejectedValue(Object.assign(new Error("column missing"), { code: "42703" })),
    }));
    const { GET } = await import("@/app/api/admin/phase2/route");
    const response = await GET(new Request("http://local/api/admin/phase2"));
    expect(response.status).toBe(500);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toMatchObject({
      error: "Unable to load Phase 2 operations",
      code: "42703",
    });
    vi.doUnmock("@/auth");
    vi.doUnmock("@/app/api/utils/admin");
    vi.doUnmock("@/app/api/utils/sql");
  });
});

describe("Phase 2 driver assignment priority", () => {
  it("locks the driver and blocks a pass that overlaps an institution route", async () => {
    const tx = vi.fn(async (strings) => {
      const text = strings.join(" ");
      if (text.includes("FOR UPDATE")) return [{ id: "driver-1" }];
      if (text.includes("FROM institution_routes"))
        return [{ id: "route-1", source_type: "INSTITUTION" }];
      return [];
    });
    await expect(
      assertDriverAvailable(tx, {
        driverId: "driver-1",
        scheduledDays: ["MON"],
        scheduledTime: "08:30",
        sourceType: "PASS",
      }),
    ).rejects.toMatchObject({ code: "DRIVER_SCHEDULE_CONFLICT", status: 409 });
    expect(tx.mock.calls[0][0].join(" ")).toContain("FOR UPDATE");
  });

  it("allows a non-overlapping assignment", async () => {
    const tx = vi.fn(async (strings) =>
      strings.join(" ").includes("FOR UPDATE") ? [{ id: "driver-1" }] : [],
    );
    await expect(
      assertDriverAvailable(tx, {
        driverId: "driver-1",
        scheduledDays: ["SAT"],
        scheduledTime: "16:00",
        sourceType: "PASS",
      }),
    ).resolves.toBeUndefined();
  });
});
