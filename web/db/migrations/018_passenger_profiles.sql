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
