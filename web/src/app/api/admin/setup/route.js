import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

export async function POST() {
  try {
    const session = await auth();
    if (!session || !session.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    await sql`UPDATE auth_users SET role = 'admin' WHERE id = ${session.user.id}`;

    return Response.json({
      success: true,
      message: "You are now an admin. Please delete this route after use.",
    });
  } catch (err) {
    console.error("POST /api/admin/setup error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
