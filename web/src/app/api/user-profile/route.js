import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

export async function GET() {
  try {
    const session = await auth();
    if (!session || !session.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rows = await sql`
      SELECT id, email, role, phone 
      FROM auth_users 
      WHERE id = ${session.user.id} 
      LIMIT 1
    `;

    if (rows.length === 0) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    return Response.json({ user: rows[0] });
  } catch (err) {
    console.error("GET /api/user-profile error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const session = await auth();
    if (!session || !session.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { role, phone } = await request.json();

    const rows = await sql`
      UPDATE auth_users 
      SET role = COALESCE(${role}, role), 
          phone = COALESCE(${phone}, phone)
      WHERE id = ${session.user.id}
      RETURNING id, email, role, phone
    `;

    return Response.json({ user: rows[0] });
  } catch (err) {
    console.error("PUT /api/user-profile error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
