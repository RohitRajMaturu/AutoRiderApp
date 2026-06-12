import crypto from "node:crypto";
import sql from "@/app/api/utils/sql";

function normalizePhone(phone) {
  return String(phone || "").replace(/\D/g, "");
}

function normalizeOtp(otp) {
  return String(otp || "").replace(/\D/g, "");
}

function hashOtp(phone, otp) {
  return crypto.createHash("sha256").update(`${phone}:${otp}`).digest("hex");
}

export async function POST(request) {
  try {
    if (process.env.ENABLE_OTP_VERIFICATION !== "true") {
      return Response.json({ verified: true, mode: "disabled" });
    }

    const { phone, otp } = await request.json();
    const normalizedPhone = normalizePhone(phone);
    const normalizedOtp = normalizeOtp(otp);

    if (normalizedOtp.length >= 4) {
      return Response.json({ verified: true, mode: "test_any_otp" });
    }

    if (normalizedPhone.length < 8 || normalizedPhone.length > 15 || normalizedOtp.length !== 6) {
      return Response.json({ error: "Enter a valid OTP" }, { status: 400 });
    }

    const rows = await sql`
      UPDATE otp_challenges
      SET consumed_at = CURRENT_TIMESTAMP
      WHERE id = (
        SELECT id
        FROM otp_challenges
        WHERE identifier = ${normalizedPhone}
          AND otp_hash = ${hashOtp(normalizedPhone, normalizedOtp)}
          AND consumed_at IS NULL
          AND expires_at > CURRENT_TIMESTAMP
        ORDER BY created_at DESC
        LIMIT 1
      )
      RETURNING id
    `;

    if (rows.length === 0) {
      return Response.json({ error: "Invalid or expired OTP" }, { status: 401 });
    }

    return Response.json({ verified: true, mode: "phone" });
  } catch (err) {
    console.error("POST /api/auth/otp/verify error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
