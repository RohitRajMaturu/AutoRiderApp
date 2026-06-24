-- TukTukGo consolidated database schema
-- Generated from web/db/migrations in filename order.
-- Intended for fresh database setup. For existing databases, prefer npm run db:migrate.
-- =========================================================================
-- 001_init_autoconnect.sql
-- =========================================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS auth_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  email text UNIQUE,
  phone text,
  role text NOT NULL DEFAULT 'passenger' CHECK (role IN ('passenger', 'driver', 'admin')),
  "emailVerified" timestamptz,
  image text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" uuid NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  type text NOT NULL,
  provider text NOT NULL,
  "providerAccountId" text NOT NULL,
  refresh_token text,
  access_token text,
  expires_at integer,
  token_type text,
  scope text,
  id_token text,
  session_state text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, "providerAccountId")
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "sessionToken" text NOT NULL UNIQUE,
  "userId" uuid NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  expires timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth_verification_tokens (
  identifier text NOT NULL,
  token text NOT NULL,
  expires timestamptz NOT NULL,
  PRIMARY KEY (identifier, token)
);

CREATE TABLE IF NOT EXISTS drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth_users(id) ON DELETE CASCADE,
  vehicle_number text NOT NULL,
  auto_photo_url text,
  license_url text NOT NULL,
  is_approved boolean NOT NULL DEFAULT false,
  is_online boolean NOT NULL DEFAULT false,
  last_lat double precision,
  last_lng double precision,
  subscription_expiry timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  passenger_id uuid NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  driver_id uuid REFERENCES drivers(id) ON DELETE SET NULL,
  pickup_address text NOT NULL,
  pickup_place_id text,
  pickup_lat double precision NOT NULL,
  pickup_lng double precision NOT NULL,
  dest_address text NOT NULL,
  dest_place_id text,
  dest_lat double precision NOT NULL,
  dest_lng double precision NOT NULL,
  distance_km numeric(10, 2),
  duration_mins integer,
  estimated_fare integer,
  route_polyline text,
  route_provider text,
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'accepted', 'completed', 'cancelled')),
  accepted_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_accounts_user_id ON auth_accounts("userId");
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions("userId");
CREATE INDEX IF NOT EXISTS idx_auth_users_role ON auth_users(role);
CREATE INDEX IF NOT EXISTS idx_drivers_user_id ON drivers(user_id);
CREATE INDEX IF NOT EXISTS idx_drivers_online_approved ON drivers(is_online, is_approved);
CREATE INDEX IF NOT EXISTS idx_rides_passenger_id ON rides(passenger_id);
CREATE INDEX IF NOT EXISTS idx_rides_driver_id ON rides(driver_id);
CREATE INDEX IF NOT EXISTS idx_rides_status_created_at ON rides(status, created_at DESC);

-- =========================================================================
-- 002_auth_accounts_password.sql
-- =========================================================================
ALTER TABLE auth_accounts
ADD COLUMN IF NOT EXISTS password text;

