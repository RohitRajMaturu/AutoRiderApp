-- Align Phase 2 with TukTukGo's established storage and integration conventions.
-- 024 may already be deployed, so this forward migration deliberately converts it
-- instead of rewriting migration history.

DO $$
BEGIN
  IF to_regclass('public.driver_subscription_preferences') IS NOT NULL
     AND to_regclass('public.driver_pass_preferences') IS NULL THEN
    ALTER TABLE driver_subscription_preferences RENAME TO driver_pass_preferences;
  END IF;
  IF to_regclass('public.driver_subscription_preferences') IS NOT NULL
     AND to_regclass('public.driver_pass_preferences') IS NOT NULL THEN
    INSERT INTO driver_pass_preferences (
      driver_id,accepts_pass_subscriptions,preferred_shift,preferred_zone_lat,preferred_zone_lng,
      preferred_zone_radius_km,max_active_passes,updated_at
    )
    SELECT driver_id,accepts_pass_subscriptions,preferred_shift,
      CASE WHEN preferred_zone IS NULL THEN NULL ELSE ST_Y(preferred_zone::geometry) END,
      CASE WHEN preferred_zone IS NULL THEN NULL ELSE ST_X(preferred_zone::geometry) END,
      preferred_zone_radius_km,max_active_passes,updated_at
    FROM driver_subscription_preferences
    ON CONFLICT (driver_id) DO NOTHING;
    DROP TABLE driver_subscription_preferences;
  END IF;
END $$;

ALTER TABLE driver_pass_preferences
  ADD COLUMN IF NOT EXISTS preferred_zone_lat double precision,
  ADD COLUMN IF NOT EXISTS preferred_zone_lng double precision,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'driver_pass_preferences' AND column_name = 'preferred_zone'
  ) THEN
    UPDATE driver_pass_preferences
    SET preferred_zone_lat = COALESCE(preferred_zone_lat, ST_Y(preferred_zone::geometry)),
        preferred_zone_lng = COALESCE(preferred_zone_lng, ST_X(preferred_zone::geometry))
    WHERE preferred_zone IS NOT NULL;
    DROP INDEX IF EXISTS idx_driver_sub_prefs_zone;
    ALTER TABLE driver_pass_preferences DROP COLUMN preferred_zone;
  END IF;
END $$;

ALTER INDEX IF EXISTS idx_driver_sub_prefs_accepts RENAME TO idx_driver_pass_prefs_accepts;

ALTER TABLE commuter_passes
  ADD COLUMN IF NOT EXISTS pickup_lat double precision,
  ADD COLUMN IF NOT EXISTS pickup_lng double precision,
  ADD COLUMN IF NOT EXISTS dropoff_lat double precision,
  ADD COLUMN IF NOT EXISTS dropoff_lng double precision,
  ADD COLUMN IF NOT EXISTS razorpay_payment_link_id text,
  ADD COLUMN IF NOT EXISTS razorpay_payment_link_url text;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'commuter_passes' AND column_name = 'pickup_location'
  ) THEN
    UPDATE commuter_passes
    SET pickup_lat = COALESCE(pickup_lat, ST_Y(pickup_location::geometry)),
        pickup_lng = COALESCE(pickup_lng, ST_X(pickup_location::geometry)),
        dropoff_lat = COALESCE(dropoff_lat, ST_Y(dropoff_location::geometry)),
        dropoff_lng = COALESCE(dropoff_lng, ST_X(dropoff_location::geometry));
    ALTER TABLE commuter_passes
      ALTER COLUMN pickup_lat SET NOT NULL,
      ALTER COLUMN pickup_lng SET NOT NULL,
      ALTER COLUMN dropoff_lat SET NOT NULL,
      ALTER COLUMN dropoff_lng SET NOT NULL;
    -- Keep the legacy geography columns nullable so the repository's re-runnable
    -- 024 migration remains safe for databases that have no migration ledger.
    ALTER TABLE commuter_passes
      ALTER COLUMN pickup_location DROP NOT NULL,
      ALTER COLUMN dropoff_location DROP NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='commuter_passes' AND column_name='agreed_fare_paise') THEN
    UPDATE commuter_passes SET
      agreed_fare_paise = round(agreed_fare_paise / 100.0),
      platform_fee_paise = round(platform_fee_paise / 100.0),
      driver_payout_paise = round(driver_payout_paise / 100.0);
    ALTER TABLE commuter_passes RENAME COLUMN agreed_fare_paise TO agreed_fare;
    ALTER TABLE commuter_passes RENAME COLUMN platform_fee_paise TO platform_fee;
    ALTER TABLE commuter_passes RENAME COLUMN driver_payout_paise TO driver_payout;
  END IF;
