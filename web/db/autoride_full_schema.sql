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

-- =========================================================================
-- 019_ride_chat_messages.sql
-- =========================================================================
CREATE TABLE IF NOT EXISTS ride_chat_messages (
  id TEXT PRIMARY KEY,
  ride_id UUID NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('passenger', 'driver')),
  text VARCHAR(200) NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ride_chat_messages_ride_sent
  ON ride_chat_messages (ride_id, sent_at);

-- =========================================================================
-- 020_ride_vehicle_type.sql
-- =========================================================================
-- Store supported vehicle types on drivers and requested rides.
ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS vehicle_type text NOT NULL DEFAULT 'auto';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'drivers_vehicle_type_check'
  ) THEN
    ALTER TABLE drivers
      ADD CONSTRAINT drivers_vehicle_type_check CHECK (vehicle_type IN ('auto','car','truck','bus','bike'));
  END IF;
END$$;

ALTER TABLE rides
  ADD COLUMN IF NOT EXISTS vehicle_type text NOT NULL DEFAULT 'auto';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'rides_vehicle_type_check'
  ) THEN
    ALTER TABLE rides
      ADD CONSTRAINT rides_vehicle_type_check CHECK (vehicle_type IN ('auto','car','truck','bus','bike'));
  END IF;
END$$;

-- =========================================================================
-- 020_saved_places.sql
-- =========================================================================
ALTER TABLE auth_users
  ADD COLUMN IF NOT EXISTS saved_places jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN auth_users.saved_places IS
  'Array of {id, label, address, placeId, lat, lng}. Max 5 entries.';

-- =========================================================================
-- 021_auto_only_vehicle_default.sql
-- =========================================================================
-- Auto-rickshaw is the only active vehicle type for the current product.
-- Keep the column so more types can be enabled deliberately later.
UPDATE drivers
SET vehicle_type = 'auto'
WHERE vehicle_type IS DISTINCT FROM 'auto';

UPDATE rides
SET vehicle_type = 'auto'
WHERE vehicle_type IS DISTINCT FROM 'auto';

ALTER TABLE drivers
  ALTER COLUMN vehicle_type SET DEFAULT 'auto';

ALTER TABLE rides
  ALTER COLUMN vehicle_type SET DEFAULT 'auto';

-- =========================================================================
-- 021_sos_tracking.sql
-- =========================================================================
CREATE TABLE IF NOT EXISTS sos_tracking_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id uuid NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  passenger_id uuid NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sos_tracking_token
  ON sos_tracking_tokens(token)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sos_tracking_ride
  ON sos_tracking_tokens(ride_id);

