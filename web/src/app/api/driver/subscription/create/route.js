import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";
import {
  createCustomer,
  createSubscription,
} from "@/app/api/utils/payments/razorpayService";

const PLAN_KEYS = new Set(["starter", "active", "pro"]);

export async function POST(request) {
  try {
    const session = await auth(request);
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await request.json().catch(() => ({}));
    const planKey = PLAN_KEYS.has(body.planKey) ? body.planKey : "starter";

    const rows = await sql`
      SELECT d.id, d.razorpay_customer_id, u.name, u.email, u.phone
      FROM drivers d
      JOIN auth_users u ON u.id = d.user_id
      WHERE d.user_id = ${session.user.id}
      LIMIT 1
    `;
    const driver = rows[0];
    if (!driver) {
      return Response.json({ error: "Driver profile not found" }, { status: 404 });
    }

    let customerId = driver.razorpay_customer_id;
    if (!customerId) {
      const customer = await createCustomer({
        driverId: driver.id,
        name: driver.name,
        email: driver.email,
        phone: driver.phone,
      });
      customerId = customer.id;
      await sql`
        UPDATE drivers
        SET razorpay_customer_id = ${customerId},
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${driver.id}
      `;
    }

    const subscription = await createSubscription(driver.id, planKey, customerId);
    const nextRenewalAt = subscription.current_end
      ? new Date(subscription.current_end * 1000).toISOString()
      : null;
    await sql`
      UPDATE drivers
      SET subscription_plan = ${planKey},
          subscription_status = 'trial',
          mandate_status = 'pending',
          razorpay_subscription_id = ${subscription.id},
          next_renewal_at = ${nextRenewalAt},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${driver.id}
    `;

    return Response.json({
      subscription: {
        id: subscription.id,
        status: subscription.status,
        shortUrl: subscription.short_url || null,
      },
    });
  } catch (err) {
    if (err.code === "RAZORPAY_NOT_CONFIGURED" || err.code === "RAZORPAY_PLAN_NOT_CONFIGURED") {
      return Response.json(
        { error: err.message, code: err.code },
        { status: 503 },
      );
    }
    console.error("POST /api/driver/subscription/create error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
