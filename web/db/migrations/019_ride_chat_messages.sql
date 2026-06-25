CREATE TABLE IF NOT EXISTS ride_chat_messages (
  id TEXT PRIMARY KEY,
  ride_id UUID NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('passenger', 'driver')),
  text VARCHAR(200) NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ride_chat_messages_ride_sent
  ON ride_chat_messages (ride_id, sent_at);
