import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sql: vi.fn(),
  transaction: vi.fn(),
  sendPushToUsers: vi.fn(),
  sendWhatsAppWithSmsFallback: vi.fn(),
  writeOperationalEvent: vi.fn(),
}));

vi.mock("@/app/api/utils/sql", () => {
  mocks.sql.transaction = mocks.transaction;
  return { default: mocks.sql };
});
vi.mock("@/app/api/utils/push-notifications", () => ({
  sendPushToUsers: mocks.sendPushToUsers,
}));
vi.mock("@/app/api/utils/notifications/phase2Messaging", () => ({
  sendWhatsAppWithSmsFallback: mocks.sendWhatsAppWithSmsFallback,
}));
vi.mock("@/app/api/utils/observability", () => ({
  writeOperationalEvent: mocks.writeOperationalEvent,
}));

import {
  expirePasses,
  handlePassNoShows,
  sendPassExpiryFinalReminder,
  sendPassRenewalReminders,
} from "@/app/api/utils/phase2-jobs";

beforeEach(() => {
  mocks.sql.mockReset();
  mocks.transaction.mockReset();
  mocks.sendPushToUsers.mockReset().mockResolvedValue({ sent: 1, failed: 0 });
  mocks.sendWhatsAppWithSmsFallback.mockReset().mockResolvedValue({ ok: true });
  mocks.writeOperationalEvent.mockReset().mockResolvedValue(undefined);
});

describe("TukTukPass lifecycle jobs", () => {
  it("sends the seven-day renewal reminder to every matching passenger", async () => {
    mocks.sql.mockResolvedValue([
      {
        id: "pass-1",
        passenger_id: "passenger-1",
        pickup_label: "Secunderabad",
        dropoff_label: "Begumpet",
      },
    ]);

    await expect(sendPassRenewalReminders()).resolves.toEqual({ reminded: 1 });
    expect(mocks.sendPushToUsers).toHaveBeenCalledWith(
      ["passenger-1"],
      expect.objectContaining({
        title: "Your TukTukPass expires in 7 days",
        data: expect.objectContaining({ type: "pass_expiring_soon", passId: "pass-1" }),
      }),
    );
  });

  it("sends the three-day final reminder", async () => {
    mocks.sql.mockResolvedValue([
      {
        id: "pass-2",
        passenger_id: "passenger-2",
        pickup_label: "Ameerpet",
        dropoff_label: "Madhapur",
      },
    ]);

    await expect(sendPassExpiryFinalReminder()).resolves.toEqual({ reminded: 1 });
    expect(mocks.sendPushToUsers).toHaveBeenCalledWith(
      ["passenger-2"],
      expect.objectContaining({
        title: "TukTukPass expires in 3 days",
        data: expect.objectContaining({ type: "pass_expiring_final", passId: "pass-2" }),
      }),
    );
  });

  it("notifies the passenger when an expired pass is closed", async () => {
    mocks.sql.mockResolvedValue([
      {
        id: "pass-3",
        passenger_id: "passenger-3",
        pickup_label: "Kondapur",
        dropoff_label: "Gachibowli",
      },
    ]);

    await expect(expirePasses()).resolves.toEqual({ expired: 1 });
    expect(mocks.sendPushToUsers).toHaveBeenCalledWith(
      ["passenger-3"],
      expect.objectContaining({
        title: "TukTukPass has ended",
        data: expect.objectContaining({ type: "pass_expired", passId: "pass-3" }),
      }),
    );
  });

  it("refunds the ride instead of assigning a conflicting backup driver", async () => {
    const tx = vi.fn(async (strings) => {
      const query = strings.join(" ");
      if (query.includes("greatest(1, round")) {
        return [{
          id: "ride-1",
          pass_id: "pass-4",
          passenger_id: "passenger-4",
          backup_driver_id: "driver-2",
          scheduled_days: ["MON"],
          scheduled_time: "08:30:00",
          ride_fare: 125,
        }];
      }
      if (query.includes("FROM drivers") && query.includes("FOR UPDATE")) {
        return [{ id: "driver-2" }];
      }
      if (query.includes("FROM institution_routes")) {
        return [{ id: "route-1", source_type: "INSTITUTION" }];
      }
      return [];
    });
    mocks.transaction.mockImplementation((callback) => callback(tx));

    await expect(handlePassNoShows()).resolves.toEqual({
      processed: 1,
      backupsActivated: 0,
    });
    const queries = tx.mock.calls.map((call) => call[0].join(" "));
    expect(queries.some((query) => query.includes("status='DRIVER_NO_SHOW'"))).toBe(true);
    expect(queries.some((query) => query.includes("backup_activated=true"))).toBe(false);
  });
});