-- =========================================================================
-- 022_passenger_ratings.sql
-- =========================================================================
-- Allow the assigned driver to rate the passenger after a completed ride.
ALTER TABLE rides
  ADD COLUMN IF NOT EXISTS passenger_rating smallint
    CHECK (passenger_rating BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS passenger_rating_feedback text
    CHECK (
      passenger_rating_feedback IS NULL
      OR char_length(passenger_rating_feedback) <= 280
    );

-- =========================================================================
-- 022_scheduled_rides.sql
-- =========================================================================
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

-- =========================================================================
-- 023_driver_incentives.sql
-- =========================================================================
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

-- =========================================================================
-- 024_phase2_pass_safe.sql
-- =========================================================================
-- TukTukGo Phase 2: TukTukPass + TukTukSafe Schools.
-- Rollback: ../rollbacks/024_phase2_pass_safe.down.sql

ALTER TABLE auth_users DROP CONSTRAINT IF EXISTS auth_users_role_check;
ALTER TABLE auth_users
  ADD CONSTRAINT auth_users_role_check
  CHECK (role IN ('passenger', 'driver', 'admin', 'institution_admin'));

ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS sla_score integer NOT NULL DEFAULT 100
  CHECK (sla_score BETWEEN 0 AND 100);

CREATE TABLE IF NOT EXISTS driver_subscription_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL UNIQUE REFERENCES drivers(id) ON DELETE CASCADE,
  accepts_pass_subscriptions boolean NOT NULL DEFAULT false,
  preferred_shift text NOT NULL DEFAULT 'ANY'
    CHECK (preferred_shift IN ('MORNING', 'EVENING', 'BOTH', 'ANY')),
  preferred_zone geography(Point, 4326),
  preferred_zone_radius_km integer NOT NULL DEFAULT 5
    CHECK (preferred_zone_radius_km BETWEEN 1 AND 30),
  max_active_passes integer NOT NULL DEFAULT 3
    CHECK (max_active_passes BETWEEN 1 AND 3),
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_driver_sub_prefs_accepts
  ON driver_subscription_preferences (accepts_pass_subscriptions)
  WHERE accepts_pass_subscriptions = true;
CREATE INDEX IF NOT EXISTS idx_driver_sub_prefs_zone
  ON driver_subscription_preferences USING gist (preferred_zone);

CREATE TABLE IF NOT EXISTS commuter_passes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  passenger_id uuid NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  driver_id uuid REFERENCES drivers(id) ON DELETE SET NULL,
  backup_driver_id uuid REFERENCES drivers(id) ON DELETE SET NULL,
  pickup_location geography(Point, 4326) NOT NULL,
  dropoff_location geography(Point, 4326) NOT NULL,
  pickup_label varchar(200) NOT NULL,
  dropoff_label varchar(200) NOT NULL,
  scheduled_days text[] NOT NULL CHECK (cardinality(scheduled_days) BETWEEN 1 AND 7),
  scheduled_time time NOT NULL,
  duration_type text NOT NULL CHECK (duration_type IN ('WEEKLY', 'MONTHLY')),
  agreed_fare_paise integer NOT NULL CHECK (agreed_fare_paise > 0),
  platform_fee_paise integer NOT NULL CHECK (platform_fee_paise >= 0),
  driver_payout_paise integer NOT NULL CHECK (driver_payout_paise > 0),
  razorpay_order_id varchar(100),
  razorpay_payment_id varchar(100),
  payment_status text NOT NULL DEFAULT 'PENDING'
    CHECK (payment_status IN ('PENDING', 'PAID', 'REFUNDED', 'PARTIAL_REFUND', 'FAILED')),
  status text NOT NULL DEFAULT 'PENDING_MATCH'
    CHECK (status IN ('PENDING_MATCH', 'ACTIVE', 'PAUSED', 'EXPIRED', 'CANCELLED')),
  start_date date NOT NULL,
  end_date date NOT NULL,
  pause_start_date date,
  pause_end_date date,
  match_attempts integer NOT NULL DEFAULT 0,
  last_match_attempt_at timestamptz,
  driver_no_show_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (end_date >= start_date)
);
CREATE INDEX IF NOT EXISTS idx_passes_passenger ON commuter_passes(passenger_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_passes_driver ON commuter_passes(driver_id, status);
CREATE INDEX IF NOT EXISTS idx_passes_status ON commuter_passes(status, start_date);
CREATE INDEX IF NOT EXISTS idx_passes_pickup ON commuter_passes USING gist(pickup_location);
CREATE INDEX IF NOT EXISTS idx_passes_dropoff ON commuter_passes USING gist(dropoff_location);

CREATE TABLE IF NOT EXISTS pass_rides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pass_id uuid NOT NULL REFERENCES commuter_passes(id) ON DELETE CASCADE,
  scheduled_date date NOT NULL,
  actual_driver_id uuid REFERENCES drivers(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'DRIVER_ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'PASSENGER_NO_SHOW', 'DRIVER_NO_SHOW', 'CANCELLED')),
  otp varchar(4) NOT NULL DEFAULT lpad(floor(random() * 9000 + 1000)::text, 4, '0'),
  start_time timestamptz,
  end_time timestamptz,
  driver_arrived_at timestamptz,
  driver_no_show_escalated boolean NOT NULL DEFAULT false,
  backup_activated boolean NOT NULL DEFAULT false,
  refund_issued boolean NOT NULL DEFAULT false,
  refund_amount_paise integer CHECK (refund_amount_paise IS NULL OR refund_amount_paise >= 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(pass_id, scheduled_date)
);
CREATE INDEX IF NOT EXISTS idx_pass_rides_date ON pass_rides(scheduled_date, status);
CREATE INDEX IF NOT EXISTS idx_pass_rides_driver ON pass_rides(actual_driver_id, scheduled_date);

CREATE TABLE IF NOT EXISTS pass_route_interests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  passenger_id uuid NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  pickup_location geography(Point, 4326) NOT NULL,
  dropoff_location geography(Point, 4326) NOT NULL,
  pickup_label varchar(200) NOT NULL,
  dropoff_label varchar(200) NOT NULL,
  preferred_days text[] NOT NULL,
  preferred_time time NOT NULL,
  notified_when_available boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_route_interests_pickup ON pass_route_interests USING gist(pickup_location);
CREATE INDEX IF NOT EXISTS idx_route_interests_dropoff ON pass_route_interests USING gist(dropoff_location);

CREATE TABLE IF NOT EXISTS institutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(200) NOT NULL,
  institution_type text NOT NULL CHECK (institution_type IN ('SCHOOL', 'COLLEGE', 'HOSPITAL', 'CORPORATE')),
  address text NOT NULL,
  contact_name varchar(100) NOT NULL,
  contact_email varchar(150) NOT NULL,
  contact_phone varchar(15) NOT NULL,
  subscription_plan text NOT NULL DEFAULT 'BASIC' CHECK (subscription_plan IN ('BASIC', 'STANDARD', 'PREMIUM')),
  monthly_fee_paise integer NOT NULL CHECK (monthly_fee_paise >= 0),
  trial_ends_at date,
  active_since date,
  status text NOT NULL DEFAULT 'TRIAL' CHECK (status IN ('TRIAL', 'ACTIVE', 'SUSPENDED', 'CHURNED')),
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS institution_admin_users (
  institution_id uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL UNIQUE REFERENCES auth_users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (institution_id, user_id)
);

CREATE TABLE IF NOT EXISTS institution_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  route_name varchar(100) NOT NULL,
  driver_id uuid REFERENCES drivers(id) ON DELETE SET NULL,
  scheduled_days text[] NOT NULL CHECK (cardinality(scheduled_days) BETWEEN 1 AND 7),
  scheduled_time time NOT NULL,
  direction text NOT NULL CHECK (direction IN ('PICKUP', 'DROPOFF')),
  max_capacity integer NOT NULL DEFAULT 6 CHECK (max_capacity BETWEEN 1 AND 20),
  current_member_count integer NOT NULL DEFAULT 0 CHECK (current_member_count >= 0),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PAUSED')),
  driver_cancel_count_30d integer NOT NULL DEFAULT 0,
  last_driver_cancel_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (current_member_count <= max_capacity)
);
CREATE INDEX IF NOT EXISTS idx_institution_routes_org ON institution_routes(institution_id, status);
CREATE INDEX IF NOT EXISTS idx_institution_routes_driver ON institution_routes(driver_id, status);

CREATE TABLE IF NOT EXISTS institution_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  route_id uuid REFERENCES institution_routes(id) ON DELETE SET NULL,
  member_name varchar(100) NOT NULL,
  member_type text NOT NULL DEFAULT 'STUDENT' CHECK (member_type IN ('STUDENT', 'STAFF')),
  pickup_location geography(Point, 4326),
  pickup_address text,
  stop_order integer CHECK (stop_order IS NULL OR stop_order > 0),
  guardian_name varchar(100),
  guardian_phone varchar(15) NOT NULL,
  guardian_phone_2 varchar(15),
  sms_opted_out boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_members_route ON institution_members(route_id, active);
CREATE INDEX IF NOT EXISTS idx_members_institution ON institution_members(institution_id, active);
CREATE INDEX IF NOT EXISTS idx_members_pickup ON institution_members USING gist(pickup_location);

CREATE TABLE IF NOT EXISTS institution_trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL REFERENCES institution_routes(id) ON DELETE CASCADE,
  institution_id uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  scheduled_date date NOT NULL,
  driver_id uuid REFERENCES drivers(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
  actual_start_time timestamptz,
  actual_end_time timestamptz,
  driver_assigned_at timestamptz,
  members_expected uuid[] NOT NULL DEFAULT '{}',
  members_picked_up uuid[] NOT NULL DEFAULT '{}',
  members_absent uuid[] NOT NULL DEFAULT '{}',
  members_unconfirmed uuid[] NOT NULL DEFAULT '{}',
  cancellation_reason text,
  cancelled_by text CHECK (cancelled_by IS NULL OR cancelled_by IN ('DRIVER', 'INSTITUTION', 'OPS')),
  reassigned_driver_id uuid REFERENCES drivers(id) ON DELETE SET NULL,
  reassignment_triggered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(route_id, scheduled_date)
);
CREATE INDEX IF NOT EXISTS idx_institution_trips_date ON institution_trips(institution_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_institution_trips_status ON institution_trips(status, scheduled_date);

CREATE TABLE IF NOT EXISTS member_tracking_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES institution_trips(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES institution_members(id) ON DELETE CASCADE,
  token varchar(64) NOT NULL UNIQUE,
  guardian_phone varchar(15) NOT NULL,
  sms_sent_at timestamptz,
  pickup_confirmed_at timestamptz,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(trip_id, member_id)
);
CREATE INDEX IF NOT EXISTS idx_tracking_tokens_trip ON member_tracking_tokens(trip_id);

CREATE TABLE IF NOT EXISTS institution_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  billing_month date NOT NULL,
  total_routes integer NOT NULL CHECK (total_routes >= 0),
  total_trips_completed integer NOT NULL CHECK (total_trips_completed >= 0),
  total_trips_scheduled integer NOT NULL CHECK (total_trips_scheduled >= 0),
  amount_paise integer NOT NULL CHECK (amount_paise >= 0),
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SENT', 'PAID', 'OVERDUE')),
  razorpay_payment_link_id varchar(100),
  razorpay_payment_link_url text,
  pdf_url text,
  sent_at timestamptz,
  paid_at timestamptz,
  overdue_reminder_count integer NOT NULL DEFAULT 0 CHECK (overdue_reminder_count BETWEEN 0 AND 3),
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(institution_id, billing_month)
);

CREATE TABLE IF NOT EXISTS driver_sla_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  event_type varchar(50) NOT NULL,
  reference_type varchar(30),
  reference_id uuid,
  points_delta integer NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_driver_sla_events_driver ON driver_sla_events(driver_id, created_at DESC);

CREATE TABLE IF NOT EXISTS institution_trial_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  event_type varchar(50) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(institution_id, event_type)
);

