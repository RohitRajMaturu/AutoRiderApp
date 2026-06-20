import sql from "@/app/api/utils/sql";
import { requireAdmin, writeAdminAudit } from "@/app/api/utils/admin";
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

export async function GET(request) {
  try {
    const { response } = await requireAdmin(request, auth);
    if (response) return response;

    const rows = await sql`
      SELECT
        d.*,
        u.email,
        u.phone,
        COALESCE(
          json_agg(
            json_build_object(
              'id', c.id,
              'vendor', c.vendor,
              'check_type', c.check_type,
              'status', c.status,
              'raw_result', c.raw_result,
              'confidence_score', c.confidence_score,
              'created_at', c.created_at
            )
            ORDER BY c.created_at DESC
          ) FILTER (WHERE c.id IS NOT NULL),
          '[]'::json
        ) as kyc_checks
      FROM drivers d
      JOIN auth_users u ON u.id = d.user_id
      LEFT JOIN driver_kyc_checks c ON c.driver_id = d.id
      WHERE d.kyc_status = 'pending_review'
      GROUP BY d.id, u.email, u.phone
      ORDER BY d.kyc_submitted_at ASC NULLS LAST, d.created_at ASC
    `;

    const origin = getOrigin(request);
    return Response.json({
      drivers: rows.map((driver) => resolveDriverUploadUrls(driver, origin)),
    });
  } catch (err) {
    console.error("GET /api/admin/kyc error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const { session, response } = await requireAdmin(request, auth);
    if (response) return response;

    const body = await request.json();
    const driverId = readString(body.driver_id);
    const action = readString(body.action);
    const reason = readString(body.reason);

    if (!driverId || !["approve", "reject"].includes(action)) {
      return Response.json(
        { error: "driver_id and action approve/reject are required" },
        { status: 400 },
      );
    }
    if (action === "reject" && !reason) {
      return Response.json(
        { error: "Rejection reason is required" },
        { status: 400 },
      );
    }

    const rows =
      action === "approve"
        ? await sql`
            UPDATE drivers
            SET kyc_status = 'approved',
                is_approved = true,
                kyc_reviewed_at = CURRENT_TIMESTAMP,
                kyc_reviewed_by = ${session.user.id},
                kyc_rejection_reason = NULL,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ${driverId}
            RETURNING *
          `
        : await sql`
            UPDATE drivers
            SET kyc_status = 'rejected',
                is_approved = false,
                is_online = false,
                online_since = NULL,
                kyc_reviewed_at = CURRENT_TIMESTAMP,
                kyc_reviewed_by = ${session.user.id},
                kyc_rejection_reason = ${reason},
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ${driverId}
            RETURNING *
          `;

    if (rows.length === 0) {
      return Response.json({ error: "Driver not found" }, { status: 404 });
    }

    await writeAdminAudit(
      session.user.id,
      action === "approve" ? "driver_kyc.approve" : "driver_kyc.reject",
      "driver",
      rows[0].id,
      action === "approve" ? {} : { reason },
    );

    return Response.json({ driver: rows[0] });
  } catch (err) {
    console.error("PATCH /api/admin/kyc error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
