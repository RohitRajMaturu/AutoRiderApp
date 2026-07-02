ALTER TABLE commuter_passes
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancellation_refund_amount integer
    CHECK (cancellation_refund_amount IS NULL OR cancellation_refund_amount >= 0),
  ADD COLUMN IF NOT EXISTS cancellation_refund_pending boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cancellation_refund_id varchar(100);
