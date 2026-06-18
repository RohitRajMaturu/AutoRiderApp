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
