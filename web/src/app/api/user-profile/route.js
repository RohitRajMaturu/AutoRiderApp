import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

const ALLOWED_PROFILE_ROLES = new Set(["passenger", "driver"]);

function readOptionalString(value, maxLength) {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length <= maxLength ? trimmed : null;
}

export async function GET(request) {
  try {
    const session = await auth(request);
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
    const session = await auth(request);
    if (!session || !session.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { role, phone } = await request.json();
    const nextRole = role === undefined || role === null ? null : role;
    const nextPhone = readOptionalString(phone, 32);

    if (nextRole !== null && !ALLOWED_PROFILE_ROLES.has(nextRole)) {
      return Response.json(
        { error: "Role can only be changed to passenger or driver from this endpoint" },
        { status: 400 },
      );
    }
    if (nextPhone === null) {
      return Response.json({ error: "Invalid phone" }, { status: 400 });
    }

    const rows = await sql`
      UPDATE auth_users 
      SET role = COALESCE(${nextRole}, role), 
          phone = COALESCE(${nextPhone}, phone),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${session.user.id}
      RETURNING id, email, role, phone
    `;

    return Response.json({ user: rows[0] });
  } catch (err) {
    console.error("PUT /api/user-profile error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
