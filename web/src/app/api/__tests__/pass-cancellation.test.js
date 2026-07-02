import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sql: vi.fn(),
  transaction: vi.fn(),
  processPassRefund: vi.fn(),
  sendPushToUsers: vi.fn(),
}));

vi.mock("@/app/api/utils/sql", () => {
  mocks.sql.transaction = mocks.transaction;
  return { default: mocks.sql };
});
vi.mock("@/app/api/utils/pass-refund", () => ({
  processPassRefund: mocks.processPassRefund,
}));
vi.mock("@/app/api/utils/push-notifications", () => ({
  sendPushToUsers: mocks.sendPushToUsers,
}));

import {
  cancelPassengerPass,
  getPassCancellationQuote,
} from "@/app/api/utils/pass-cancellation";

const paidPass = {
  id: "pass-1",
  status: "ACTIVE",
  payment_status: "PAID",
  agreed_fare: 2000,
  razorpay_payment_id: "pay-1",
  pickup_label: "Secunderabad",
  dropoff_label: "Begumpet",
  driver_user_id: "driver-user-1",
  full_refund_eligible: false,
  completed_rides: 3,
  upcoming_rides: 4,
  in_progress_rides: 0,
};

beforeEach(() => {
  mocks.sql.mockReset();
  mocks.transaction.mockReset();
  mocks.processPassRefund.mockReset().mockResolvedValue({
    refundAmount: 1000,
    refundPending: false,
    refundId: "refund-1",
  });
  mocks.sendPushToUsers.mockReset().mockResolvedValue({ sent: 1, failed: 0 });
});

describe("pass cancellation trust flow", () => {
  it("returns a complete server-calculated refund quote", async () => {
    mocks.sql.mockResolvedValue([paidPass]);

    await expect(getPassCancellationQuote("pass-1", "passenger-1")).resolves.toMatchObject({
      quote: {
        totalPassAmount: 2000,
        paidAmount: 2000,
        refundPercentage: 50,
        refundAmount: 1000,
        cancellationDeduction: 1000,
        completedRides: 3,
        upcomingRidesToCancel: 4,
        canCancel: true,
      },
    });
  });

  it("requires an explicit confirmed refund amount", async () => {
    await expect(cancelPassengerPass({
      passId: "pass-1",
      passengerId: "passenger-1",
    })).rejects.toMatchObject({ code: "REFUND_CONFIRMATION_REQUIRED", status: 428 });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("refuses cancellation when the displayed refund has changed", async () => {
    const tx = vi.fn(async (strings) => {
      const query = strings.join(" ");
      if (query.includes("SELECT id FROM commuter_passes")) return [{ id: "pass-1" }];
      if (query.includes("SELECT p.id")) return [paidPass];
      return [];
    });
    mocks.transaction.mockImplementation((callback) => callback(tx));

    await expect(cancelPassengerPass({
      passId: "pass-1",
      passengerId: "passenger-1",
      confirmedRefundAmount: 2000,
    })).rejects.toMatchObject({
      code: "REFUND_QUOTE_CHANGED",
      status: 409,
      refundQuote: expect.objectContaining({ refundAmount: 1000 }),
    });
    expect(tx.mock.calls.some((call) => call[0].join(" ").includes("UPDATE commuter_passes"))).toBe(false);
  });

  it("atomically cancels future rides, records the receipt, refunds, and informs the driver", async () => {
    const tx = vi.fn(async (strings) => {
      const query = strings.join(" ");
      if (query.includes("SELECT id FROM commuter_passes")) return [{ id: "pass-1" }];
      if (query.includes("SELECT p.id")) return [paidPass];
      if (query.includes("UPDATE commuter_passes")) return [{ ...paidPass, status: "CANCELLED" }];
      if (query.includes("UPDATE pass_rides")) return [{ id: "ride-1" }, { id: "ride-2" }];
      return [];
    });
    mocks.transaction.mockImplementation((callback) => callback(tx));

    await expect(cancelPassengerPass({
      passId: "pass-1",
      passengerId: "passenger-1",
      confirmedRefundAmount: 1000,
    })).resolves.toMatchObject({
      cancelledRides: 2,
      refundAmount: 1000,
      refundPending: false,
      refundId: "refund-1",
    });
    expect(mocks.processPassRefund).toHaveBeenCalledWith(expect.objectContaining({
      status: "CANCELLED",
      refund_amount: 1000,
    }));
    expect(mocks.sendPushToUsers).toHaveBeenCalledWith(
      ["driver-user-1"],
      expect.objectContaining({ data: { type: "pass_cancelled", passId: "pass-1" } }),
    );
  });

  it("blocks cancellation while a pass ride is in progress", async () => {
    const tx = vi.fn(async (strings) => {
      const query = strings.join(" ");
      if (query.includes("SELECT id FROM commuter_passes")) return [{ id: "pass-1" }];
      if (query.includes("SELECT p.id")) return [{ ...paidPass, in_progress_rides: 1 }];
      return [];
    });
    mocks.transaction.mockImplementation((callback) => callback(tx));

    await expect(cancelPassengerPass({
      passId: "pass-1",
      passengerId: "passenger-1",
      confirmedRefundAmount: 1000,
    })).rejects.toMatchObject({ code: "PASS_CANCELLATION_BLOCKED", status: 409 });
  });
});
