import { getToken } from "@auth/core/jwt";
import sql from "@/app/api/utils/sql";

const AUTH_COOKIE_NAMES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
];

async function readToken(request) {
  if (!request || !process.env.AUTH_SECRET) {
    return null;
  }

  const bearerToken = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
  });
  if (bearerToken?.sub) {
    return bearerToken;
  }

  for (const cookieName of AUTH_COOKIE_NAMES) {
    const token = await getToken({
      req: request,
      secret: process.env.AUTH_SECRET,
      cookieName,
      secureCookie: cookieName.startsWith("__Secure-"),
    });
    if (token?.sub) {
      return token;
    }
  }

  return null;
}

export async function auth(request) {
  const token = await readToken(request);
  if (!token?.sub) {
    return null;
  }

  const rows = await sql`
    SELECT id, email, phone, role, name, image
    FROM auth_users
    WHERE id = ${token.sub}
    LIMIT 1
  `;
  const user = rows[0];
  if (!user) {
    return null;
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      phone: user.phone,
      role: user.role,
      name: user.name,
      image: user.image,
    },
  };
}