END $$;

ALTER TABLE pass_rides ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pass_rides' AND column_name='refund_amount_paise') THEN
    UPDATE pass_rides SET refund_amount_paise = round(refund_amount_paise / 100.0)
    WHERE refund_amount_paise IS NOT NULL;
    ALTER TABLE pass_rides RENAME COLUMN refund_amount_paise TO refund_amount;
  END IF;
END $$;

ALTER TABLE pass_route_interests
  ADD COLUMN IF NOT EXISTS pickup_lat double precision,
  ADD COLUMN IF NOT EXISTS pickup_lng double precision,
  ADD COLUMN IF NOT EXISTS dropoff_lat double precision,
  ADD COLUMN IF NOT EXISTS dropoff_lng double precision,
  ADD COLUMN IF NOT EXISTS notified_at timestamptz;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pass_route_interests' AND column_name='pickup_location') THEN
    UPDATE pass_route_interests SET
      pickup_lat = COALESCE(pickup_lat, ST_Y(pickup_location::geometry)),
      pickup_lng = COALESCE(pickup_lng, ST_X(pickup_location::geometry)),
      dropoff_lat = COALESCE(dropoff_lat, ST_Y(dropoff_location::geometry)),
      dropoff_lng = COALESCE(dropoff_lng, ST_X(dropoff_location::geometry));
    ALTER TABLE pass_route_interests
      ALTER COLUMN pickup_lat SET NOT NULL, ALTER COLUMN pickup_lng SET NOT NULL,
      ALTER COLUMN dropoff_lat SET NOT NULL, ALTER COLUMN dropoff_lng SET NOT NULL;
    ALTER TABLE pass_route_interests
      ALTER COLUMN pickup_location DROP NOT NULL,
      ALTER COLUMN dropoff_location DROP NOT NULL;
  END IF;
END $$;

ALTER TABLE institutions ADD COLUMN IF NOT EXISTS admin_user_id uuid REFERENCES auth_users(id);
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='institutions' AND column_name='monthly_fee_paise') THEN
    UPDATE institutions SET monthly_fee_paise = round(monthly_fee_paise / 100.0);
    ALTER TABLE institutions RENAME COLUMN monthly_fee_paise TO monthly_fee;
  END IF;
END $$;
UPDATE institutions i SET admin_user_id = ia.user_id
FROM institution_admin_users ia
WHERE ia.institution_id = i.id AND i.admin_user_id IS NULL;

ALTER TABLE institution_members
  ADD COLUMN IF NOT EXISTS pickup_lat double precision,
  ADD COLUMN IF NOT EXISTS pickup_lng double precision;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='institution_members' AND column_name='pickup_location') THEN
    UPDATE institution_members SET
      pickup_lat = COALESCE(pickup_lat, ST_Y(pickup_location::geometry)),
      pickup_lng = COALESCE(pickup_lng, ST_X(pickup_location::geometry))
    WHERE pickup_location IS NOT NULL;
    -- Retained as a nullable compatibility column for repeatable migration runs.
  END IF;
END $$;

ALTER TABLE member_tracking_tokens
  ADD COLUMN IF NOT EXISTS whatsapp_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_member_tracking_token
  ON member_tracking_tokens(token) WHERE revoked_at IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='institution_invoices' AND column_name='amount_paise') THEN
    UPDATE institution_invoices SET amount_paise = round(amount_paise / 100.0);
    ALTER TABLE institution_invoices RENAME COLUMN amount_paise TO amount;
  END IF;
END $$;

ALTER TABLE phase2_notification_templates DROP CONSTRAINT IF EXISTS phase2_notification_templates_channel_check;
ALTER TABLE phase2_notification_templates
  ADD CONSTRAINT phase2_notification_templates_channel_check
  CHECK (channel IN ('push', 'sms', 'whatsapp', 'email'));

UPDATE phase2_notification_templates SET channel='whatsapp',updated_at=CURRENT_TIMESTAMP
WHERE template_key IN ('SCHOOL_TRIP_START','SCHOOL_PICKUP_CONFIRM','SCHOOL_ROUTE_CANCELLED','INSTITUTION_INVOICE');
INSERT INTO phase2_notification_templates(template_key,channel,title_template,body_template)
VALUES
  ('PASS_PAYMENT_LINK','whatsapp',NULL,'Complete your TukTukPass payment of [amount]: [link]'),
  ('SCHOOL_EVENING_REMINDER','whatsapp',NULL,'[member] has [route] tomorrow at [time].')
ON CONFLICT(template_key) DO UPDATE SET channel=EXCLUDED.channel,body_template=EXCLUDED.body_template,updated_at=CURRENT_TIMESTAMP;
