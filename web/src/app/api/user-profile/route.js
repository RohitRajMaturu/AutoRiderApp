import sql from "@/app/api/utils/sql";
import { resolveUploadUrl } from "@/app/api/utils/object-storage";
import { auth } from "@/auth";

const ALLOWED_PROFILE_ROLES = new Set(["passenger", "driver"]);
const ALLOWED_GENDER_IDENTITIES = new Set([
  "woman",
  "man",
  "non_binary",
  "self_described",
  "prefer_not_to_say",
]);
const ALLOWED_LANGUAGES = new Set([
  "English",
  "Hindi",
  "Bengali",
  "Gujarati",
  "Kannada",
  "Malayalam",
  "Marathi",
  "Odia",
  "Punjabi",
  "Tamil",
  "Telugu",
  "Urdu",
]);
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

function readNullableString(value, maxLength) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  return trimmed.length <= maxLength ? trimmed || null : false;
}

function readDateOfBirth(value) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return false;

  const today = new Date();
  const earliest = new Date(Date.UTC(today.getUTCFullYear() - 120, today.getUTCMonth(), today.getUTCDate()));
  const latest = new Date(Date.UTC(today.getUTCFullYear() - 13, today.getUTCMonth(), today.getUTCDate()));
  return date >= earliest && date <= latest ? value : false;
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
      SELECT id, email, role, name, phone, image, date_of_birth::text AS date_of_birth, gender_identity,
             emergency_contact_name, emergency_contact_phone, preferred_language,
             accessibility_needs, profile_completed_at, data_consent_given,
             data_consent_at, data_consent_version
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

    const body = await request.json();
    const {
      role,
      name,
      phone,
      image,
      date_of_birth: dateOfBirth,
      gender_identity: genderIdentity,
      emergency_contact_name: emergencyContactName,
      emergency_contact_phone: emergencyContactPhone,
      preferred_language: preferredLanguage,
      accessibility_needs: accessibilityNeeds,
      complete_profile: completeProfile,
    } = body;
    const nextRole = role === undefined || role === null ? null : role;
    const nextName = readOptionalString(name, 120);
    const nextPhone = readOptionalString(phone, 32);
    const nextImage = readOptionalString(image, 2048);
    const nextDateOfBirth = readDateOfBirth(dateOfBirth);
    const nextGenderIdentity = readNullableString(genderIdentity, 32);
    const nextEmergencyContactName = readNullableString(emergencyContactName, 120);
    const nextEmergencyContactPhone = readNullableString(emergencyContactPhone, 32);
    const nextPreferredLanguage = readOptionalString(preferredLanguage, 32);
    const nextAccessibilityNeeds = readNullableString(accessibilityNeeds, 500);

    if (nextRole !== null && !ALLOWED_PROFILE_ROLES.has(nextRole)) {
      return Response.json(
        { error: "Role can only be changed to passenger or driver from this endpoint" },
        { status: 400 },
      );
    }
    if (nextPhone === null) {
      return Response.json({ error: "Invalid phone" }, { status: 400 });
    }
    if (nextName === null) {
      return Response.json({ error: "Name must be 120 characters or fewer" }, { status: 400 });
    }
    if (nextImage === null) {
      return Response.json({ error: "Invalid profile image" }, { status: 400 });
    }
    if (nextDateOfBirth === false) {
      return Response.json(
        { error: "Date of birth must be valid and indicate an age between 13 and 120" },
        { status: 400 },
      );
    }
    if (nextGenderIdentity === false) {
      return Response.json({ error: "Invalid gender selection" }, { status: 400 });
    }
    if (nextGenderIdentity && !ALLOWED_GENDER_IDENTITIES.has(nextGenderIdentity)) {
      return Response.json({ error: "Invalid gender selection" }, { status: 400 });
    }
    if (
      nextPreferredLanguage !== undefined &&
      !ALLOWED_LANGUAGES.has(nextPreferredLanguage)
    ) {
      return Response.json({ error: "Invalid preferred language" }, { status: 400 });
    }
    if (nextEmergencyContactName === false || nextEmergencyContactPhone === false) {
      return Response.json({ error: "Invalid emergency contact" }, { status: 400 });
    }
    if (nextAccessibilityNeeds === false) {
      return Response.json(
        { error: "Accessibility needs must be 500 characters or fewer" },
        { status: 400 },
      );
    }
    if (completeProfile === true && (!nextName || !nextDateOfBirth)) {
      return Response.json(
        { error: "Full name and date of birth are required to complete your profile" },
        { status: 400 },
      );
    }

    const rows = await sql`
      UPDATE auth_users 
      SET role = COALESCE(${nextRole}, role), 
          name = CASE WHEN ${name !== undefined} THEN ${nextName} ELSE name END,
          phone = COALESCE(${nextPhone}, phone),
          image = COALESCE(${nextImage}, image),
          date_of_birth = CASE
            WHEN ${dateOfBirth !== undefined} THEN ${nextDateOfBirth}
            ELSE date_of_birth
          END,
          gender_identity = CASE
            WHEN ${genderIdentity !== undefined} THEN ${nextGenderIdentity}
            ELSE gender_identity
          END,
          emergency_contact_name = CASE
            WHEN ${emergencyContactName !== undefined} THEN ${nextEmergencyContactName}
            ELSE emergency_contact_name
          END,
          emergency_contact_phone = CASE
            WHEN ${emergencyContactPhone !== undefined} THEN ${nextEmergencyContactPhone}
            ELSE emergency_contact_phone
          END,
          preferred_language = CASE
            WHEN ${preferredLanguage !== undefined} THEN ${nextPreferredLanguage}
            ELSE preferred_language
          END,
          accessibility_needs = CASE
            WHEN ${accessibilityNeeds !== undefined} THEN ${nextAccessibilityNeeds}
            ELSE accessibility_needs
          END,
          profile_completed_at = CASE
            WHEN ${completeProfile === true} THEN CURRENT_TIMESTAMP
            ELSE profile_completed_at
          END,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${session.user.id}
      RETURNING id, email, role, name, phone, image, date_of_birth::text AS date_of_birth, gender_identity,
                emergency_contact_name, emergency_contact_phone, preferred_language,
                accessibility_needs, profile_completed_at, data_consent_given,
                data_consent_at, data_consent_version
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
