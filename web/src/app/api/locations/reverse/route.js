import {
  getReverseGeocode,
  getRequiredNumber,
} from "@/app/api/utils/locations";

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const lat = getRequiredNumber(url.searchParams, "lat");
    const lng = getRequiredNumber(url.searchParams, "lng");

    const result = await getReverseGeocode(lat, lng);
    return Response.json(result);
  } catch (err) {
    console.error("GET /api/locations/reverse error:", err);
    return Response.json(
      { error: err.message || "Failed to reverse geocode" },
      { status: 400 },
    );
  }
}
