import sql from "@/app/api/utils/sql";
import {
  isRazorpayConfigured,
  refundPayment,
} from "@/app/api/utils/payments/razorpayService";
import { writeOperationalEvent } from "@/app/api/utils/observability";

export async function processPassRefund(pass) {
  const amount = Number(pass.refund_amount || 0);
  if (
    pass.payment_status !== "PAID" ||
    !pass.razorpay_payment_id ||
    amount <= 0
  ) {
    if (pass.id && amount <= 0) {
      await sql`UPDATE commuter_passes SET cancellation_refund_pending=false,
        updated_at=CURRENT_TIMESTAMP WHERE id=${pass.id}`;
    }
    return {
      refundAmount: amount,
      refundPending: pass.payment_status === "PAID" && amount > 0,
    };
  }
  if (!isRazorpayConfigured())
    return { refundAmount: amount, refundPending: true };
  try {
    const refund = await refundPayment(pass.razorpay_payment_id, amount);
    const full = amount >= Number(pass.agreed_fare || 0);
    await sql`UPDATE commuter_passes SET payment_status=${full ? "REFUNDED" : "PARTIAL_REFUND"},
      cancellation_refund_pending=false, cancellation_refund_id=${refund.id || null},
      updated_at=CURRENT_TIMESTAMP WHERE id=${pass.id}`;
    return {
      refundAmount: amount,
      refundPending: false,
      refundId: refund.id || null,
    };
  } catch (error) {
    await writeOperationalEvent({
      eventType: "pass_refund_failed",
      targetType: "commuter_pass",
      targetId: pass.id,
      severity: "error",
      metadata: { message: error.message, amount },
    }).catch(() => {});
    return { refundAmount: amount, refundPending: true };
  }
}
