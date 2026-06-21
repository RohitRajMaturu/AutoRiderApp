import sql from "@/app/api/utils/sql";
import { resolveUploadUrl } from "@/app/api/utils/object-storage";
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

function getOrigin(request) {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedProto && forwardedHost) return `${forwardedProto}://${forwardedHost}`;
  return new URL(request.url).origin;
}

export async function GET(request) {
  try {
    const session = await auth(request);
    if (!session || !session.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rows = await sql`
      SELECT id, email, role, phone, image, data_consent_given, data_consent_at, data_consent_version
      FROM auth_users 
      WHERE id = ${session.user.id} 
      LIMIT 1
    `;

    if (rows.length === 0) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    return Response.json({
      user: {
        ...rows[0],
        image_storage_path: rows[0].image || null,
        image: resolveUploadUrl(rows[0].image, getOrigin(request)),
      },
    });
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

    const { role, phone, image } = await request.json();
    const nextRole = role === undefined || role === null ? null : role;
    const nextPhone = readOptionalString(phone, 32);
    const nextImage = readOptionalString(image, 2048);

    if (nextRole !== null && !ALLOWED_PROFILE_ROLES.has(nextRole)) {
      return Response.json(
        { error: "Role can only be changed to passenger or driver from this endpoint" },
        { status: 400 },
      );
    }
    if (nextPhone === null) {
      return Response.json({ error: "Invalid phone" }, { status: 400 });
    }
    if (nextImage === null) {
      return Response.json({ error: "Invalid profile image" }, { status: 400 });
    }

    const rows = await sql`
      UPDATE auth_users 
      SET role = COALESCE(${nextRole}, role), 
          phone = COALESCE(${nextPhone}, phone),
          image = COALESCE(${nextImage}, image),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${session.user.id}
      RETURNING id, email, role, phone, image, data_consent_given, data_consent_at, data_consent_version
    `;

    return Response.json({
      user: {
        ...rows[0],
        image_storage_path: rows[0].image || null,
        image: resolveUploadUrl(rows[0].image, getOrigin(request)),
      },
    });
  } catch (err) {
    console.error("PUT /api/user-profile error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
