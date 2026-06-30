function indianMobile(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  return null;
}

export async function sendFast2Sms({ phone, message }) {
  const apiKey = process.env.FAST2SMS_API_KEY?.trim();
  if (!apiKey) return { ok: false, error: "FAST2SMS_API_KEY is missing" };
  const number = indianMobile(phone);
  if (!number) return { ok: false, error: "Invalid Indian mobile number" };
  const params = new URLSearchParams({
    route: process.env.FAST2SMS_ROUTE || "q",
    message: String(message || "").slice(0, 1000),
    language: process.env.FAST2SMS_LANGUAGE || "english",
    numbers: number,
  });
  try {
    const response = await fetch("https://www.fast2sms.com/dev/bulkV2", {
      method: "POST",
      headers: {
        authorization: apiKey,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.return === false) {
      return {
        ok: false,
        error: data?.message || data?.error || "Fast2SMS send failed",
      };
    }
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: error.message || "Fast2SMS send failed" };
  }
}
