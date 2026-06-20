import { KYC_VENDOR } from "./config";
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
  return adapter(input);
}
