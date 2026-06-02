import { getRequiredNumber, getRouteEstimate } from "@/app/api/utils/locations";

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const pickupLat = getRequiredNumber(url.searchParams, "pickupLat");
    const pickupLng = getRequiredNumber(url.searchParams, "pickupLng");
    const destLat = getRequiredNumber(url.searchParams, "destLat");
    const destLng = getRequiredNumber(url.searchParams, "destLng");

    const estimate = await getRouteEstimate(
      pickupLat,
      pickupLng,
      destLat,
      destLng,
    );

    return Response.json({
      distanceKm: estimate.distanceKm,
      durationMins: estimate.durationMins,
      estimatedFare: estimate.estimatedFare,
      polyline: estimate.polyline,
      provider: estimate.provider,
      currency: "INR",
    });
  } catch (err) {
    console.error("GET /api/routes/estimate error:", err);
    return Response.json(
      { error: err.message || "Failed to estimate route" },
      { status: 400 },
    );
  }
}
