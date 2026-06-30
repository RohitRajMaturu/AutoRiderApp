-- Roll back the 025 compatibility conversion while preserving existing data.
ALTER TABLE phase2_notification_templates DROP CONSTRAINT IF EXISTS phase2_notification_templates_channel_check;
DELETE FROM phase2_notification_templates WHERE template_key IN ('PASS_PAYMENT_LINK','SCHOOL_EVENING_REMINDER');
UPDATE phase2_notification_templates SET channel='sms'
WHERE template_key IN ('SCHOOL_TRIP_START','SCHOOL_PICKUP_CONFIRM','SCHOOL_ROUTE_CANCELLED');
UPDATE phase2_notification_templates SET channel='email' WHERE template_key='INSTITUTION_INVOICE';
ALTER TABLE phase2_notification_templates
  ADD CONSTRAINT phase2_notification_templates_channel_check CHECK (channel IN ('push', 'sms', 'email'));

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='institution_invoices' AND column_name='amount') THEN
    ALTER TABLE institution_invoices RENAME COLUMN amount TO amount_paise;
    UPDATE institution_invoices SET amount_paise = amount_paise * 100;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='institutions' AND column_name='monthly_fee') THEN
    ALTER TABLE institutions RENAME COLUMN monthly_fee TO monthly_fee_paise;
    UPDATE institutions SET monthly_fee_paise = monthly_fee_paise * 100;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pass_rides' AND column_name='refund_amount') THEN
    ALTER TABLE pass_rides RENAME COLUMN refund_amount TO refund_amount_paise;
    UPDATE pass_rides SET refund_amount_paise = refund_amount_paise * 100 WHERE refund_amount_paise IS NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='commuter_passes' AND column_name='agreed_fare') THEN
    ALTER TABLE commuter_passes RENAME COLUMN agreed_fare TO agreed_fare_paise;
    ALTER TABLE commuter_passes RENAME COLUMN platform_fee TO platform_fee_paise;
    ALTER TABLE commuter_passes RENAME COLUMN driver_payout TO driver_payout_paise;
    UPDATE commuter_passes SET agreed_fare_paise=agreed_fare_paise*100,
      platform_fee_paise=platform_fee_paise*100, driver_payout_paise=driver_payout_paise*100;
  END IF;
END $$;

ALTER TABLE member_tracking_tokens DROP COLUMN IF EXISTS whatsapp_sent_at, DROP COLUMN IF EXISTS revoked_at;
UPDATE institution_members SET pickup_location=ST_SetSRID(ST_MakePoint(pickup_lng,pickup_lat),4326)::geography
WHERE pickup_lat IS NOT NULL AND pickup_lng IS NOT NULL;
ALTER TABLE institution_members DROP COLUMN IF EXISTS pickup_lat, DROP COLUMN IF EXISTS pickup_lng;
ALTER TABLE institutions DROP COLUMN IF EXISTS admin_user_id;
UPDATE pass_route_interests SET
  pickup_location=ST_SetSRID(ST_MakePoint(pickup_lng,pickup_lat),4326)::geography,
  dropoff_location=ST_SetSRID(ST_MakePoint(dropoff_lng,dropoff_lat),4326)::geography;
ALTER TABLE pass_route_interests ALTER COLUMN pickup_location SET NOT NULL, ALTER COLUMN dropoff_location SET NOT NULL;
ALTER TABLE pass_route_interests DROP COLUMN IF EXISTS pickup_lat, DROP COLUMN IF EXISTS pickup_lng,
  DROP COLUMN IF EXISTS dropoff_lat, DROP COLUMN IF EXISTS dropoff_lng, DROP COLUMN IF EXISTS notified_at;
ALTER TABLE pass_rides DROP COLUMN IF EXISTS reminder_sent_at;
UPDATE commuter_passes SET
  pickup_location=ST_SetSRID(ST_MakePoint(pickup_lng,pickup_lat),4326)::geography,
  dropoff_location=ST_SetSRID(ST_MakePoint(dropoff_lng,dropoff_lat),4326)::geography;
ALTER TABLE commuter_passes ALTER COLUMN pickup_location SET NOT NULL, ALTER COLUMN dropoff_location SET NOT NULL;
ALTER TABLE commuter_passes DROP COLUMN IF EXISTS pickup_lat, DROP COLUMN IF EXISTS pickup_lng,
  DROP COLUMN IF EXISTS dropoff_lat, DROP COLUMN IF EXISTS dropoff_lng,
  DROP COLUMN IF EXISTS razorpay_payment_link_id, DROP COLUMN IF EXISTS razorpay_payment_link_url;
ALTER TABLE driver_pass_preferences ADD COLUMN IF NOT EXISTS preferred_zone geography(Point,4326);
UPDATE driver_pass_preferences SET preferred_zone=ST_SetSRID(ST_MakePoint(preferred_zone_lng,preferred_zone_lat),4326)::geography
WHERE preferred_zone_lat IS NOT NULL AND preferred_zone_lng IS NOT NULL;
ALTER TABLE driver_pass_preferences DROP COLUMN IF EXISTS preferred_zone_lat,
  DROP COLUMN IF EXISTS preferred_zone_lng, DROP COLUMN IF EXISTS created_at;

DO $$
BEGIN
  IF to_regclass('public.driver_pass_preferences') IS NOT NULL
     AND to_regclass('public.driver_subscription_preferences') IS NULL THEN
    ALTER TABLE driver_pass_preferences RENAME TO driver_subscription_preferences;
  END IF;
END $$;
