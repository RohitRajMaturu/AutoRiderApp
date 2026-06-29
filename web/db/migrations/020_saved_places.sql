ALTER TABLE auth_users
  ADD COLUMN IF NOT EXISTS saved_places jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN auth_users.saved_places IS
  'Array of {id, label, address, placeId, lat, lng}. Max 5 entries.';
