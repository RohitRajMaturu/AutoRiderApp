import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";
import {
  cancelSubscription,
  createCustomer,
  createSubscription,
} from "@/app/api/utils/payments/razorpayService";

const PLAN_KEYS = new Set(["starter", "active", "pro"]);

function isActivePeriod(driver) {
  const expiry = driver.next_renewal_at || driver.subscription_expiry || driver.trial_ends_at;
  return expiry && new Date(expiry) > new Date();
}

function currentPeriodEnd(driver) {
  return driver.next_renewal_at || driver.subscription_expiry || driver.trial_ends_at || null;
}

async function ensureCustomer(driver) {
  if (driver.razorpay_customer_id) return driver.razorpay_customer_id;
  const customer = await createCustomer({
    driverId: driver.id,
    name: driver.name,
    email: driver.email,
    phone: driver.phone,
  });
  await sql`
    UPDATE drivers
    SET razorpay_customer_id = ${customer.id},
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ${driver.id}
  `;
  return customer.id;
}

export async function POST(request) {
  try {
    const session = await auth(request);
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const planKey = PLAN_KEYS.has(body.planKey) ? body.planKey : null;
    if (!planKey) {
      return Response.json({ error: "Valid planKey is required" }, { status: 400 });
    }

    const rows = await sql`
      SELECT
        d.id,
        d.razorpay_customer_id,
        d.razorpay_subscription_id,
        d.subscription_plan,
        d.subscription_expiry,
        d.next_renewal_at,
        d.trial_ends_at,
        d.queued_razorpay_subscription_id,
        u.name,
        u.email,
        u.phone
      FROM drivers d
      JOIN auth_users u ON u.id = d.user_id
      WHERE d.user_id = ${session.user.id}
      LIMIT 1
    `;
    const driver = rows[0];
    if (!driver) {
      return Response.json({ error: "Driver profile not found" }, { status: 404 });
    }

    const startsAt = currentPeriodEnd(driver);
    const hasActivePeriod = isActivePeriod(driver);
    const customerId = await ensureCustomer(driver);

    if (hasActivePeriod) {
      if (driver.queued_razorpay_subscription_id) {
        await cancelSubscription(driver.queued_razorpay_subscription_id);
      }
      if (!driver.queued_razorpay_subscription_id && driver.razorpay_subscription_id) {
        await cancelSubscription(driver.razorpay_subscription_id);
      }
      const subscription = await createSubscription(driver.id, planKey, customerId, {
        startAt: startsAt,
      });
      await sql`
        UPDATE drivers
        SET queued_subscription_plan = ${planKey},
            queued_subscription_starts_at = ${startsAt},
            queued_subscription_requested_at = CURRENT_TIMESTAMP,
            queued_razorpay_subscription_id = ${subscription.id},
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${driver.id}
      `;
      return Response.json({
        mode: "queued",
        subscription: {
          id: subscription.id,
          status: subscription.status,
          shortUrl: subscription.short_url || null,
          plan: planKey,
          startsAt,
        },
      });
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
          queued_subscription_plan = NULL,
          queued_subscription_starts_at = NULL,
          queued_subscription_requested_at = NULL,
          queued_razorpay_subscription_id = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${driver.id}
    `;

    return Response.json({
      mode: "immediate",
      subscription: {
        id: subscription.id,
        status: subscription.status,
        shortUrl: subscription.short_url || null,
        plan: planKey,
      },
    });
  } catch (err) {
    if (err.code === "RAZORPAY_NOT_CONFIGURED" || err.code === "RAZORPAY_PLAN_NOT_CONFIGURED") {
      return Response.json({ error: err.message, code: err.code }, { status: 503 });
    }
    console.error("POST /api/driver/subscription/change error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
