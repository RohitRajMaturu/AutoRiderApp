ALTER TABLE commuter_passes
  DROP COLUMN IF EXISTS cancellation_refund_id,
  DROP COLUMN IF EXISTS cancellation_refund_pending,
  DROP COLUMN IF EXISTS cancellation_refund_amount,
  DROP COLUMN IF EXISTS cancelled_at;
