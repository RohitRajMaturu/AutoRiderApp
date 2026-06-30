import sql from "@/app/api/utils/sql";
import crypto from "node:crypto";

function validTwilioSignature(request, entries) {
  const token = process.env.TWILIO_AUTH_TOKEN;
  const signature = request.headers.get("x-twilio-signature") || "";
  if (!token || !signature) return false;
  const canonical = [...entries].sort(([a], [b]) => a.localeCompare(b)).reduce(
    (value, [key, item]) => `${value}${key}${item}`,
    request.url,
  );
  const expected = crypto.createHmac("sha1", token).update(canonical).digest("base64");
  return expected.length === signature.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export async function POST(request) {
  const form = await request.formData();
  const entries = [...form.entries()].map(([key, value]) => [key, String(value)]);
  if (!validTwilioSignature(request, entries)) {
    return Response.json({ error: "Invalid Twilio signature" }, { status: 401 });
  }
  const from = String(form.get("From") || "").replace(/\D/g, "");
  const body = String(form.get("Body") || "").trim().toUpperCase();
  if (!from || !["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"].includes(body)) {
    return new Response("<Response></Response>", { headers: { "Content-Type": "text/xml" } });
  }
  await sql`
    UPDATE institution_members SET sms_opted_out = true
    WHERE regexp_replace(guardian_phone, '\\D', '', 'g') LIKE ${`%${from.slice(-10)}`}
       OR regexp_replace(COALESCE(guardian_phone_2, ''), '\\D', '', 'g') LIKE ${`%${from.slice(-10)}`}
  `;
  return new Response("<Response><Message>You will no longer receive TukTukSafe alerts.</Message></Response>", { headers: { "Content-Type": "text/xml" } });
}
