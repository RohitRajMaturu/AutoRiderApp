import crypto from "node:crypto";
import sql from "@/app/api/utils/sql";

function normalizePhone(phone) {
  return String(phone || "").replace(/\D/g, "");
}

function hashOtp(phone, otp) {
  return crypto.createHash("sha256").update(`${phone}:${otp}`).digest("hex");
}

function fast2smsNumber(phone) {
  const digits = normalizePhone(phone);
  return digits.startsWith("91") && digits.length === 12 ? digits.slice(2) : digits;
}

async function sendFast2SmsOtp(phone, otp) {
  const apiKey = process.env.FAST2SMS_API_KEY?.trim();
  if (!apiKey) {
    console.log("[otp] Fast2SMS skipped: missing FAST2SMS_API_KEY");
    return { ok: false, error: "FAST2SMS_API_KEY is missing" };
  }

  const number = fast2smsNumber(phone);
  if (!/^[6-9]\d{9}$/.test(number)) {
    return { ok: false, error: "Fast2SMS requires a valid 10-digit Indian mobile number" };
  }

  const body = new URLSearchParams({
    route: process.env.FAST2SMS_ROUTE || process.env.FAST2SMS_OTP_ROUTE || "q",
    message: `Your Auto Ride OTP is ${otp}. Do not share it with anyone.`,
    language: process.env.FAST2SMS_LANGUAGE || "english",
    numbers: number,
  });

  const response = await fetch("https://www.fast2sms.com/dev/bulkV2", {
    method: "POST",
    headers: {
      authorization: apiKey,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const text = await response.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  console.log("[otp] Fast2SMS response", response.status, data);
  return {
    ok: response.ok,
    error: data?.message || data?.error || data?.raw || `Fast2SMS rejected request with ${response.status}`,
  };
}

export async function POST(request) {
  try {
    if (process.env.ENABLE_OTP_VERIFICATION !== "true") {
      return Response.json({ sent: true, skipped: true });
    }

    const { phone } = await request.json();
    const normalizedPhone = normalizePhone(phone);
    if (normalizedPhone.length < 8 || normalizedPhone.length > 15) {
      return Response.json({ error: "Enter a valid phone number" }, { status: 400 });
    }

    const cooldown = await sql`
      SELECT last_sent_at
      FROM otp_cooldowns
      WHERE identifier = ${normalizedPhone}
        AND last_sent_at > CURRENT_TIMESTAMP - interval '60 seconds'
      LIMIT 1
    `;
    if (cooldown.length > 0) {
      return Response.json({ error: "Please wait before requesting another OTP" }, { status: 429 });
    }

    const otp = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
    const otpHash = hashOtp(normalizedPhone, otp);

    await sql.transaction(async (tx) => {
      await tx`
        INSERT INTO otp_cooldowns (identifier, last_sent_at, updated_at)
        VALUES (${normalizedPhone}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (identifier)
        DO UPDATE SET last_sent_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      `;
      await tx`
        INSERT INTO otp_challenges (identifier, otp_hash, expires_at)
        VALUES (${normalizedPhone}, ${otpHash}, CURRENT_TIMESTAMP + interval '5 minutes')
      `;
    });

    const sent = await sendFast2SmsOtp(normalizedPhone, otp);
    if (!sent.ok) {
      return Response.json({ error: sent.error }, { status: 502 });
    }
    return Response.json({ sent: true });
  } catch (err) {
    console.error("POST /api/auth/otp/send error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
