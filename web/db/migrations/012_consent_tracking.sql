ALTER TABLE auth_users
  ADD COLUMN IF NOT EXISTS data_consent_given boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS data_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS data_consent_version text;

ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS data_consent_given boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS data_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS data_consent_version text;
