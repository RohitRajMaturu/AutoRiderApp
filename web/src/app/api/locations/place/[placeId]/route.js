import { getPlaceDetails } from "@/app/api/utils/locations";

export async function GET(_request, { params }) {
  try {
    const place = await getPlaceDetails(params.placeId);
    if (!place) {
      return Response.json({ error: "Place not found" }, { status: 404 });
    }
    return Response.json({ place });
  } catch (err) {
    console.error("GET /api/locations/place/:placeId error:", err);
    return Response.json({ error: "Failed to fetch place details" }, { status: 500 });
  }
}