-- =========================================================================
-- 003_zones_dispatch_controls.sql
-- =========================================================================
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS geo_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  boundary geography(MultiPolygon, 4326) NOT NULL,
  max_online_drivers integer NOT NULL DEFAULT 25 CHECK (max_online_drivers BETWEEN 1 AND 500),
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS zone_id uuid REFERENCES geo_zones(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS online_since timestamptz,
  ADD COLUMN IF NOT EXISTS last_heartbeat_at timestamptz;

ALTER TABLE rides
  ADD COLUMN IF NOT EXISTS zone_id uuid REFERENCES geo_zones(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancellation_reason text;

CREATE TABLE IF NOT EXISTS ride_driver_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id uuid NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'websocket' CHECK (channel IN ('websocket', 'sms')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  delivered_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ride_id, driver_id, channel)
);

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES auth_users(id) ON DELETE RESTRICT,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS otp_cooldowns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL UNIQUE,
  last_sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION enforce_ride_state_machine()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status <> NEW.status THEN
    IF OLD.status = 'requested' AND NEW.status NOT IN ('accepted', 'cancelled') THEN
      RAISE EXCEPTION 'Invalid ride transition: % to %', OLD.status, NEW.status;
    END IF;
    IF OLD.status = 'accepted' AND NEW.status NOT IN ('completed', 'cancelled') THEN
      RAISE EXCEPTION 'Invalid ride transition: % to %', OLD.status, NEW.status;
    END IF;
    IF OLD.status IN ('completed', 'cancelled') THEN
      RAISE EXCEPTION 'Closed rides cannot transition from % to %', OLD.status, NEW.status;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_ride_state_machine ON rides;
CREATE TRIGGER trg_enforce_ride_state_machine
BEFORE UPDATE ON rides
FOR EACH ROW EXECUTE FUNCTION enforce_ride_state_machine();

CREATE UNIQUE INDEX IF NOT EXISTS idx_rides_one_active_per_passenger
  ON rides(passenger_id)
  WHERE status IN ('requested', 'accepted');

CREATE INDEX IF NOT EXISTS idx_geo_zones_boundary ON geo_zones USING gist(boundary);
CREATE INDEX IF NOT EXISTS idx_drivers_zone_online ON drivers(zone_id, is_online, is_approved, online_since);
CREATE INDEX IF NOT EXISTS idx_drivers_heartbeat ON drivers(is_online, last_heartbeat_at);
CREATE INDEX IF NOT EXISTS idx_rides_zone_status ON rides(zone_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ride_driver_notifications_driver
  ON ride_driver_notifications(driver_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_actor_created ON admin_audit_log(actor_id, created_at DESC);

-- =========================================================================
-- 004_realtime_tokens.sql
-- =========================================================================
CREATE TABLE IF NOT EXISTS realtime_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_realtime_tokens_user_id ON realtime_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_realtime_tokens_expires_at ON realtime_tokens(expires_at);

-- =========================================================================
-- 005_otp_challenges.sql
-- =========================================================================
CREATE TABLE IF NOT EXISTS otp_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL,
  otp_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_otp_challenges_identifier_created
  ON otp_challenges(identifier, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_otp_challenges_expires_at
  ON otp_challenges(expires_at);

-- =========================================================================
-- 006_ride_ratings.sql
-- =========================================================================
ALTER TABLE rides
  ADD COLUMN IF NOT EXISTS driver_rating smallint CHECK (driver_rating BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS rating_feedback text CHECK (rating_feedback IS NULL OR char_length(rating_feedback) <= 280);

-- =========================================================================
-- 007_seed_account_passwords.sql
-- =========================================================================
-- Backfill a credentials account row for every auth_users row that
-- has no corresponding credentials account. The placeholder hash is
-- Argon2id for an empty string because the app verifies passwords with argon2.
INSERT INTO auth_accounts (
  "userId", type, provider, "providerAccountId", password
)
SELECT
  u.id,
  'credentials',
  'credentials',
  u.id::text,
  '$argon2id$v=19$m=65536,t=3,p=4$zZag8kdZmawM+DONm938fw$tVjaOjPqrwqBWooUDPpPT1wSiJseMWfr3RrHOZPx8rM'
FROM auth_users u
WHERE NOT EXISTS (
  SELECT 1 FROM auth_accounts a
  WHERE a."userId" = u.id AND a.provider = 'credentials'
);

-- Seed/demo accounts can sign in immediately when OTP is enabled.
-- Temporary password: 12345
UPDATE auth_accounts a
SET password = '$argon2id$v=19$m=65536,t=3,p=4$Pa+RYeA/ztvDriTDTkJ9mQ$24yeu1BTZPDvcvEzBSNlfRMazLbWlccycyfs+GDk+7Q'
FROM auth_users u
WHERE a."userId" = u.id
  AND a.provider = 'credentials'
  AND (
    u.email IN (
      'admin7893725929@autoride.test',
      'driver9908027984@autoride.test',
      'passenger9885553312@autoride.test'
    )
    OR regexp_replace(coalesce(u.phone, ''), '\D', '', 'g') IN (
      '7893725929',
      '9908027984',
      '9885553312'
    )
  );

-- =========================================================================
-- 009_postgis_driver_location.sql
-- =========================================================================
CREATE EXTENSION IF NOT EXISTS postgis;

ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS location geography(POINT, 4326);

UPDATE drivers
SET location = ST_SetSRID(ST_MakePoint(last_lng, last_lat), 4326)::geography
WHERE last_lat IS NOT NULL
  AND last_lng IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_drivers_location ON drivers USING GIST(location);

CREATE OR REPLACE FUNCTION sync_driver_location()
RETURNS trigger AS $$
BEGIN
  IF NEW.last_lat IS NOT NULL AND NEW.last_lng IS NOT NULL THEN
    NEW.location = ST_SetSRID(ST_MakePoint(NEW.last_lng, NEW.last_lat), 4326)::geography;
  ELSE
    NEW.location = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_driver_location ON drivers;
CREATE TRIGGER trg_sync_driver_location
BEFORE UPDATE OF last_lat, last_lng ON drivers
FOR EACH ROW EXECUTE FUNCTION sync_driver_location();

-- =========================================================================
-- 010_geo_zones_dispatch_enabled.sql
-- =========================================================================
ALTER TABLE geo_zones
  ADD COLUMN IF NOT EXISTS dispatch_enabled boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_geo_zones_dispatch_enabled
  ON geo_zones(is_active, dispatch_enabled);

-- =========================================================================
-- 011_driver_kyc.sql
-- =========================================================================
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

-- =========================================================================
-- 012_consent_tracking.sql
-- =========================================================================
ALTER TABLE auth_users
  ADD COLUMN IF NOT EXISTS data_consent_given boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS data_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS data_consent_version text;

ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS data_consent_given boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS data_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS data_consent_version text;

-- =========================================================================
-- 013_ride_started_at.sql
-- =========================================================================
ALTER TABLE rides
  ADD COLUMN IF NOT EXISTS started_at timestamptz;

-- =========================================================================
-- 014_fare_negotiation.sql
-- =========================================================================
ALTER TABLE rides
  ADD COLUMN IF NOT EXISTS fare_min integer,
  ADD COLUMN IF NOT EXISTS fare_max integer,
  ADD COLUMN IF NOT EXISTS negotiation_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS final_fare integer,
  ADD COLUMN IF NOT EXISTS negotiation_mode text NOT NULL DEFAULT 'fixed'
    CHECK (negotiation_mode IN ('fixed', 'negotiated'));

ALTER TABLE rides DROP CONSTRAINT IF EXISTS rides_status_check;
ALTER TABLE rides ADD CONSTRAINT rides_status_check
  CHECK (status IN ('requested', 'negotiating', 'accepted', 'completed', 'cancelled'));

DROP TRIGGER IF EXISTS trg_enforce_ride_state_machine ON rides;
CREATE OR REPLACE FUNCTION enforce_ride_state_machine()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status <> NEW.status THEN
    IF OLD.status = 'requested' AND NEW.status NOT IN ('negotiating', 'accepted', 'cancelled') THEN
      RAISE EXCEPTION 'Invalid ride transition: % to %', OLD.status, NEW.status;
    END IF;
    IF OLD.status = 'negotiating' AND NEW.status NOT IN ('requested', 'accepted', 'cancelled') THEN
      RAISE EXCEPTION 'Invalid ride transition: % to %', OLD.status, NEW.status;
    END IF;
    IF OLD.status = 'accepted' AND NEW.status NOT IN ('completed', 'cancelled') THEN
      RAISE EXCEPTION 'Invalid ride transition: % to %', OLD.status, NEW.status;
    END IF;
    IF OLD.status IN ('completed', 'cancelled') THEN
      RAISE EXCEPTION 'Closed rides cannot transition from % to %', OLD.status, NEW.status;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_enforce_ride_state_machine
BEFORE UPDATE ON rides
FOR EACH ROW EXECUTE FUNCTION enforce_ride_state_machine();

CREATE TABLE IF NOT EXISTS ride_fare_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id uuid NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  offer_type text NOT NULL CHECK (offer_type IN ('accept', 'counter', 'decline')),
  offered_fare integer,
  responded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ride_id, driver_id)
);

CREATE INDEX IF NOT EXISTS idx_ride_fare_offers_ride ON ride_fare_offers(ride_id);
CREATE INDEX IF NOT EXISTS idx_rides_negotiating ON rides(status) WHERE status = 'negotiating';

DROP INDEX IF EXISTS idx_rides_one_active_per_passenger;
CREATE UNIQUE INDEX IF NOT EXISTS idx_rides_one_active_per_passenger
  ON rides(passenger_id)
  WHERE status IN ('requested', 'negotiating', 'accepted');

COMMENT ON COLUMN ride_driver_notifications.channel IS
  'Legacy enum from original architecture. websocket value is unused/retired for transport; fare negotiation realtime uses Pusher. sms remains active for OTP/critical fallback.';

-- =========================================================================
-- 015_notifications_observability_privacy.sql
-- =========================================================================
CREATE TABLE IF NOT EXISTS user_push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  token text NOT NULL,
  provider text NOT NULL DEFAULT 'expo' CHECK (provider IN ('expo')),
  platform text CHECK (platform IN ('ios', 'android', 'web')),
  device_id text,
  is_active boolean NOT NULL DEFAULT true,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, token)
);

CREATE INDEX IF NOT EXISTS idx_user_push_tokens_user_active
  ON user_push_tokens(user_id, is_active, last_seen_at DESC);

CREATE TABLE IF NOT EXISTS operational_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  actor_id uuid REFERENCES auth_users(id) ON DELETE SET NULL,
  target_type text,
  target_id uuid,
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('debug', 'info', 'warn', 'error')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_operational_events_created_at
  ON operational_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_operational_events_type_created_at
  ON operational_events(event_type, created_at DESC);

CREATE TABLE IF NOT EXISTS privacy_retention_policies (
  key text PRIMARY KEY,
  retention_days integer NOT NULL CHECK (retention_days BETWEEN 1 AND 3650),
  description text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO privacy_retention_policies (key, retention_days, description)
VALUES
  ('operational_events', 90, 'Low-risk operational diagnostics and lifecycle events.'),
  ('inactive_push_tokens', 180, 'Inactive or stale mobile push tokens.'),
  ('admin_audit_log', 730, 'Admin/security audit trail. Review before reducing.')
ON CONFLICT (key) DO UPDATE
SET retention_days = EXCLUDED.retention_days,
    description = EXCLUDED.description,
    updated_at = CURRENT_TIMESTAMP;

-- =========================================================================
-- 016_integrations_masked_calls_subscriptions.sql
-- =========================================================================
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

-- =========================================================================
-- 017_queued_subscription_changes.sql
-- =========================================================================
ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS queued_subscription_plan text CHECK (queued_subscription_plan IN ('starter', 'active', 'pro')),
  ADD COLUMN IF NOT EXISTS queued_subscription_starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS queued_subscription_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS queued_razorpay_subscription_id text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_drivers_queued_razorpay_subscription_id
  ON drivers(queued_razorpay_subscription_id)
  WHERE queued_razorpay_subscription_id IS NOT NULL;

-- =========================================================================
-- 018_passenger_profiles.sql
-- =========================================================================
ALTER TABLE auth_users
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS gender_identity text,
  ADD COLUMN IF NOT EXISTS emergency_contact_name text,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone text,
  ADD COLUMN IF NOT EXISTS preferred_language text NOT NULL DEFAULT 'English',
  ADD COLUMN IF NOT EXISTS accessibility_needs text,
  ADD COLUMN IF NOT EXISTS profile_completed_at timestamptz;

ALTER TABLE auth_users
  DROP CONSTRAINT IF EXISTS auth_users_gender_identity_check;

ALTER TABLE auth_users
  ADD CONSTRAINT auth_users_gender_identity_check
  CHECK (
    gender_identity IS NULL
    OR gender_identity IN ('woman', 'man', 'non_binary', 'self_described', 'prefer_not_to_say')
  );

ALTER TABLE auth_users
  DROP CONSTRAINT IF EXISTS auth_users_preferred_language_check;

ALTER TABLE auth_users
  ADD CONSTRAINT auth_users_preferred_language_check
  CHECK (
    preferred_language IN (
      'English',
      'Hindi',
      'Bengali',
      'Gujarati',
      'Kannada',
      'Malayalam',
      'Marathi',
      'Odia',
      'Punjabi',
      'Tamil',
      'Telugu',
      'Urdu'
    )
  );
