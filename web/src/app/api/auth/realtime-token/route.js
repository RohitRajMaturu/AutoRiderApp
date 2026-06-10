import crypto from "node:crypto";
import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function POST(request) {
  try {
    const session = await auth(request);
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = crypto.randomBytes(32).toString("base64url");
    const tokenHash = hashToken(token);
    const rows = await sql`
      INSERT INTO realtime_tokens (user_id, token_hash, expires_at)
      VALUES (${session.user.id}, ${tokenHash}, CURRENT_TIMESTAMP + interval '15 minutes')
      RETURNING expires_at
    `;

    return Response.json({
      token,
      expires_at: rows[0].expires_at,
      websocket_url: process.env.REALTIME_WS_URL || null,
    });
  } catch (err) {
    console.error("POST /api/auth/realtime-token error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
