/**
 * Vendor-agnostic KYC verification result. Every adapter must return this
 * shape, so app code never depends on vendor response fields directly.
 *
 * @typedef {Object} KycResult
 * @property {'APPROVED'|'REJECTED'|'PENDING_MANUAL_REVIEW'} verification_status
 * @property {Object} checks
 * @property {boolean|null} checks.ocr_match
 * @property {boolean|null} checks.dl_active
 * @property {boolean|null} checks.rc_active
 * @property {number|null} checks.biometric_match_score
 * @property {string|null} failure_reason
 * @property {Array<{check_type: string, status: string, raw_result: object, confidence_score: number|null}>} audit_rows
 */

export const KYC_RULES = {
  MIN_BIOMETRIC_SCORE: 90,
  AUTO_REJECT_ON_TAMPERING: true,
};
