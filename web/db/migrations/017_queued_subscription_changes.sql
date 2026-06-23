ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS queued_subscription_plan text CHECK (queued_subscription_plan IN ('starter', 'active', 'pro')),
  ADD COLUMN IF NOT EXISTS queued_subscription_starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS queued_subscription_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS queued_razorpay_subscription_id text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_drivers_queued_razorpay_subscription_id
  ON drivers(queued_razorpay_subscription_id)
  WHERE queued_razorpay_subscription_id IS NOT NULL;
