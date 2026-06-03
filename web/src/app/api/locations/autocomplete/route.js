import {
  getAutocomplete,
  getOptionalNumber,
} from "@/app/api/utils/locations";
import {
  isCoordinatePair,
  readBoundedString,
} from "@/app/api/utils/validation";

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const q = readBoundedString(url.searchParams.get("q"), { min: 2, max: 120 });
    const lat = getOptionalNumber(url.searchParams, "lat");
    const lng = getOptionalNumber(url.searchParams, "lng");
    const hasAnyBiasCoordinate = lat !== null || lng !== null;

    if (!q) {
      return Response.json({ suggestions: [], provider: "none" });
    }

    if (hasAnyBiasCoordinate && !isCoordinatePair(lat, lng)) {
      return Response.json(
        { error: "lat and lng must be a valid coordinate pair" },
        { status: 400 },
      );
    }

    const result = await getAutocomplete(q, { lat, lng });
    return Response.json(result);
  } catch (err) {
    console.error("GET /api/locations/autocomplete error:", err);
    return Response.json(
      { error: "Failed to fetch locations" },
      { status: 500 },
    );
  }
}
