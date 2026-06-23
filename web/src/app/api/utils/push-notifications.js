import sql from "@/app/api/utils/sql";
import { writeOperationalEvent } from "@/app/api/utils/observability";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

function chunk(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function compactPayload(payload) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined && value !== null),
  );
}

export async function sendPushToUsers(userIds, notification, scopedSql = sql) {
  const ids = [...new Set((userIds || []).filter(Boolean))];
  if (ids.length === 0) return { sent: 0, failed: 0 };

  const tokenRows = await scopedSql(
    `
      SELECT id, user_id, token
      FROM user_push_tokens
      WHERE is_active = true
        AND provider = 'expo'
        AND user_id = ANY($1::uuid[])
    `,
    [ids],
  );
  if (tokenRows.length === 0) return { sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;
  for (const batch of chunk(tokenRows, 100)) {
    const messages = batch.map((row) =>
      compactPayload({
        to: row.token,
        sound: "default",
        channelId: notification.channelId || "ride-requests",
        priority: notification.priority || "high",
        title: notification.title,
        body: notification.body,
        data: notification.data || {},
      }),
    );

    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(messages),
      });
      if (!response.ok) {
        throw new Error(`Expo push returned ${response.status}`);
      }
      const result = await response.json().catch(() => ({}));
      const receipts = Array.isArray(result.data) ? result.data : [];
      const invalidTokenIds = receipts
        .map((receipt, index) =>
          receipt?.details?.error === "DeviceNotRegistered" ? batch[index]?.id : null,
        )
        .filter(Boolean);
      if (invalidTokenIds.length > 0) {
        await scopedSql(
          `
            UPDATE user_push_tokens
            SET is_active = false,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ANY($1::uuid[])
          `,
          [invalidTokenIds],
        );
      }
      sent += batch.length - invalidTokenIds.length;
      failed += invalidTokenIds.length;
    } catch (error) {
      failed += batch.length;
      await writeOperationalEvent({
        eventType: "push_send_failed",
        severity: "warn",
        metadata: { message: error.message, title: notification.title },
        scopedSql,
      });
    }
  }

  await writeOperationalEvent({
    eventType: "push_send_attempted",
    severity: failed > 0 ? "warn" : "info",
    metadata: { sent, failed, title: notification.title },
    scopedSql,
  });

  return { sent, failed };
}
