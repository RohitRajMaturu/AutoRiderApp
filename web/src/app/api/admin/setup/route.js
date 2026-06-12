import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

function normalizePhone(phone) {
  return String(phone || "").replace(/\D/g, "");
}

function getAllowedAdminPhones() {
  return String(process.env.ADMIN_SETUP_PHONES || process.env.ADMIN_SETUP_PHONE || "")
    .split(",")
    .map(normalizePhone)
    .filter(Boolean);
}

export async function POST(request) {
  try {
    if (process.env.NODE_ENV === "production") {
      return Response.json(
        { error: "Admin setup is not available in production" },
        { status: 404 },
      );
    }

    if (process.env.ENABLE_ADMIN_SETUP !== "true") {
      return Response.json(
        { error: "Admin setup is disabled" },
        { status: 404 },
      );
    }

    const session = await auth(request);
    if (!session || !session.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const existingAdmins =
      await sql`SELECT id FROM auth_users WHERE role = 'admin' LIMIT 1`;
    if (existingAdmins.length > 0) {
      if (String(existingAdmins[0].id) === String(session.user.id)) {
        return Response.json({
          success: true,
          message: "You are already an admin.",
        });
      }
      return Response.json(
        { error: "Admin setup is only available before the first admin exists" },
        { status: 403 },
      );
    }

    const userRows = await sql`
      SELECT phone
      FROM auth_users
      WHERE id = ${session.user.id}
      LIMIT 1
    `;
    const userPhone = normalizePhone(userRows[0]?.phone);
    const allowedPhones = getAllowedAdminPhones();
    if (allowedPhones.length > 0 && !allowedPhones.includes(userPhone)) {
      return Response.json(
        { error: "This phone number is not allowed to create the admin account" },
        { status: 403 },
      );
    }

    await sql`UPDATE auth_users SET role = 'admin' WHERE id = ${session.user.id}`;

    return Response.json({
      success: true,
      message: "You are now an admin. Disable ENABLE_ADMIN_SETUP before production.",
    });
  } catch (err) {
    console.error("POST /api/admin/setup error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
