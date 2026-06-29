CREATE TABLE IF NOT EXISTS driver_incentives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('daily_target', 'streak')),
  target_rides int NOT NULL,
  bonus_amount int NOT NULL,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  rides_completed int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'expired')),
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_driver_incentives_driver_active
  ON driver_incentives (driver_id, status)
  WHERE status = 'active';
