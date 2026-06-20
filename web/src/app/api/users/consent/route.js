import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

function readString(value) {
  return typeof value === "string" ? value.trim() : "";
}

export async function PATCH(request) {
  try {
    const session = await auth(request);
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    if (body.dataConsentGiven !== true) {
      return Response.json(
        { error: "Data consent is required to continue." },
        { status: 400 },
      );
    }

    const consentAt = readString(body.dataConsentAt) || new Date().toISOString();
    const consentVersion = readString(body.dataConsentVersion) || "v1";

    const rows = await sql`
      UPDATE auth_users
      SET data_consent_given = true,
          data_consent_at = ${consentAt},
          data_consent_version = ${consentVersion},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${session.user.id}
        AND role IN ('passenger', 'driver')
      RETURNING id, email, role, phone, data_consent_given, data_consent_at, data_consent_version
    `;

    if (rows.length === 0) {
      return Response.json(
        { error: "Consent is only required for passenger and driver accounts." },
        { status: 400 },
      );
    }

    if (rows[0].role === "driver") {
      await sql`
        UPDATE drivers
        SET data_consent_given = true,
            data_consent_at = ${consentAt},
            data_consent_version = ${consentVersion},
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ${session.user.id}
      `;
    }

    return Response.json({ user: rows[0] });
  } catch (err) {
    console.error("PATCH /api/users/consent error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
