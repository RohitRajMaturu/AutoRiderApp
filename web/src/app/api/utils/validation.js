export function getNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function isLatitude(value) {
  return Number.isFinite(value) && value >= -90 && value <= 90;
}

export function isLongitude(value) {
  return Number.isFinite(value) && value >= -180 && value <= 180;
}

export function isCoordinatePair(lat, lng) {
  return isLatitude(lat) && isLongitude(lng);
}

export function readBoundedString(value, { min = 0, max = 255 } = {}) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) return null;
  return trimmed;
}

export function getEnvNumber(name, fallback, { min = -Infinity, max = Infinity } = {}) {
  const value = getNumber(process.env[name]);
  if (value === null || value < min || value > max) return fallback;
  return value;
}
