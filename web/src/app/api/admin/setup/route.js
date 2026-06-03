import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

export async function POST(request) {
  try {
    if (process.env.ENABLE_ADMIN_SETUP !== "true") {
      return Response.json(
        { error: "Admin setup is disabled" },
        { status: 404 },
      );
    }

    const existingAdmins =
      await sql`SELECT id FROM auth_users WHERE role = 'admin' LIMIT 1`;
    if (existingAdmins.length > 0) {
      return Response.json(
        { error: "Admin setup is only available before the first admin exists" },
        { status: 403 },
      );
    }

    const session = await auth(request);
    if (!session || !session.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
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
