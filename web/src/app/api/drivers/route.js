import sql from "@/app/api/utils/sql";
import { resolveDriverUploadUrls } from "@/app/api/utils/object-storage";
import { auth } from "@/auth";

function readString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function getOrigin(request) {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedProto && forwardedHost) return `${forwardedProto}://${forwardedHost}`;
  return new URL(request.url).origin;
}

export async function POST(request) {
  try {
    const session = await auth(request);
    if (!session || !session.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {
      vehicle_number,
      auto_photo_url,
      license_url,
      dataConsentGiven,
      dataConsentAt,
      dataConsentVersion,
    } =
      await request.json();
    const vehicleNumber = readString(vehicle_number).toUpperCase();
    const autoPhotoUrl = readString(auto_photo_url) || null;
    const licenseUrl = readString(license_url);
    const consentAt = readString(dataConsentAt) || new Date().toISOString();
    const consentVersion = readString(dataConsentVersion) || "v1";

    if (dataConsentGiven !== true) {
      return Response.json(
        { error: "Data consent is required to create an account." },
        { status: 400 },
      );
    }

    if (!vehicleNumber || vehicleNumber.length > 32 || !licenseUrl) {
      return Response.json(
        { error: "Vehicle number and license document URL are required" },
        { status: 400 },
      );
    }

    const existing =
      await sql`SELECT id FROM drivers WHERE user_id = ${session.user.id} LIMIT 1`;
    if (existing.length > 0) {
      return Response.json(
        { error: "Already registered as a driver" },
        { status: 400 },
      );
    }

    const rows = await sql`
      INSERT INTO drivers (
        user_id,
        vehicle_number,
        auto_photo_url,
        license_url,
        data_consent_given,
        data_consent_at,
        data_consent_version
      )
      VALUES (
        ${session.user.id},
        ${vehicleNumber},
        ${autoPhotoUrl},
        ${licenseUrl},
        true,
        ${consentAt},
        ${consentVersion}
      )
      RETURNING *
    `;

    await sql`
      UPDATE auth_users
      SET role = 'driver',
          data_consent_given = true,
          data_consent_at = ${consentAt},
          data_consent_version = ${consentVersion},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${session.user.id}
    `;

    return Response.json({ driver: rows[0] });
  } catch (err) {
    console.error("POST /api/drivers error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const session = await auth(request);
    if (!session || !session.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rows = await sql`
      SELECT * FROM drivers 
      WHERE user_id = ${session.user.id} 
      LIMIT 1
    `;

    return Response.json({
      driver: resolveDriverUploadUrls(rows[0] || null, getOrigin(request)),
    });
  } catch (err) {
    console.error("GET /api/drivers/me error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const session = await auth(request);
    if (!session || !session.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { auto_photo_url } = await request.json();
    const autoPhotoUrl = readString(auto_photo_url);
    if (!autoPhotoUrl || autoPhotoUrl.length > 2048) {
      return Response.json({ error: "Auto photo URL is required" }, { status: 400 });
    }

    const rows = await sql`
      UPDATE drivers
      SET auto_photo_url = ${autoPhotoUrl},
          updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ${session.user.id}
      RETURNING *
    `;

    if (rows.length === 0) {
      return Response.json({ error: "Driver profile not found" }, { status: 404 });
    }

    return Response.json({
      driver: resolveDriverUploadUrls(rows[0], getOrigin(request)),
    });
  } catch (err) {
    console.error("PATCH /api/drivers error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
