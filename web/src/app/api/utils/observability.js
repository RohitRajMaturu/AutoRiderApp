import sql from "@/app/api/utils/sql";

export async function writeOperationalEvent({
  eventType,
  actorId = null,
  targetType = null,
  targetId = null,
  severity = "info",
  metadata = {},
  scopedSql = sql,
}) {
  try {
    await scopedSql`
      INSERT INTO operational_events (
        event_type,
        actor_id,
        target_type,
        target_id,
        severity,
        metadata
      )
      VALUES (
        ${eventType},
        ${actorId},
        ${targetType},
        ${targetId},
        ${severity},
        ${JSON.stringify(metadata)}::jsonb
      )
    `;
  } catch (error) {
    console.error("operational event write failed:", error);
  }
}
