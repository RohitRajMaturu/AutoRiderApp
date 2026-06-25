CREATE TABLE IF NOT EXISTS ride_call_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id uuid NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  call_sid text NOT NULL,
  initiated_at timestamptz NOT NULL DEFAULT now(),
  duration_seconds integer,
  status text,
  direction text NOT NULL CHECK (direction IN ('passenger_to_driver', 'driver_to_passenger')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_call_logs_ride_id ON ride_call_logs(ride_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_rate_limit
  ON ride_call_logs(ride_id, direction, initiated_at DESC);

ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS razorpay_customer_id text,
  ADD COLUMN IF NOT EXISTS subscription_plan text CHECK (subscription_plan IN ('starter', 'active', 'pro')),
  ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'trial'
    CHECK (subscription_status IN ('trial', 'active', 'halted', 'cancelled', 'expired')),
  ADD COLUMN IF NOT EXISTS razorpay_subscription_id text,
  ADD COLUMN IF NOT EXISTS mandate_status text CHECK (mandate_status IN ('pending', 'confirmed', 'failed')),
  ADD COLUMN IF NOT EXISTS next_renewal_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS subscription_halted_at timestamptz,
  ADD COLUMN IF NOT EXISTS subscription_failure_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS manual_payment_link text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_drivers_razorpay_subscription_id
  ON drivers(razorpay_subscription_id)
  WHERE razorpay_subscription_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS subscription_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid REFERENCES drivers(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  razorpay_event_id text,
  razorpay_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscription_events_driver_created_at
  ON subscription_events(driver_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscription_events_razorpay_event_id
  ON subscription_events(razorpay_event_id)
  WHERE razorpay_event_id IS NOT NULL;
