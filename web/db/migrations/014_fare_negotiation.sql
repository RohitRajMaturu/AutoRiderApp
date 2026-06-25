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
