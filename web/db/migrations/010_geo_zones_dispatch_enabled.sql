ALTER TABLE geo_zones
  ADD COLUMN IF NOT EXISTS dispatch_enabled boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_geo_zones_dispatch_enabled
  ON geo_zones(is_active, dispatch_enabled);
