-- Backfill a credentials account row for every auth_users row that
-- has no corresponding credentials account. The placeholder hash is
-- Argon2id for an empty string because the app verifies passwords with argon2.
INSERT INTO auth_accounts (
  "userId", type, provider, "providerAccountId", password
)
SELECT
  u.id,
  'credentials',
  'credentials',
  u.id::text,
  '$argon2id$v=19$m=65536,t=3,p=4$zZag8kdZmawM+DONm938fw$tVjaOjPqrwqBWooUDPpPT1wSiJseMWfr3RrHOZPx8rM'
FROM auth_users u
WHERE NOT EXISTS (
  SELECT 1 FROM auth_accounts a
  WHERE a."userId" = u.id AND a.provider = 'credentials'
);

-- Seed/demo accounts can sign in immediately when OTP is enabled.
-- Temporary password: AutoRide@123
UPDATE auth_accounts a
SET password = '$argon2id$v=19$m=65536,t=3,p=4$cO/bsVFn2c1XQGkTVeEJxA$yeVe5nsLTt77yNBBLa9oe9j9HdURicE0wOBgsjQETi4'
FROM auth_users u
WHERE a."userId" = u.id
  AND a.provider = 'credentials'
  AND (
    u.email IN (
      'admin7893725929@autoride.test',
      'driver9908027984@autoride.test',
      'passenger9885553312@autoride.test'
    )
    OR regexp_replace(coalesce(u.phone, ''), '\D', '', 'g') IN (
      '7893725929',
      '9908027984',
      '9885553312'
    )
  );
