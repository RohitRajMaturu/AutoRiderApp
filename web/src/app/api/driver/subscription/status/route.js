import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";
import { isRazorpayConfigured } from "@/app/api/utils/payments/razorpayService";

function deriveStatus(driver) {
  if (!driver) return null;
  if (driver.subscription_status && driver.subscription_status !== "trial") {
    return driver.subscription_status;
  }
  const expiry = driver.next_renewal_at || driver.subscription_expiry || driver.trial_ends_at;
  if (expiry && new Date(expiry) > new Date()) return "active";
  return driver.subscription_status || "trial";
}

export async function GET(request) {
  try {
    const session = await auth(request);
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const rows = await sql`
      SELECT
        id,
        subscription_expiry,
        subscription_plan,
        subscription_status,
        mandate_status,
        next_renewal_at,
        trial_ends_at,
        subscription_halted_at,
        subscription_failure_count,
        manual_payment_link,
        razorpay_subscription_id
      FROM drivers
      WHERE user_id = ${session.user.id}
      LIMIT 1
    `;
    const driver = rows[0];
    if (!driver) {
      return Response.json({ error: "Driver profile not found" }, { status: 404 });
    }
    return Response.json({
      provider: "razorpay",
      providerConfigured: isRazorpayConfigured(),
      subscription: {
        plan: driver.subscription_plan || "starter",
        status: deriveStatus(driver),
        mandateStatus: driver.mandate_status || null,
        nextRenewalAt: driver.next_renewal_at || driver.subscription_expiry || null,
        trialEndsAt: driver.trial_ends_at || null,
        haltedAt: driver.subscription_halted_at || null,
        failureCount: driver.subscription_failure_count || 0,
        manualPaymentLink: driver.manual_payment_link || null,
        subscriptionId: driver.razorpay_subscription_id || null,
      },
    });
  } catch (err) {
    console.error("GET /api/driver/subscription/status error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
