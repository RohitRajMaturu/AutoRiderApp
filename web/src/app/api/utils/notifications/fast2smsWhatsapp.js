const TEMPLATE_ENV = {
  PASS_PAYMENT: "FAST2SMS_WHATSAPP_TEMPLATE_PASS_PAYMENT",
  PASS_REMINDER: "FAST2SMS_WHATSAPP_TEMPLATE_PASS_REMINDER",
  SCHOOL_EVENING_REMINDER: "FAST2SMS_WHATSAPP_TEMPLATE_SCHOOL_EVENING_REMINDER",
  SCHOOL_TRIP_START: "FAST2SMS_WHATSAPP_TEMPLATE_SCHOOL_TRIP_START",
  SCHOOL_PICKUP_CONFIRM: "FAST2SMS_WHATSAPP_TEMPLATE_SCHOOL_PICKUP_CONFIRM",
  SCHOOL_ROUTE_CANCELLED: "FAST2SMS_WHATSAPP_TEMPLATE_SCHOOL_CANCELLED",
  INSTITUTION_INVOICE: "FAST2SMS_WHATSAPP_TEMPLATE_INVOICE",
};

function whatsappNumber(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  return null;
}

export async function sendWhatsAppTemplate({
  phone,
  templateName,
  params = [],
  referenceId = "",
}) {
  const apiKey = process.env.FAST2SMS_API_KEY?.trim();
  const phoneNumberId = process.env.FAST2SMS_WHATSAPP_PHONE_NUMBER_ID?.trim();
  const templateEnv = TEMPLATE_ENV[templateName] || templateName;
  const messageId = process.env[templateEnv]?.trim();
  if (!apiKey) return { ok: false, error: "FAST2SMS_API_KEY is missing" };
  if (!phoneNumberId || !messageId) {
    return {
      ok: false,
      error: `Fast2SMS WhatsApp template ${templateName} is not configured`,
    };
  }
  const number = whatsappNumber(phone);
  if (!number) return { ok: false, error: "Invalid Indian mobile number" };

  const query = new URLSearchParams({
    authorization: apiKey,
    message_id: messageId,
    phone_number_id: phoneNumberId,
    numbers: number,
    variables_values: params.map((value) => String(value ?? "")).join("|"),
  });
  if (referenceId) query.set("udf1", String(referenceId));
  try {
    const response = await fetch(
      `https://www.fast2sms.com/dev/whatsapp?${query.toString()}`,
      {
        method: "GET",
        headers: { accept: "application/json" },
      },
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.return === false || data?.success === false) {
      return {
        ok: false,
        error: data?.message || "Fast2SMS WhatsApp send failed",
      };
    }
    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      error: error.message || "Fast2SMS WhatsApp send failed",
    };
  }
}
