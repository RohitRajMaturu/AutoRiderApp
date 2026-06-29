ALTER TABLE rides
  ADD COLUMN IF NOT EXISTS scheduled_for timestamptz;

ALTER TABLE rides
  DROP CONSTRAINT IF EXISTS rides_scheduled_for_check;

ALTER TABLE rides
  ADD CONSTRAINT rides_scheduled_for_check
  CHECK (scheduled_for IS NULL OR scheduled_for > created_at);

CREATE INDEX IF NOT EXISTS idx_rides_scheduled_pending
  ON rides (scheduled_for)
  WHERE status = 'requested' AND scheduled_for IS NOT NULL;
