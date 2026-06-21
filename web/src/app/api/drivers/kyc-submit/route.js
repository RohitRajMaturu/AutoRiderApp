import sql from "@/app/api/utils/sql";
import { resolveUploadUrl } from "@/app/api/utils/object-storage";
import { auth } from "@/auth";
import { KYC_VENDOR } from "@/lib/kyc/config";
import { verifyDriver } from "@/lib/kyc/verifyDriver";

function readString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function aadhaarLast4(value) {
  const digits = readString(value).replace(/\D/g, "");
  return digits.length >= 4 ? digits.slice(-4) : "";
}

function toDateValue(value) {
  const raw = readString(value);
  if (!raw) return null;

  const displayMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (displayMatch) {
    return `${displayMatch[3]}-${displayMatch[2]}-${displayMatch[1]}`;
  }

  const hypervergeMatch = raw.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (hypervergeMatch) {
    return `${hypervergeMatch[3]}-${hypervergeMatch[2]}-${hypervergeMatch[1]}`;
  }

  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return isoMatch ? raw : null;
}

function kycStatusFor(verificationStatus) {
  if (verificationStatus === "APPROVED") return "approved";
  if (verificationStatus === "REJECTED") return "rejected";
  return "pending_review";
}

function getOrigin(request) {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedProto && forwardedHost) return `${forwardedProto}://${forwardedHost}`;
  return new URL(request.url).origin;
}

async function runTransaction(callback) {
  if (typeof sql.transaction === "function") {
    return sql.transaction(callback);
  }
  return callback(sql);
}

export async function POST(request) {
  try {
    const session = await auth(request);
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const driverName = readString(body.driverName);
    const dob = readString(body.dob);
    const dobDate = toDateValue(dob);
    const dlNumber = readString(body.dlNumber).toUpperCase();
    const dlExpiry = toDateValue(body.dlExpiry);
    const rcNumber = readString(body.rcNumber).toUpperCase();
    const dlPhotoUrl = readString(body.dlPhotoUrl);
    const rcPhotoUrl = readString(body.rcPhotoUrl);
    const selfieUrl = readString(body.selfieUrl);
    const aadhaarNumberFull = readString(body.aadhaarNumberFull);
    const aadhaarMasked = aadhaarLast4(aadhaarNumberFull);

    if (
      !driverName ||
      !dobDate ||
      !dlNumber ||
      !rcNumber ||
      !dlPhotoUrl ||
      !rcPhotoUrl ||
      !selfieUrl ||
      aadhaarMasked.length !== 4
    ) {
      return Response.json(
        { error: "Driver KYC details and document URLs are required" },
        { status: 400 },
      );
    }

    const driverRows = await sql`
      SELECT d.id, u.email, u.phone
      FROM drivers d
      JOIN auth_users u ON u.id = d.user_id
      WHERE d.user_id = ${session.user.id}
      LIMIT 1
    `;
    const driver = driverRows[0];
    if (!driver) {
      return Response.json({ error: "Driver profile not found" }, { status: 404 });
    }

    const origin = getOrigin(request);
    const result = await verifyDriver({
      driverId: driver.id,
      driverName,
      dob,
      dlNumber,
      rcNumber,
      dlPhotoUrl: resolveUploadUrl(dlPhotoUrl, origin),
      rcPhotoUrl: resolveUploadUrl(rcPhotoUrl, origin),
      selfieUrl: resolveUploadUrl(selfieUrl, origin),
      aadhaarNumberFull,
    });

    const kycStatus = kycStatusFor(result.verification_status);

    const updated = await runTransaction(async (tx) => {
      const rows = await tx`
        UPDATE drivers
        SET dl_number = ${dlNumber},
            dl_expiry = ${dlExpiry},
            rc_number = ${rcNumber},
            aadhaar_number_masked = ${aadhaarMasked},
            dob = ${dobDate},
            license_url = ${dlPhotoUrl},
            rc_photo_url = ${rcPhotoUrl},
            selfie_url = ${selfieUrl},
            kyc_status = ${kycStatus},
            kyc_submitted_at = CURRENT_TIMESTAMP,
            kyc_reviewed_at = NULL,
            kyc_reviewed_by = NULL,
            kyc_rejection_reason = ${result.failure_reason},
            is_approved = CASE
              WHEN ${result.verification_status} = 'APPROVED' THEN true
              ELSE is_approved
            END,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${driver.id}
        RETURNING *
      `;

      for (const auditRow of result.audit_rows || []) {
        await tx`
          INSERT INTO driver_kyc_checks (
            driver_id,
            vendor,
            check_type,
            status,
            raw_result,
            confidence_score
          )
          VALUES (
            ${driver.id},
            ${KYC_VENDOR},
            ${auditRow.check_type},
            ${auditRow.status},
            ${JSON.stringify(auditRow.raw_result || {})}::jsonb,
            ${auditRow.confidence_score}
          )
        `;
      }

      return rows[0];
    });

    return Response.json({
      ok: true,
      kyc_status: updated.kyc_status,
      verification_status: result.verification_status,
    });
  } catch (err) {
    console.error("POST /api/drivers/kyc-submit error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
