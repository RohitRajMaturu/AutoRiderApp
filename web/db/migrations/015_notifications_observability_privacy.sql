CREATE TABLE IF NOT EXISTS user_push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  token text NOT NULL,
  provider text NOT NULL DEFAULT 'expo' CHECK (provider IN ('expo')),
  platform text CHECK (platform IN ('ios', 'android', 'web')),
  device_id text,
  is_active boolean NOT NULL DEFAULT true,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, token)
);

CREATE INDEX IF NOT EXISTS idx_user_push_tokens_user_active
  ON user_push_tokens(user_id, is_active, last_seen_at DESC);

CREATE TABLE IF NOT EXISTS operational_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  actor_id uuid REFERENCES auth_users(id) ON DELETE SET NULL,
  target_type text,
  target_id uuid,
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('debug', 'info', 'warn', 'error')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_operational_events_created_at
  ON operational_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_operational_events_type_created_at
  ON operational_events(event_type, created_at DESC);

CREATE TABLE IF NOT EXISTS privacy_retention_policies (
  key text PRIMARY KEY,
  retention_days integer NOT NULL CHECK (retention_days BETWEEN 1 AND 3650),
  description text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO privacy_retention_policies (key, retention_days, description)
VALUES
  ('operational_events', 90, 'Low-risk operational diagnostics and lifecycle events.'),
  ('inactive_push_tokens', 180, 'Inactive or stale mobile push tokens.'),
  ('admin_audit_log', 730, 'Admin/security audit trail. Review before reducing.')
ON CONFLICT (key) DO UPDATE
SET retention_days = EXCLUDED.retention_days,
    description = EXCLUDED.description,
    updated_at = CURRENT_TIMESTAMP;
