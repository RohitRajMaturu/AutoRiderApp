import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";
import { readBoundedString } from "@/app/api/utils/validation";

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
  if (
    !name ||
    !["SCHOOL", "COLLEGE", "HOSPITAL", "CORPORATE"].includes(type) ||
    !["BASIC", "STANDARD", "PREMIUM"].includes(plan) ||
    !Number.isInteger(monthlyFee) ||
    monthlyFee < 0
  ) {
    return Response.json(
      { error: "Invalid institution details" },
      { status: 400 },
    );
  }
  const institution = await sql.transaction(async (tx) => {
    const rows = await tx`
      INSERT INTO institutions (name,institution_type,address,contact_name,contact_email,contact_phone,
        admin_user_id,subscription_plan,monthly_fee,trial_ends_at)
      VALUES (${name},${type},${String(body.address || "").slice(0, 500)},${String(body.contactName || "").slice(0, 100)},
        ${String(body.contactEmail || "").slice(0, 150)},${String(body.contactPhone || "").slice(0, 15)},
        ${body.adminUserId || null},${plan},${monthlyFee},${body.trialEndsAt || null}::date) RETURNING *
    `;
    if (body.adminUserId) {
      await tx`UPDATE auth_users SET role='institution_admin' WHERE id=${body.adminUserId}`;
      await tx`INSERT INTO institution_admin_users(institution_id,user_id) VALUES(${rows[0].id},${body.adminUserId})
        ON CONFLICT (user_id) DO UPDATE SET institution_id=EXCLUDED.institution_id`;
    }
    return rows[0];
  });
  return Response.json({ institution }, { status: 201 });
}
