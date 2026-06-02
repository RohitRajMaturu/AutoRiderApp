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
