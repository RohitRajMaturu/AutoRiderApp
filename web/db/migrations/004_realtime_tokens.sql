CREATE TABLE IF NOT EXISTS realtime_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_realtime_tokens_user_id ON realtime_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_realtime_tokens_expires_at ON realtime_tokens(expires_at);
