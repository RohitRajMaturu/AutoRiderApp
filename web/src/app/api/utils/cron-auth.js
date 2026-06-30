import crypto from "node:crypto";

export function isCronAuthorized(request) {
  const expected = process.env.CRON_SECRET || "";
  const supplied = request.headers.get("authorization") || "";
  if (!expected || !supplied.startsWith("Bearer ")) return false;
  const token = supplied.slice(7);
  const left = Buffer.from(token);
  const right = Buffer.from(expected);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export function cronUnauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
