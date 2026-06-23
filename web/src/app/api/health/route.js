import sql from "@/app/api/utils/sql";
import { isExotelConfigured } from "@/app/api/utils/exotelService";
import { isRazorpayConfigured } from "@/app/api/utils/payments/razorpayService";

function pusherStatus() {
  const { PUSHER_APP_ID, PUSHER_KEY, PUSHER_SECRET, PUSHER_CLUSTER } = process.env;
  return PUSHER_APP_ID && PUSHER_KEY && PUSHER_SECRET && PUSHER_CLUSTER
    ? "configured"
    : "not_configured";
}

export async function GET() {
  const status = {
    status: "ok",
    db: "connected",
    pusher: pusherStatus(),
    exotel: isExotelConfigured() ? "configured" : "not_configured",
    razorpay: isRazorpayConfigured() ? "configured" : "not_configured",
    timestamp: new Date().toISOString(),
  };

  try {
    await sql`SELECT 1 AS ok`;
  } catch {
    status.status = "error";
    status.db = "disconnected";
  }

  return Response.json(status, { status: status.status === "ok" ? 200 : 503 });
}
