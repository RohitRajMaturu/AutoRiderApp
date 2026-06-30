import sql from "@/app/api/utils/sql";
import {
  createPaymentLink,
  isRazorpayConfigured,
} from "@/app/api/utils/payments/razorpayService";
import { sendWhatsAppWithSmsFallback } from "@/app/api/utils/notifications/phase2Messaging";

export async function createPassPaymentLink({ passId, passengerId }) {
  const rows = await sql`
    SELECT p.*, u.name AS passenger_name, u.email AS passenger_email, u.phone AS passenger_phone
    FROM commuter_passes p
    JOIN auth_users u ON u.id = p.passenger_id
    WHERE p.id = ${passId} AND p.passenger_id = ${passengerId}
    LIMIT 1
  `;
  const pass = rows[0];
  if (!pass) return { status: 404, error: "Pass not found" };
  if (pass.payment_status === "PAID")
    return { status: 409, error: "Pass is already paid" };
  if (pass.razorpay_payment_link_url) {
    return {
      status: 200,
      pass,
      paymentLink: pass.razorpay_payment_link_url,
      reused: true,
    };
  }
  if (!isRazorpayConfigured())
    return { status: 503, error: "Pass payments are not configured" };

  const link = await createPaymentLink({
    amountRupees: pass.agreed_fare,
    description: "TukTukPass subscription",
    notes: {
      pass_id: pass.id,
      passenger_id: passengerId,
      payment_type: "tuktukpass",
    },
    customer: {
      name: pass.passenger_name,
      email: pass.passenger_email,
      phone: pass.passenger_phone,
    },
  });
  const updatedRows = await sql`
    UPDATE commuter_passes
    SET razorpay_payment_link_id = ${link.id}, razorpay_payment_link_url = ${link.short_url},
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ${pass.id} AND passenger_id = ${passengerId}
    RETURNING *
  `;
  const smsMessage = `Complete your TukTukPass payment of Rs ${pass.agreed_fare}: ${link.short_url}`;
  const delivery = await sendWhatsAppWithSmsFallback({
    phone: pass.passenger_phone,
    templateName: "PASS_PAYMENT",
    params: [
      pass.passenger_name || "Passenger",
      pass.agreed_fare,
      link.short_url,
    ],
    smsMessage,
    referenceId: pass.id,
    targetType: "commuter_pass",
  });
  return {
    status: 200,
    pass: updatedRows[0],
    paymentLink: link.short_url,
    delivery,
  };
}
