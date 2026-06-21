import { isKycVendorConfigured, KYC_VENDOR } from "./config";
import { verifyWithHyperVerge } from "./adapters/hyperverge";

const ADAPTERS = {
  hyperverge: verifyWithHyperVerge,
};

/**
 * @param {object} input
 * @param {string} input.driverId
 * @param {string} input.driverName
 * @param {string} input.dob
 * @param {string} input.dlNumber
 * @param {string} input.rcNumber
 * @param {string} input.dlPhotoUrl
 * @param {string} input.rcPhotoUrl
 * @param {string} input.selfieUrl
 * @param {string} input.aadhaarNumberFull
 * @returns {Promise<import("./contract").KycResult>}
 */
export async function verifyDriver(input) {
  const adapter = ADAPTERS[KYC_VENDOR];
  if (!adapter) {
    throw new Error(`No KYC adapter registered for vendor: ${KYC_VENDOR}`);
  }
  if (!isKycVendorConfigured(KYC_VENDOR)) {
    return {
      verification_status: "PENDING_MANUAL_REVIEW",
      checks: {
        ocr_match: null,
        dl_active: null,
        rc_active: null,
        biometric_match_score: null,
      },
      failure_reason: null,
      audit_rows: [
        {
          check_type: "vendor_configuration",
          status: "not_configured",
          raw_result: {
            vendor: KYC_VENDOR,
            reason: "KYC vendor credentials are not configured",
          },
          confidence_score: null,
        },
      ],
    };
  }
  return adapter(input);
}
