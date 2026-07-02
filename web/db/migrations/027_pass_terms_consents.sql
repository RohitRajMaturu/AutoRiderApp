CREATE TABLE IF NOT EXISTS pass_terms_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  passenger_id uuid NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  terms_version varchar(30) NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  accepted_user_agent text,
  pass_id uuid UNIQUE REFERENCES commuter_passes(id) ON DELETE SET NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pass_terms_consents_passenger
  ON pass_terms_consents(passenger_id, terms_version, accepted_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pass_terms_one_unconsumed
  ON pass_terms_consents(passenger_id, terms_version)
  WHERE pass_id IS NULL AND consumed_at IS NULL;
