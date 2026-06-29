CREATE TABLE IF NOT EXISTS sos_tracking_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id uuid NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  passenger_id uuid NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sos_tracking_token
  ON sos_tracking_tokens(token)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sos_tracking_ride
  ON sos_tracking_tokens(ride_id);
