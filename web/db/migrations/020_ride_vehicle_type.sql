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