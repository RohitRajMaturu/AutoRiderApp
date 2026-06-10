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
