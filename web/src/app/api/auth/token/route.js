import { getToken } from "@auth/core/jwt";
import { auth } from "@/auth";

const AUTH_COOKIE_NAMES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
];

async function readRawToken(request) {
  if (!process.env.AUTH_SECRET) {
    return null;
  }

  for (const cookieName of AUTH_COOKIE_NAMES) {
    const token = await getToken({
      req: request,
      secret: process.env.AUTH_SECRET,
      cookieName,
      secureCookie: cookieName.startsWith("__Secure-"),
      raw: true,
    });
    if (token) return token;
  }

  return null;
}

export async function GET(request) {
  const [jwt, session] = await Promise.all([
    readRawToken(request),
    auth(request),
  ]);

  if (!jwt || !session?.user?.id) {
    console.error("GET /api/auth/token unauthorized", {
      hasJwt: !!jwt,
      hasSession: !!session,
      cookies: request.headers.get("cookie") || "",
    });
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = {
    jwt,
    user: {
      id: session.user.id,
      email: session.user.email,
      phone: session.user.phone,
      role: session.user.role,
      name: session.user.name,
      image: session.user.image,
    },
  };

  return Response.json({
    ...payload,
    auth: payload,
  });
}
