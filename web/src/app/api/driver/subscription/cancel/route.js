import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";
import { cancelSubscription } from "@/app/api/utils/payments/razorpayService";

export async function POST(request) {
  try {
    const session = await auth(request);
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const rows = await sql`
      SELECT id, razorpay_subscription_id
      FROM drivers
      WHERE user_id = ${session.user.id}
      LIMIT 1
    `;
    const driver = rows[0];
    if (!driver) {
      return Response.json({ error: "Driver profile not found" }, { status: 404 });
    }
    if (!driver.razorpay_subscription_id) {
      return Response.json(
        { error: "No active Razorpay subscription found", code: "SUBSCRIPTION_NOT_FOUND" },
        { status: 409 },
      );
    }
    const subscription = await cancelSubscription(driver.razorpay_subscription_id);
    await sql`
      UPDATE drivers
      SET subscription_status = 'cancelled',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${driver.id}
    `;
    return Response.json({ subscription });
  } catch (err) {
    if (err.code === "RAZORPAY_NOT_CONFIGURED") {
      return Response.json({ error: err.message, code: err.code }, { status: 503 });
    }
    console.error("POST /api/driver/subscription/cancel error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
