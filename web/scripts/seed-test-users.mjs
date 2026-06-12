import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import argon2 from "argon2";

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
const password = await argon2.hash("12345");

const users = [
  { phone: "7893725929", role: "admin", email: "admin7893725929@autoride.test" },
  { phone: "9908027984", role: "driver", email: "driver9908027984@autoride.test" },
  { phone: "9885553312", role: "passenger", email: "passenger9885553312@autoride.test" },
];

try {
  for (const user of users) {
    const existing = await pool.query(
      `
        SELECT id
        FROM auth_users
        WHERE regexp_replace(coalesce(phone, ''), '\\D', '', 'g') = $1
           OR email = $2
        LIMIT 1
      `,
      [user.phone, user.email],
    );

    let id;
    if (existing.rowCount > 0) {
      id = existing.rows[0].id;
      await pool.query(
        `
          UPDATE auth_users
          SET phone = $2,
              email = $3,
              role = $4,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
        `,
        [id, user.phone, user.email, user.role],
      );
    } else {
      const created = await pool.query(
        `
          INSERT INTO auth_users (phone, email, role)
          VALUES ($1, $2, $3)
          RETURNING id
        `,
        [user.phone, user.email, user.role],
      );
      id = created.rows[0].id;
    }

    await pool.query(
      `
        INSERT INTO auth_accounts ("userId", provider, type, "providerAccountId", password)
        VALUES ($1::uuid, 'credentials', 'credentials', $1::text, $2)
        ON CONFLICT (provider, "providerAccountId")
        DO UPDATE SET password = EXCLUDED.password
      `,
      [id, password],
    );

    console.log(`${user.role}: ${user.phone} ${user.email} ${id}`);
  }
} finally {
  await pool.end();
}
