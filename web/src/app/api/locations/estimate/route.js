import {
  estimateRoute,
  getRequiredNumber,
} from "@/app/api/utils/locations";
import { isCoordinatePair } from "@/app/api/utils/validation";

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const pickupLat = getRequiredNumber(url.searchParams, "pickup_lat");
    const pickupLng = getRequiredNumber(url.searchParams, "pickup_lng");
    const destLat = getRequiredNumber(url.searchParams, "dest_lat");
    const destLng = getRequiredNumber(url.searchParams, "dest_lng");

    if (
      !isCoordinatePair(pickupLat, pickupLng) ||
      !isCoordinatePair(destLat, destLng)
    ) {
      return Response.json(
        { error: "Pickup and destination coordinates must be valid" },
        { status: 400 },
      );
    }

    const estimate = await estimateRoute({
      pickupLat,
      pickupLng,
      destLat,
      destLng,
    });

    return Response.json(estimate);
  } catch (err) {
    console.error("GET /api/locations/estimate error:", err);
    return Response.json(
      { error: err.message || "Failed to estimate route" },
      { status: 400 },
    );
  }
}
