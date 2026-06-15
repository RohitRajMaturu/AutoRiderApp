import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import argon2 from "argon2";

const ADMIN_PHONE = "7893725929";
const ADMIN_EMAIL = "admin7893725929@autoride.test";
const ADMIN_PASSWORD = "12345";

function readEnv() {
  const envPath = path.join(process.cwd(), ".env");
  const entries = fs
    .readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index), line.slice(index + 1)];
    });
  return Object.fromEntries(entries);
}

const env = readEnv();
const pool = new pg.Pool({ connectionString: env.DATABASE_URL });
const passwordHash = await argon2.hash(ADMIN_PASSWORD);

const client = await pool.connect();

try {
  await client.query("BEGIN");

  const existing = await client.query(
    `
      SELECT id, email, phone, role, created_at
      FROM auth_users
      WHERE lower(coalesce(email, '')) = $1
         OR regexp_replace(coalesce(phone, ''), '\\D', '', 'g') = $2
      ORDER BY
        CASE WHEN lower(coalesce(email, '')) = $1 THEN 0 ELSE 1 END,
        CASE WHEN role = 'admin' THEN 0 ELSE 1 END,
        created_at ASC
    `,
    [ADMIN_EMAIL, ADMIN_PHONE],
  );

  let adminId = existing.rows[0]?.id;
  if (!adminId) {
    const created = await client.query(
      `
        INSERT INTO auth_users (email, phone, role)
        VALUES ($1, $2, 'admin')
        RETURNING id
      `,
      [ADMIN_EMAIL, ADMIN_PHONE],
    );
    adminId = created.rows[0].id;
  }

  await client.query(
    `
      UPDATE auth_users
      SET email = $2,
          phone = $3,
          role = 'admin',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `,
    [adminId, ADMIN_EMAIL, ADMIN_PHONE],
  );

  await client.query(
    `
      UPDATE auth_users
      SET phone = NULL,
          role = CASE WHEN role = 'admin' THEN 'passenger' ELSE role END,
          updated_at = CURRENT_TIMESTAMP
      WHERE id <> $1
        AND regexp_replace(coalesce(phone, ''), '\\D', '', 'g') = $2
    `,
    [adminId, ADMIN_PHONE],
  );

  await client.query(
    `
      DELETE FROM auth_accounts
      WHERE "userId" = $1
        AND provider = 'credentials'
        AND "providerAccountId" <> $1::text
    `,
    [adminId],
  );

  await client.query(
    `
      INSERT INTO auth_accounts ("userId", provider, type, "providerAccountId", password)
      VALUES ($1::uuid, 'credentials', 'credentials', $1::text, $2)
      ON CONFLICT (provider, "providerAccountId")
      DO UPDATE SET
        "userId" = EXCLUDED."userId",
        type = EXCLUDED.type,
        password = EXCLUDED.password
    `,
    [adminId, passwordHash],
  );

  await client.query(`DELETE FROM auth_sessions WHERE "userId" = $1`, [adminId]);

  const verifyRows = await client.query(
    `
      SELECT u.id, u.email, u.phone, u.role, a.password
      FROM auth_users u
      JOIN auth_accounts a ON a."userId" = u.id
      WHERE u.id = $1 AND a.provider = 'credentials'
      LIMIT 1
    `,
    [adminId],
  );
  const verified = await argon2.verify(verifyRows.rows[0].password, ADMIN_PASSWORD);

  await client.query("COMMIT");

  console.log(
    JSON.stringify(
      {
        repaired: true,
        verified,
        admin: {
          id: verifyRows.rows[0].id,
          email: verifyRows.rows[0].email,
          phone: verifyRows.rows[0].phone,
          role: verifyRows.rows[0].role,
          password: ADMIN_PASSWORD,
        },
      },
      null,
      2,
    ),
  );
} catch (err) {
  await client.query("ROLLBACK").catch(() => {});
  throw err;
} finally {
  client.release();
  await pool.end();
}
