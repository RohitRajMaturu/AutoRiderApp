import { sendFast2Sms } from "@/app/api/utils/notifications/fast2smsSms";
import { sendWhatsAppTemplate } from "@/app/api/utils/notifications/fast2smsWhatsapp";
import { writeOperationalEvent } from "@/app/api/utils/observability";

export async function sendWhatsAppWithSmsFallback({
  phone,
  templateName,
  params,
  smsMessage,
  referenceId,
  targetType = "phase2",
}) {
  const whatsapp = await sendWhatsAppTemplate({
    phone,
    templateName,
    params,
    referenceId,
  });
  if (whatsapp.ok) return { channel: "whatsapp", ...whatsapp };
  const sms = await sendFast2Sms({ phone, message: smsMessage });
  if (!sms.ok) {
    await writeOperationalEvent({
      eventType: "phase2_message_delivery_failed",
      targetType,
      targetId: referenceId || null,
      severity: "warn",
      metadata: {
        whatsappError: whatsapp.error,
        smsError: sms.error,
        templateName,
      },
    }).catch(() => {});
  }
  return { channel: sms.ok ? "sms" : null, ok: sms.ok, whatsapp, sms };
}
