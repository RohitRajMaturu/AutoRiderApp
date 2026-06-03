import { getPlaceDetails } from "@/app/api/utils/locations";
import { readBoundedString } from "@/app/api/utils/validation";

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const placeId = readBoundedString(
      url.searchParams.get("placeId") || url.searchParams.get("place_id"),
      { min: 1, max: 255 },
    );

    if (!placeId) {
      return Response.json(
        { error: "Missing placeId" },
        { status: 400 },
      );
    }

    const place = await getPlaceDetails(placeId);
    if (!place) {
      return Response.json({ error: "Place not found" }, { status: 404 });
    }

    return Response.json({ place });
  } catch (err) {
    console.error("GET /api/locations/place error:", err);
    return Response.json(
      { error: "Failed to fetch place details" },
      { status: 500 },
    );
  }
}
