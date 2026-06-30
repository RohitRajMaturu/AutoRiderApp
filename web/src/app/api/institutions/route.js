import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";
import { hash } from "argon2";
import { readBoundedString } from "@/app/api/utils/validation";

function readAdminCredentials(body) {
  if (body.adminUserId) return { adminUserId: body.adminUserId };
  const name = readBoundedString(body.adminName, { min: 2, max: 100 });
  const email = String(body.adminEmail || "").trim().toLowerCase();
  const phone = String(body.adminPhone || "").replace(/\D/g, "");
  const password = String(body.adminPassword || "");
  if (!name && !email && !phone && !password) return null;
  if (
    !name ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    phone.length < 10 ||
    phone.length > 15 ||
    password.length < 8 ||
    password.length > 72
  ) {
    return false;
  }
  return { name, email, phone, password };
}

export async function POST(request) {
  const session = await auth(request);
  if (!session?.user?.id)
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "admin")
    return Response.json(
      { error: "Administrator access required" },
      { status: 403 },
    );
  const body = await request.json().catch(() => ({}));
  const name = readBoundedString(body.name, { min: 2, max: 200 });
  const type = String(body.type || body.institutionType || "").toUpperCase();
  const plan = String(body.subscriptionPlan || "BASIC").toUpperCase();
  const monthlyFee = Number(body.monthlyFee);
  const adminCredentials = readAdminCredentials(body);
  if (
    !name ||
    !["SCHOOL", "COLLEGE", "HOSPITAL", "CORPORATE"].includes(type) ||
    !["BASIC", "STANDARD", "PREMIUM"].includes(plan) ||
    !Number.isInteger(monthlyFee) ||
    monthlyFee < 0 ||
    adminCredentials === false
  ) {
    return Response.json(
      { error: "Invalid institution details" },
      { status: 400 },
    );
  }
  const passwordHash = adminCredentials?.password
    ? await hash(adminCredentials.password)
    : null;
  try {
    const result = await sql.transaction(async (tx) => {
    let adminUserId = adminCredentials?.adminUserId || null;
    let createdAdmin = null;
    if (adminCredentials?.password) {
      const existing = await tx`
        SELECT id FROM auth_users
        WHERE lower(email) = ${adminCredentials.email}
           OR regexp_replace(coalesce(phone, ''), '\\D', '', 'g') = ${adminCredentials.phone}
        LIMIT 1
      `;
      if (existing[0]) {
        const conflict = new Error("An account already uses that admin email or phone");
        conflict.code = "INSTITUTION_ADMIN_EXISTS";
        throw conflict;
      }
      const users = await tx`
        INSERT INTO auth_users (name, email, phone, role, "emailVerified")
        VALUES (${adminCredentials.name}, ${adminCredentials.email}, ${adminCredentials.phone}, 'institution_admin', CURRENT_TIMESTAMP)
        RETURNING id, name, email, phone, role
      `;
      createdAdmin = users[0];
      adminUserId = createdAdmin.id;
      await tx`
        INSERT INTO auth_accounts ("userId", provider, type, "providerAccountId", password)
        VALUES (${adminUserId}, 'credentials', 'credentials', ${adminUserId}, ${passwordHash})
      `;
    }
    const rows = await tx`
      INSERT INTO institutions (name,institution_type,address,contact_name,contact_email,contact_phone,
        admin_user_id,subscription_plan,monthly_fee,trial_ends_at)
      VALUES (${name},${type},${String(body.address || "").slice(0, 500)},${String(body.contactName || "").slice(0, 100)},
        ${String(body.contactEmail || "").slice(0, 150)},${String(body.contactPhone || "").slice(0, 15)},
        ${adminUserId},${plan},${monthlyFee},${body.trialEndsAt || null}::date) RETURNING *
    `;
    if (adminUserId) {
      await tx`UPDATE auth_users SET role='institution_admin' WHERE id=${adminUserId}`;
      await tx`INSERT INTO institution_admin_users(institution_id,user_id) VALUES(${rows[0].id},${adminUserId})
        ON CONFLICT (user_id) DO UPDATE SET institution_id=EXCLUDED.institution_id`;
    }
    return { institution: rows[0], admin: createdAdmin };
    });
    return Response.json(result, { status: 201 });
  } catch (error) {
    if (error?.code === "INSTITUTION_ADMIN_EXISTS" || error?.code === "23505") {
      return Response.json(
        { error: "An account already uses that admin email or phone", code: "INSTITUTION_ADMIN_EXISTS" },
        { status: 409 },
      );
    }
    console.error("POST /api/institutions error:", error);
    return Response.json(
      { error: "Unable to create institution", code: "INSTITUTION_CREATE_FAILED" },
      { status: 500 },
    );
  }
}
