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
