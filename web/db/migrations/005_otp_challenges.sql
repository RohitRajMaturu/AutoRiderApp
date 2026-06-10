CREATE TABLE IF NOT EXISTS otp_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL,
  otp_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_otp_challenges_identifier_created
  ON otp_challenges(identifier, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_otp_challenges_expires_at
  ON otp_challenges(expires_at);
