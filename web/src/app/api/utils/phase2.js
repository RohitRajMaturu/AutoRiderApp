import { isLatitude, isLongitude } from "@/app/api/utils/validation";

export const VALID_DAYS = new Set(["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]);
export const VALID_SHIFTS = new Set(["MORNING", "EVENING", "BOTH", "ANY"]);

export function readDays(value) {
  if (!Array.isArray(value)) return null;
  const days = [...new Set(value.map((day) => String(day).toUpperCase()))];
  return days.length >= 1 && days.length <= 7 && days.every((day) => VALID_DAYS.has(day))
    ? days
    : null;
}

export function readTime(value) {
  if (typeof value !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  return value;
}

export function readCoordinate(value) {
  const rawLat = value?.lat ?? value?.latitude;
  const rawLng = value?.lng ?? value?.longitude;
  if (rawLat === null || rawLat === undefined || rawLat === "" || rawLng === null || rawLng === undefined || rawLng === "") return null;
  const lat = Number(rawLat);
  const lng = Number(rawLng);
  // Map providers may return addresses longer than the varchar(200) storage
  // column. Truncate the display label instead of discarding valid coordinates.
  const label = String(value?.label || value?.address || "").trim().slice(0, 200);
  return isLatitude(lat) && isLongitude(lng) && label ? { lat, lng, label } : null;
}

export function countScheduledRides(startDate, endDate, scheduledDays) {
  const dayKeys = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const wanted = new Set(scheduledDays);
  let count = 0;
  const cursor = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  while (cursor <= end) {
    if (wanted.has(dayKeys[cursor.getUTCDay()])) count += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}

export function calculatePassFare({ estimatedFareRupees, rideCount, renewal = false }) {
  const marketPerRide = Math.max(1, Math.round(Number(estimatedFareRupees)));
  const baseDiscount = 0.15;
  const loyaltyDiscount = renewal ? 0.05 : 0;
  const perRideFare = Math.round(marketPerRide * (1 - baseDiscount - loyaltyDiscount));
  const agreedFare = perRideFare * rideCount;
  const platformFee = Math.round(agreedFare * 0.1);
  const driverPayout = agreedFare - platformFee;
  return {
    marketPerRide,
    perRideFare,
    agreedFare,
    platformFee,
    driverPayout,
  };
}

export function haversineMeters(lat1, lng1, lat2, lng2) {
  const values = [lat1, lng1, lat2, lng2].map(Number);
  if (!values.every(Number.isFinite)) return NaN;
  const [aLat, aLng, bLat, bLng] = values;
  const radius = 6371000;
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const deltaLat = toRadians(bLat - aLat);
  const deltaLng = toRadians(bLng - aLng);
  const value = Math.sin(deltaLat / 2) ** 2
    + Math.cos(toRadians(aLat)) * Math.cos(toRadians(bLat)) * Math.sin(deltaLng / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

export function addDays(dateValue, days) {
  const date = new Date(`${dateValue}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function phase2Error(error, fallback = "Phase 2 request failed") {
  return Response.json(
    { error: error?.message || fallback, code: error?.code || "PHASE2_REQUEST_FAILED" },
    { status: error?.status || 500 },
  );
}
