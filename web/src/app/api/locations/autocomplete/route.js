import {
  autocompleteLocations,
  getOptionalNumber,
} from "@/app/api/utils/locations";

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const q = url.searchParams.get("q") || "";
    const lat = getOptionalNumber(url.searchParams, "lat");
    const lng = getOptionalNumber(url.searchParams, "lng");

    const result = await autocompleteLocations({ query: q, lat, lng });
    return Response.json(result);
  } catch (err) {
    console.error("GET /api/locations/autocomplete error:", err);
    return Response.json({ error: "Failed to fetch locations" }, { status: 500 });
  }
}
