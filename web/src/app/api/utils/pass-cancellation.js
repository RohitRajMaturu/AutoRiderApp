import sql from "@/app/api/utils/sql";
import { processPassRefund } from "@/app/api/utils/pass-refund";
import { sendPushToUsers } from "@/app/api/utils/push-notifications";

const CANCELLABLE_STATUSES = new Set(["PENDING_MATCH", "ACTIVE", "PAUSED"]);

function cancellationError(message, code, status, extra = {}) {
  return Object.assign(new Error(message), { code, status, ...extra });
}

function quoteFromRow(pass) {
  const passAmount = Number(pass.agreed_fare || 0);
  const paidAmount = pass.payment_status === "PAID" ? passAmount : 0;
  const refundPercentage = paidAmount > 0 ? (pass.full_refund_eligible ? 100 : 50) : 0;
  const refundAmount = Math.round((paidAmount * refundPercentage) / 100);
  const inProgressRides = Number(pass.in_progress_rides || 0);
  const canCancel = CANCELLABLE_STATUSES.has(pass.status) && inProgressRides === 0;

  return {
    passId: pass.id,
    canCancel,
    status: pass.status,
    totalPassAmount: passAmount,
    paidAmount,
    refundPercentage,
    refundAmount,
    cancellationDeduction: Math.max(0, paidAmount - refundAmount),
    completedRides: Number(pass.completed_rides || 0),
    upcomingRidesToCancel: Number(pass.upcoming_rides || 0),
    policy: paidAmount <= 0
      ? "No completed pass payment was found, so no payment refund is due."
      : pass.full_refund_eligible
        ? "Full refund because cancellation is at least 3 days before the pass starts."
        : "50% refund under the current cancellation notice policy.",
    refundDestination: pass.razorpay_payment_id
      ? "Original payment method"
      : paidAmount > 0
        ? "Manual refund review"
        : "No payment was captured",
    blockedReason: inProgressRides > 0
      ? "This pass has a ride in progress. Complete the ride before cancelling."
      : !CANCELLABLE_STATUSES.has(pass.status)
        ? "This pass is no longer eligible for cancellation."
        : null,
  };
}

export async function getPassCancellationQuote(passId, passengerId, scopedSql = sql) {
  const rows = await scopedSql`
    SELECT p.id, p.status, p.payment_status, p.agreed_fare,
      p.razorpay_payment_id, p.pickup_label, p.dropoff_label,
      p.driver_id, d.user_id AS driver_user_id,
      (p.start_date > (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date + 2) AS full_refund_eligible,
      COALESCE((SELECT count(*)::int FROM pass_rides pr
        WHERE pr.pass_id = p.id AND pr.status = 'COMPLETED'), 0) AS completed_rides,
      COALESCE((SELECT count(*)::int FROM pass_rides pr
        WHERE pr.pass_id = p.id AND pr.status IN ('PENDING', 'DRIVER_ASSIGNED')
          AND pr.scheduled_date >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date), 0) AS upcoming_rides,
      COALESCE((SELECT count(*)::int FROM pass_rides pr
        WHERE pr.pass_id = p.id AND pr.status = 'IN_PROGRESS'), 0) AS in_progress_rides
    FROM commuter_passes p
    LEFT JOIN drivers d ON d.id = p.driver_id
    WHERE p.id = ${passId} AND p.passenger_id = ${passengerId}
    LIMIT 1
  `;
  if (!rows[0]) {
    throw cancellationError("Pass not found", "PASS_NOT_FOUND", 404);
  }
  return { pass: rows[0], quote: quoteFromRow(rows[0]) };
}

export async function cancelPassengerPass({ passId, passengerId, confirmedRefundAmount }) {
  if (
    confirmedRefundAmount === null ||
    confirmedRefundAmount === undefined ||
    confirmedRefundAmount === "" ||
    !Number.isFinite(Number(confirmedRefundAmount))
  ) {
    throw cancellationError(
      "Review and confirm the refund amount before cancelling",
      "REFUND_CONFIRMATION_REQUIRED",
      428,
    );
  }

  const cancellation = await sql.transaction(async (tx) => {
    const locked = await tx`
      SELECT id FROM commuter_passes
      WHERE id = ${passId} AND passenger_id = ${passengerId}
      FOR UPDATE
    `;
    if (!locked[0]) {
      throw cancellationError("Pass not found", "PASS_NOT_FOUND", 404);
    }

    const { pass, quote } = await getPassCancellationQuote(passId, passengerId, tx);
    if (!quote.canCancel) {
      throw cancellationError(
        quote.blockedReason || "Pass cannot be cancelled",
        quote.blockedReason ? "PASS_CANCELLATION_BLOCKED" : "PASS_NOT_CANCELLABLE",
        409,
        { refundQuote: quote },
      );
    }
    if (Number(confirmedRefundAmount) !== quote.refundAmount) {
      throw cancellationError(
        "The refund amount changed. Review the updated amount before cancelling.",
        "REFUND_QUOTE_CHANGED",
        409,
        { refundQuote: quote },
      );
    }

    const updated = await tx`
      UPDATE commuter_passes
      SET status = 'CANCELLED', cancelled_at = CURRENT_TIMESTAMP,
        cancellation_refund_amount = ${quote.refundAmount},
        cancellation_refund_pending = ${quote.refundAmount > 0},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${passId} AND passenger_id = ${passengerId}
        AND status IN ('PENDING_MATCH', 'ACTIVE', 'PAUSED')
      RETURNING *
    `;
    if (!updated[0]) {
      throw cancellationError("Pass cannot be cancelled", "PASS_NOT_CANCELLABLE", 409);
    }
    const cancelledRides = await tx`
      UPDATE pass_rides
      SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP
      WHERE pass_id = ${passId}
        AND status IN ('PENDING', 'DRIVER_ASSIGNED')
        AND scheduled_date >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date
      RETURNING id
    `;
    return {
      pass: { ...updated[0], refund_amount: quote.refundAmount },
      quote,
      driverUserId: pass.driver_user_id,
      cancelledRides: cancelledRides.length,
    };
  });

  const refund = await processPassRefund(cancellation.pass);
  if (cancellation.driverUserId) {
    await sendPushToUsers([cancellation.driverUserId], {
      title: "TukTukPass cancelled",
      body: `${cancellation.pass.pickup_label} to ${cancellation.pass.dropoff_label} has been cancelled by the passenger.`,
      data: { type: "pass_cancelled", passId },
    }).catch(() => null);
  }
  return {
    pass: cancellation.pass,
    refundQuote: cancellation.quote,
    cancelledRides: cancellation.cancelledRides,
    ...refund,
  };
}

export function passCancellationError(error) {
  return Response.json(
    {
      error: error.message || "Pass cancellation failed",
      code: error.code || "PASS_CANCELLATION_FAILED",
      refundQuote: error.refundQuote,
    },
    { status: error.status || 500 },
  );
}
