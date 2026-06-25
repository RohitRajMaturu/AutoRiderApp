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
  const isMobileClient =
    new URL(request.url).searchParams.get("client") === "mobile";
  const [jwt, session] = await Promise.all([
    readRawToken(request),
    auth(request),
  ]);

  if (!jwt || !session?.user?.id) {
    if (isMobileClient) {
      return mobileAuthResponse({
        type: "AUTH_ERROR",
        error: "Unauthorized",
      });
    }
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

  const response = {
    ...payload,
    auth: payload,
  };

  if (isMobileClient) {
    return mobileAuthResponse({
      type: "AUTH_SUCCESS",
      jwt: payload.jwt,
      user: payload.user,
    });
  }

  return Response.json(response);
}

function mobileAuthResponse(message) {
  const serializedMessage = JSON.stringify(message).replace(/</g, "\\u003c");
  return new Response(
    `<!doctype html>
      <html>
        <body>
          <script>
            window.ReactNativeWebView?.postMessage(${JSON.stringify(serializedMessage)});
          </script>
        </body>
      </html>`,
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    },
  );
}
