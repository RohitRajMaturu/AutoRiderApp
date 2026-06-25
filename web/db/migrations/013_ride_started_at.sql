ALTER TABLE rides
  ADD COLUMN IF NOT EXISTS started_at timestamptz;
