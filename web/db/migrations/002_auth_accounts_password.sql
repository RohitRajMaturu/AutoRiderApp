ALTER TABLE auth_accounts
ADD COLUMN IF NOT EXISTS password text;
