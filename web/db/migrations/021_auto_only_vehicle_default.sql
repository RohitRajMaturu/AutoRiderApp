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
