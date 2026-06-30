import crypto from "node:crypto";
import sql from "@/app/api/utils/sql";

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
}

function authorized(request) {
  const expected = process.env.FAST2SMS_WEBHOOK_SECRET?.trim();
  if (!expected) return false;
  const supplied =
    request.headers.get("x-fast2sms-webhook-secret") ||
    new URL(request.url).searchParams.get("secret");
  return safeEqual(supplied, expected);
}

function incomingMessages(payload) {
  return Array.isArray(payload?.whatsapp_reports)
    ? payload.whatsapp_reports.filter(
        (item) => item?.type === "incoming_message",
      )
    : [];
}

export async function POST(request) {
  if (!authorized(request))
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  const payload = await request.json().catch(() => ({}));
  const stopMessages = incomingMessages(payload).filter((item) =>
    /^(stop|unsubscribe|cancel)$/i.test(String(item.body || "").trim()),
  );
  let optedOut = 0;
  for (const message of stopMessages) {
    const digits = String(message.from || "")
      .replace(/\D/g, "")
      .slice(-10);
    if (digits.length !== 10) continue;
    const rows = await sql`
      UPDATE institution_members
      SET sms_opted_out = true
      WHERE right(regexp_replace(guardian_phone, '\\D', '', 'g'), 10) = ${digits}
         OR right(regexp_replace(COALESCE(guardian_phone_2, ''), '\\D', '', 'g'), 10) = ${digits}
      RETURNING id
    `;
    optedOut += rows.length;
    await sql`
      UPDATE member_tracking_tokens
      SET revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP)
      WHERE right(regexp_replace(guardian_phone, '\\D', '', 'g'), 10) = ${digits}
        AND revoked_at IS NULL
    `;
  }
  return Response.json({
    received: true,
    incoming: incomingMessages(payload).length,
    optedOut,
  });
}
