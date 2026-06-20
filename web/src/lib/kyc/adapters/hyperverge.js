import { KYC_RULES } from "../contract";

const HV_BASE = "https://ind-docs.hyperverge.co/v2.0";

function hvHeaders() {
  const appId = process.env.HYPERVERGE_APP_ID;
  const appKey = process.env.HYPERVERGE_APP_KEY;
  if (!appId || !appKey) {
    throw new Error("HyperVerge credentials are not configured");
  }
  return {
    appid: appId,
    appkey: appKey,
  };
}

async function readDocument(imageUrl, clientId) {
  const form = new FormData();
  form.append("image", imageUrl);
  form.append("clientId", clientId);

  const res = await fetch(`${HV_BASE}/readKYC`, {
    method: "POST",
    headers: hvHeaders(),
    body: form,
  });

  if (!res.ok) {
    throw new Error(`HyperVerge readKYC failed: ${res.status}`);
  }
  return res.json();
}

async function matchFace() {
  throw new Error(
    "HyperVerge face-match endpoint not yet confirmed; configure adapter after receiving vendor docs",
  );
}

async function lookupDlStatus() {
  throw new Error(
    "HyperVerge DL lookup endpoint not yet confirmed; configure adapter after receiving vendor docs",
  );
}

async function lookupRcStatus() {
  throw new Error(
    "HyperVerge RC lookup endpoint not yet confirmed; configure adapter after receiving vendor docs",
  );
}

/**
 * @returns {Promise<import("../contract").KycResult>}
 */
export async function verifyWithHyperVerge(input) {
  const clientId = input.driverId ?? input.driverName;
  const auditRows = [];
  let ocrMatch = null;
  let dlActive = null;
  let rcActive = null;
  let biometricScore = null;
  let tamperingDetected = false;
  let failureReason = null;

  try {
    const dlOcr = await readDocument(input.dlPhotoUrl, clientId);
    const rcOcr = await readDocument(input.rcPhotoUrl, clientId);

    ocrMatch =
      normalizeMatch(dlOcr?.[0]?.details?.name, input.driverName) &&
      normalizeMatch(dlOcr?.[0]?.details?.dl_number, input.dlNumber);

    auditRows.push({
      check_type: "ocr_match",
      status: ocrMatch ? "pass" : "manual_review",
      raw_result: { dlOcr, rcOcr },
      confidence_score: null,
    });
  } catch (err) {
    auditRows.push({
      check_type: "ocr_match",
      status: "not_run",
      raw_result: { error: String(err) },
      confidence_score: null,
    });
  }

  try {
    const dlResult = await lookupDlStatus(input.dlNumber, input.dob, clientId);
    dlActive = dlResult?.status === "active";
    auditRows.push({
      check_type: "dl_lookup",
      status: dlActive ? "pass" : "fail",
      raw_result: dlResult,
      confidence_score: null,
    });
  } catch (err) {
    auditRows.push({
      check_type: "dl_lookup",
      status: "not_run",
      raw_result: { error: String(err) },
      confidence_score: null,
    });
  }

  try {
    const rcResult = await lookupRcStatus(input.rcNumber, clientId);
    rcActive = rcResult?.status === "active";
    auditRows.push({
      check_type: "rc_lookup",
      status: rcActive ? "pass" : "fail",
      raw_result: rcResult,
      confidence_score: null,
    });
  } catch (err) {
    auditRows.push({
      check_type: "rc_lookup",
      status: "not_run",
      raw_result: { error: String(err) },
      confidence_score: null,
    });
  }

  try {
    const faceResult = await matchFace(input.selfieUrl, input.dlPhotoUrl, clientId);
    biometricScore = faceResult?.confidence;
    auditRows.push({
      check_type: "biometric_match",
      status:
        biometricScore >= KYC_RULES.MIN_BIOMETRIC_SCORE
          ? "pass"
          : "manual_review",
      raw_result: faceResult,
      confidence_score: biometricScore,
    });
  } catch (err) {
    auditRows.push({
      check_type: "biometric_match",
      status: "not_run",
      raw_result: { error: String(err) },
      confidence_score: null,
    });
  }

  let verification_status;
  if (tamperingDetected && KYC_RULES.AUTO_REJECT_ON_TAMPERING) {
    verification_status = "REJECTED";
    failureReason = "Document tampering detected";
  } else if (dlActive === false || rcActive === false) {
    verification_status = "REJECTED";
    failureReason =
      dlActive === false ? "DL status not active" : "RC status not active";
  } else if (
    ocrMatch === false ||
    biometricScore === null ||
    (biometricScore !== null &&
      biometricScore < KYC_RULES.MIN_BIOMETRIC_SCORE) ||
    dlActive === null ||
    rcActive === null
  ) {
    verification_status = "PENDING_MANUAL_REVIEW";
    failureReason =
      failureReason ??
      (ocrMatch === false
        ? "OCR mismatch between document and submitted details"
        : null);
  } else {
    verification_status = "APPROVED";
  }

  return {
    verification_status,
    checks: {
      ocr_match: ocrMatch,
      dl_active: dlActive,
      rc_active: rcActive,
      biometric_match_score: biometricScore,
    },
    failure_reason: failureReason,
    audit_rows: auditRows,
  };
}

function normalizeMatch(a, b) {
  if (!a || !b) return false;
  return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
}
