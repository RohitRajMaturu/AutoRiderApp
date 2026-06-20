import { KYC_RULES } from "../contract";

const HV_BASE_URL = process.env.HYPERVERGE_BASE_URL || "https://hyperverge.co";
const HV_READ_KYC_URL =
  process.env.HYPERVERGE_READ_KYC_URL || `${HV_BASE_URL}/readKYC`;
const HV_FACE_MATCH_URL = process.env.HYPERVERGE_FACE_MATCH_URL || HV_BASE_URL;
const HV_DL_LOOKUP_URL = process.env.HYPERVERGE_DL_LOOKUP_URL || HV_BASE_URL;
const HV_RC_LOOKUP_URL = process.env.HYPERVERGE_RC_LOOKUP_URL || HV_BASE_URL;

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
  form.append("url", imageUrl);
  form.append("clientId", clientId);

  const res = await fetch(HV_READ_KYC_URL, {
    method: "POST",
    headers: hvHeaders(),
    body: form,
  });

  if (!res.ok) {
    throw new Error(`HyperVerge readKYC failed: ${res.status}`);
  }
  return res.json();
}

async function matchFace(image1, image2, clientId) {
  const form = new FormData();
  form.append("image1", image1);
  form.append("image2", image2);
  form.append("clientId", clientId);

  const res = await fetch(HV_FACE_MATCH_URL, {
    method: "POST",
    headers: hvHeaders(),
    body: form,
  });

  if (!res.ok) {
    throw new Error(`HyperVerge face-match failed: ${res.status}`);
  }
  return normalizeFaceResult(await res.json());
}

async function lookupDlStatus(dlNumber, dob, clientId) {
  const res = await fetch(HV_DL_LOOKUP_URL, {
    method: "POST",
    headers: {
      ...hvHeaders(),
      "content-type": "application/json",
    },
    body: JSON.stringify({
      dlNumber,
      dob: formatDobForHyperVerge(dob),
      clientId,
    }),
  });

  if (!res.ok) {
    throw new Error(`HyperVerge DL lookup failed: ${res.status}`);
  }
  return normalizeDlResult(await res.json());
}

