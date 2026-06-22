import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";
import { writeOperationalEvent } from "@/app/api/utils/observability";

const PLATFORMS = new Set(["ios", "android", "web"]);

function readToken(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 512) return null;
  return trimmed;
}

function readPlatform(value) {
  return PLATFORMS.has(value) ? value : null;
}

export async function POST(request) {
  try {
    const session = await auth(request);
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const token = readToken(body.token);
    const platform = readPlatform(body.platform);
    const deviceId = readToken(body.deviceId || body.device_id);
    if (!token || !platform) {
      return Response.json({ error: "token and platform are required" }, { status: 400 });
    }

    const rows = await sql`
      INSERT INTO user_push_tokens (user_id, token, provider, platform, device_id)
      VALUES (${session.user.id}, ${token}, 'expo', ${platform}, ${deviceId})
      ON CONFLICT (provider, token) DO UPDATE
      SET user_id = EXCLUDED.user_id,
          platform = EXCLUDED.platform,
          device_id = EXCLUDED.device_id,
          is_active = true,
          last_seen_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      RETURNING id, provider, platform, is_active, last_seen_at
    `;

    await writeOperationalEvent({
      eventType: "push_token_registered",
      actorId: session.user.id,
      targetType: "user_push_token",
      targetId: rows[0].id,
      metadata: { platform },
    });

    return Response.json({ token: rows[0] });
  } catch (err) {
    console.error("POST /api/notifications/push-token error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const session = await auth(request);
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const token = readToken(body.token);
    if (!token) {
      return Response.json({ error: "token is required" }, { status: 400 });
    }

    await sql`
      UPDATE user_push_tokens
      SET is_active = false,
          updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ${session.user.id}
        AND provider = 'expo'
        AND token = ${token}
    `;

    await writeOperationalEvent({
      eventType: "push_token_deactivated",
      actorId: session.user.id,
      targetType: "user_push_token",
      metadata: {},
    });

    return Response.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/notifications/push-token error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