CREATE TABLE IF NOT EXISTS phase2_notification_templates (
  template_key varchar(60) PRIMARY KEY,
  channel varchar(20) NOT NULL CHECK (channel IN ('push', 'sms', 'email')),
  title_template text,
  body_template text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO phase2_notification_templates(template_key, channel, title_template, body_template)
VALUES
  ('PASS_MATCH_FOUND', 'push', 'Driver found for your TukTukPass', '[Name] will pick you up on [days] at [time].'),
  ('PASS_MATCH_FAILED', 'push', 'TukTukPass match update', 'We could not find a driver. A full refund of [amount] was initiated.'),
  ('PASS_REMINDER_PASSENGER', 'push', 'Pickup in 30 minutes', 'OTP: [otp]. Driver: [name], [vehicle].'),
  ('PASS_REMINDER_DRIVER', 'push', 'TukTukPass pickup in 30 minutes', 'Collect [passenger_name] from [pickup_label].'),
  ('PASS_BACKUP_ACTIVATED', 'push', 'Backup driver assigned', '[name] is on the way.'),
  ('PASS_NOSHOW_REFUND', 'push', 'Ride refunded', '[amount] was refunded because the driver did not arrive.'),
  ('PASS_EXPIRING', 'push', 'Your TukTukPass expires soon', 'Renew in [N] days to keep your commute guaranteed.'),
  ('PASS_OFFER_DRIVER', 'push', 'New TukTukPass request', '[pickup] to [dropoff], [days], [time], [amount].'),
  ('SCHOOL_TRIP_START', 'sms', NULL, '[driver] has started. Track [member]: [url]. Vehicle: [reg]. Reply STOP to stop alerts.'),
  ('SCHOOL_PICKUP_CONFIRM', 'sms', NULL, '[member] picked up. ETA [N] minutes. Track: [url]. Reply STOP to stop alerts.'),
  ('SCHOOL_ROUTE_CANCELLED', 'sms', NULL, 'Today''s service for [member] is cancelled. Please arrange transport.'),
  ('SCHOOL_UNCONFIRMED', 'sms', NULL, '[member] pickup status is unconfirmed. Contact the institution or [ops_phone].'),
  ('INSTITUTION_INVOICE', 'email', 'TukTukGo Invoice - [Month] - [amount]', 'Your invoice and payment link are ready.'),
  ('INSTITUTION_OVERDUE', 'email', 'TukTukGo invoice overdue', 'Invoice is [N] days overdue. Pay now: [link].'),
  ('DRIVER_SLA_WARNING', 'push', 'Reliability score update', 'Your reliability score dropped. [N] more issues may affect institution routes.')
ON CONFLICT (template_key) DO UPDATE SET
  channel = EXCLUDED.channel,
  title_template = EXCLUDED.title_template,
  body_template = EXCLUDED.body_template,
  updated_at = CURRENT_TIMESTAMP;