async function lookupRcStatus(registrationNumber, clientId) {
  const res = await fetch(HV_RC_LOOKUP_URL, {
    method: "POST",
    headers: {
      ...hvHeaders(),
      "content-type": "application/json",
    },
    body: JSON.stringify({
      registrationNumber,
      clientId,
    }),
  });

  if (!res.ok) {
    throw new Error(`HyperVerge RC lookup failed: ${res.status}`);
  }
  return normalizeRcResult(await res.json());
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
  let biometricMatch = null;
  let tamperingDetected = false;
  let failureReason = null;

  try {
    const dlOcr = await readDocument(input.dlPhotoUrl, clientId);
    const rcOcr = await readDocument(input.rcPhotoUrl, clientId);

    const dlDetails = extractDocumentDetails(dlOcr);
    const rcDetails = extractDocumentDetails(rcOcr);
    const dlName = firstValue(dlDetails, ["name", "fullName", "holderName"]);
    const dlNumber = firstValue(dlDetails, [
      "dlNumber",
      "dl_number",
      "licenseNumber",
      "licenceNumber",
    ]);
    const rcNumber = firstValue(rcDetails, [
      "registrationNumber",
      "registration_number",
      "rcNumber",
      "vehicleNumber",
    ]);
    const dlTampering = detectTampering(dlOcr);
    const rcTampering = detectTampering(rcOcr);
    tamperingDetected = dlTampering || rcTampering;

    ocrMatch =
      normalizeMatch(dlName, input.driverName) &&
      normalizeMatch(dlNumber, input.dlNumber) &&
      normalizeMatch(rcNumber, input.rcNumber);

    auditRows.push({
      check_type: "ocr_match",
      status: tamperingDetected
        ? "fail"
        : ocrMatch
          ? "pass"
          : "manual_review",
      raw_result: sanitizeRawResult(
        {
          dlOcr,
          rcOcr,
          extracted: { dlName, dlNumber, rcNumber },
          tamperingDetected,
        },
        input,
      ),
      confidence_score: minNumber([
        extractConfidence(dlOcr),
        extractConfidence(rcOcr),
      ]),
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
      raw_result: sanitizeRawResult(dlResult, input),
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
      raw_result: sanitizeRawResult(rcResult, input),
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
    biometricMatch =
      faceResult?.match === true &&
      faceResult?.toReview !== true &&
      biometricScore >= KYC_RULES.MIN_BIOMETRIC_SCORE;
    auditRows.push({
      check_type: "biometric_match",
      status: biometricMatch ? "pass" : "manual_review",
      raw_result: sanitizeRawResult(faceResult, input),
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
    biometricMatch !== true ||
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
  return normalizeComparable(a) === normalizeComparable(b);
}

function normalizeComparable(value) {
  return String(value).trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function formatDobForHyperVerge(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function normalizeFaceResult(raw) {
  const result = raw?.result || {};
  const matchValue = String(result.match || "").toLowerCase();
  return {
    status: normalizeApiStatus(raw),
    match: matchValue === "yes" || matchValue === "true",
    confidence: parseScore(result.matchScore),
    toReview: String(result.toReview || "").toLowerCase() === "yes",
    raw,
  };
}

function normalizeDlResult(raw) {
  const result = raw?.result || {};
  return {
    status: normalizeStatus(result.status),
    name: result.name || null,
    fatherPlaceName: result.fatherPlaceName || null,
    dob: result.dob || null,
    expiryDate: result.expiryDate || null,
    issueDate: result.issueDate || null,
    covDetails: Array.isArray(result.covDetails) ? result.covDetails : [],
    bloodGroup: result.bloodGroup || null,
    apiStatus: normalizeApiStatus(raw),
    raw,
  };
}

function normalizeRcResult(raw) {
  const result = raw?.result || {};
  return {
    status: normalizeStatus(result.status),
    ownerName: result.ownerName || null,
    chassisNumber: result.chassisNumber || null,
    engineNumber: result.engineNumber || null,
    vehicleClass: result.vehicleClass || null,
    fuelType: result.fuelType || null,
    registrationDate: result.registrationDate || null,
    fitnessValidUpTo: result.fitnessValidUpTo || null,
    insuranceValidUpTo: result.insuranceValidUpTo || null,
    pucchValidUpTo: result.pucchValidUpTo || null,
    rcFinancer: result.rcFinancer || null,
    registeredAt: result.registeredAt || null,
    apiStatus: normalizeApiStatus(raw),
    raw,
  };
}

function normalizeApiStatus(raw) {
  return String(raw?.status || "").toLowerCase() === "success" &&
    String(raw?.statusCode || "") === "200"
    ? "success"
    : "failed";
}

function normalizeStatus(value) {
  const status = String(value || "").trim().toLowerCase();
  return status === "active" ? "active" : status || null;
}

function extractDocumentDetails(raw) {
  if (Array.isArray(raw)) {
    return raw.map(extractDocumentDetails).find(Boolean) || {};
  }
  if (!raw || typeof raw !== "object") return {};
  return raw.details || raw.result?.details || raw.result || raw.data || raw;
}

function firstValue(source, keys) {
  for (const key of keys) {
    const value = findValue(source, key);
    if (value !== undefined && value !== null && String(value).trim()) {
      return value;
    }
  }
  return null;
}

function findValue(source, wantedKey) {
  if (!source || typeof source !== "object") return undefined;
  const normalizedWanted = normalizeComparable(wantedKey);
  for (const [key, value] of Object.entries(source)) {
    if (normalizeComparable(key) === normalizedWanted) return value;
    if (value && typeof value === "object") {
      const nested = findValue(value, wantedKey);
      if (nested !== undefined) return nested;
    }
  }
  return undefined;
}

function detectTampering(raw) {
  const value =
    firstValue(raw, [
      "tampered",
      "tamperingDetected",
      "isTampered",
      "fraudDetected",
      "documentTampered",
    ]) ?? false;
  return (
    value === true ||
    ["yes", "true", "detected"].includes(String(value).toLowerCase())
  );
}

function extractConfidence(raw) {
  return parseScore(
    firstValue(raw, [
      "confidence",
      "confidenceScore",
      "ocrConfidence",
      "matchScore",
    ]),
  );
}

function parseScore(value) {
  const number = Number.parseFloat(value);
  return Number.isFinite(number) ? number : null;
}

function minNumber(values) {
  const numbers = values.filter((value) => Number.isFinite(value));
  return numbers.length ? Math.min(...numbers) : null;
}

function sanitizeRawResult(value, input) {
  const aadhaar = String(input?.aadhaarNumberFull || "").replace(/\D/g, "");
  return sanitizeValue(value, aadhaar);
}

function sanitizeValue(value, aadhaar) {
  if (typeof value === "string") {
    let output = value;
    if (aadhaar && output.includes(aadhaar)) {
      output = output.replaceAll(aadhaar, "[REDACTED_AADHAAR]");
    }
    return output.replace(/\b\d{12}\b/g, "[REDACTED_12_DIGIT_ID]");
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, aadhaar));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [
        key,
        sanitizeValue(nested, aadhaar),
      ]),
    );
  }
  return value;
}
