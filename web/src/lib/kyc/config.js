// Change this value to swap KYC vendors after adding a matching adapter.
export const KYC_VENDOR = "hyperverge";

export const VENDOR_ENV_KEYS = {
  hyperverge: {
    appId: "HYPERVERGE_APP_ID",
    appKey: "HYPERVERGE_APP_KEY",
  },
};

export function isKycVendorConfigured(vendor = KYC_VENDOR) {
  const keys = VENDOR_ENV_KEYS[vendor];
  if (!keys) return false;
  return Object.values(keys).every((key) => Boolean(process.env[key]));
}
