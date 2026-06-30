import crypto from "node:crypto";

const RAZORPAY_API_BASE = "https://api.razorpay.com/v1";

function getRazorpayConfig() {
  const {
    RAZORPAY_KEY_ID,
    RAZORPAY_KEY_SECRET,
    RAZORPAY_WEBHOOK_SECRET,
    RAZORPAY_PLAN_STARTER,
    RAZORPAY_PLAN_ACTIVE,
    RAZORPAY_PLAN_PRO,
  } = process.env;

  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) return null;

  return {
    keyId: RAZORPAY_KEY_ID,
    keySecret: RAZORPAY_KEY_SECRET,
    webhookSecret: RAZORPAY_WEBHOOK_SECRET || "",
    plans: {
      starter: RAZORPAY_PLAN_STARTER,
      active: RAZORPAY_PLAN_ACTIVE,
      pro: RAZORPAY_PLAN_PRO,
    },
  };
}

export function isRazorpayConfigured() {
  return Boolean(getRazorpayConfig());
}

function authHeader(config) {
  return `Basic ${Buffer.from(`${config.keyId}:${config.keySecret}`).toString("base64")}`;
}

async function razorpayRequest(path, { method = "GET", body } = {}) {
  const config = getRazorpayConfig();
  if (!config) {
    const error = new Error("Razorpay is not configured");
    error.code = "RAZORPAY_NOT_CONFIGURED";
    throw error;
  }

  const response = await fetch(`${RAZORPAY_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: authHeader(config),
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error?.description || "Razorpay request failed");
    error.code = "RAZORPAY_REQUEST_FAILED";
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

export async function createCustomer(driverProfile) {
  return razorpayRequest("/customers", {
    method: "POST",
    body: {
      name: driverProfile.name || "TukTukGo Driver",
      email: driverProfile.email || undefined,
      contact: driverProfile.phone || undefined,
      notes: { driver_id: driverProfile.driverId },
    },
  });
}

export async function createSubscription(driverId, planKey, customerId, options = {}) {
  const config = getRazorpayConfig();
  if (!config) {
    const error = new Error("Razorpay is not configured");
    error.code = "RAZORPAY_NOT_CONFIGURED";
    throw error;
  }
  const planId = config.plans[planKey];
  if (!planId) {
    const error = new Error("Subscription plan is not configured");
    error.code = "RAZORPAY_PLAN_NOT_CONFIGURED";
    throw error;
  }

  return razorpayRequest("/subscriptions", {
    method: "POST",
    body: {
      plan_id: planId,
      total_count: 12,
      customer_notify: 1,
      customer_id: customerId || undefined,
      start_at: options.startAt
        ? Math.floor(new Date(options.startAt).getTime() / 1000)
        : undefined,
      notes: { driver_id: driverId, plan: planKey },
    },
  });
}

export async function cancelSubscription(subscriptionId) {
  return razorpayRequest(`/subscriptions/${subscriptionId}/cancel`, {
    method: "POST",
    body: { cancel_at_cycle_end: true },
  });
}

export async function generatePaymentLink(driverId, amount, reason) {
  const expireBy = Math.floor(Date.now() / 1000) + 72 * 60 * 60;
  return razorpayRequest("/payment_links", {
    method: "POST",
    body: {
      amount: Math.max(1, Math.round(Number(amount) || 0)) * 100,
      currency: "INR",
      description: reason || "TukTukGo driver subscription renewal",
      expire_by: expireBy,
      notes: { driver_id: driverId, reason: reason || "subscription_fallback" },
    },
  });
}

export async function createOrder({ amountPaise, receipt, notes = {} }) {
  return razorpayRequest("/orders", {
    method: "POST",
    body: {
      amount: Math.max(100, Math.round(Number(amountPaise) || 0)),
      currency: "INR",
      receipt: String(receipt).slice(0, 40),
      notes,
    },
  });
}

export function verifyPaymentSignature({ orderId, paymentId, signature }) {
  const config = getRazorpayConfig();
  if (!config || !orderId || !paymentId || !signature) return false;
  const expected = crypto
    .createHmac("sha256", config.keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  if (expected.length !== signature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export function verifyRazorpayWebhook(rawBody, signature) {
  const config = getRazorpayConfig();
  if (!config?.webhookSecret) return false;
  const expected = crypto
    .createHmac("sha256", config.webhookSecret)
    .update(rawBody)
    .digest("hex");
  const received = signature || "";
  if (received.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}
