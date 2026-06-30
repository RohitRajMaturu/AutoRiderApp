import { isLatitude, isLongitude, readBoundedString } from "@/app/api/utils/validation";

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
  const lat = Number(value?.lat);
  const lng = Number(value?.lng);
  const label = readBoundedString(value?.label, { min: 3, max: 200 });
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
  const marketPerRidePaise = Math.max(100, Math.round(Number(estimatedFareRupees) * 100));
  const baseDiscount = 0.15;
  const loyaltyDiscount = renewal ? 0.05 : 0;
  const perRideFarePaise = Math.round(marketPerRidePaise * (1 - baseDiscount - loyaltyDiscount));
  const agreedFarePaise = perRideFarePaise * rideCount;
  const platformFeePaise = Math.round(agreedFarePaise * 0.1);
  const driverPayoutPaise = agreedFarePaise - platformFeePaise;
  return {
    marketPerRidePaise,
    perRideFarePaise,
    agreedFarePaise,
    platformFeePaise,
    driverPayoutPaise,
  };
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
