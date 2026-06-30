import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";
import { verifyPaymentSignature } from "@/app/api/utils/payments/razorpayService";

export async function POST(request) {
  const session = await auth(request);
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { passId, orderId, paymentId, signature } = await request.json();
  if (!passId || !verifyPaymentSignature({ orderId, paymentId, signature })) {
    return Response.json({ error: "Invalid payment confirmation", code: "INVALID_PAYMENT_SIGNATURE" }, { status: 400 });
  }
  const rows = await sql`
    UPDATE commuter_passes
    SET payment_status = 'PAID', razorpay_payment_id = ${paymentId}, status = 'PENDING_MATCH', updated_at = CURRENT_TIMESTAMP
    WHERE id = ${passId}
      AND passenger_id = ${session.user.id}
      AND razorpay_order_id = ${orderId}
      AND payment_status = 'PENDING'
    RETURNING *
  `;
  if (!rows[0]) return Response.json({ error: "Pass payment was already processed or not found" }, { status: 409 });
  return Response.json({ pass: rows[0] });
}
