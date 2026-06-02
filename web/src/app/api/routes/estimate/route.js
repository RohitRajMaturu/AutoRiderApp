import { estimateRoute, getRequiredNumber } from "@/app/api/utils/locations";

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const pickupLat = getRequiredNumber(url.searchParams, "pickupLat");
    const pickupLng = getRequiredNumber(url.searchParams, "pickupLng");
    const destLat = getRequiredNumber(url.searchParams, "destLat");
    const destLng = getRequiredNumber(url.searchParams, "destLng");

    const estimate = await estimateRoute({
      pickupLat,
      pickupLng,
      destLat,
      destLng,
    });
    if (!estimate) {
      return Response.json({ error: "Route not found" }, { status: 404 });
    }
    return Response.json({ estimate });
  } catch (err) {
    console.error("GET /api/routes/estimate error:", err);
    return Response.json({ error: err.message || "Failed to estimate route" }, { status: 400 });
  }
}
