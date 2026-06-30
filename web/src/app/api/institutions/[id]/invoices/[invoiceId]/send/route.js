import sql from "@/app/api/utils/sql";
import {
  institutionError,
  requireInstitutionAccess,
} from "@/app/api/utils/institution-auth";
import {
  createPaymentLink,
  isRazorpayConfigured,
} from "@/app/api/utils/payments/razorpayService";
import { sendWhatsAppWithSmsFallback } from "@/app/api/utils/notifications/phase2Messaging";

export async function POST(request, { params }) {
  try {
    await requireInstitutionAccess(request, params.id);
    const rows =
      await sql`SELECT inv.*,i.contact_name,i.contact_email,i.contact_phone FROM institution_invoices inv
      JOIN institutions i ON i.id=inv.institution_id WHERE inv.id=${params.invoiceId} AND inv.institution_id=${params.id} LIMIT 1`;
    const invoice = rows[0];
    if (!invoice)
      return Response.json({ error: "Invoice not found" }, { status: 404 });
    let url = invoice.razorpay_payment_link_url,
      id = invoice.razorpay_payment_link_id;
    if (!url) {
      if (!isRazorpayConfigured())
        return Response.json(
          { error: "Invoice payments are not configured" },
          { status: 503 },
        );
      const link = await createPaymentLink({
        amountRupees: invoice.amount,
        description: `TukTukSafe invoice ${invoice.billing_month}`,
        notes: {
          invoice_id: invoice.id,
          institution_id: params.id,
          payment_type: "institution_invoice",
        },
        customer: {
          name: invoice.contact_name,
          email: invoice.contact_email,
          phone: invoice.contact_phone,
        },
      });
      url = link.short_url;
      id = link.id;
    }
    const updated =
      await sql`UPDATE institution_invoices SET status='SENT',razorpay_payment_link_id=${id},
      razorpay_payment_link_url=${url},sent_at=COALESCE(sent_at,CURRENT_TIMESTAMP) WHERE id=${invoice.id} RETURNING *`;
    const delivery = await sendWhatsAppWithSmsFallback({
      phone: invoice.contact_phone,
      templateName: "INSTITUTION_INVOICE",
      params: [invoice.contact_name, invoice.amount, url],
      smsMessage: `TukTukGo invoice: Rs ${invoice.amount}. Pay securely: ${url}`,
      referenceId: invoice.id,
      targetType: "institution_invoice",
    });
    return Response.json({ invoice: updated[0], delivery });
  } catch (error) {
    return institutionError(error);
  }
}
