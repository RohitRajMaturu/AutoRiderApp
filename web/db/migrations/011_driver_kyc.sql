ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS dl_number text,
  ADD COLUMN IF NOT EXISTS dl_expiry date,
  ADD COLUMN IF NOT EXISTS rc_number text,
  ADD COLUMN IF NOT EXISTS aadhaar_number_masked text,
  ADD COLUMN IF NOT EXISTS dob date,
  ADD COLUMN IF NOT EXISTS kyc_status text NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS kyc_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS kyc_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS kyc_reviewed_by uuid REFERENCES auth_users(id),
  ADD COLUMN IF NOT EXISTS kyc_rejection_reason text,
  ADD COLUMN IF NOT EXISTS rc_photo_url text,
  ADD COLUMN IF NOT EXISTS selfie_url text;

CREATE TABLE IF NOT EXISTS driver_kyc_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  vendor text NOT NULL,
  check_type text NOT NULL,
  status text NOT NULL,
  raw_result jsonb,
  confidence_score numeric(5,2),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_driver_kyc_checks_driver
  ON driver_kyc_checks(driver_id);

CREATE INDEX IF NOT EXISTS idx_drivers_kyc_status
  ON drivers(kyc_status);
