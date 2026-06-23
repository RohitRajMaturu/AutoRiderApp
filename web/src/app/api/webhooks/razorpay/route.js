import sql from "@/app/api/utils/sql";
import {
  generatePaymentLink,
  verifyRazorpayWebhook,
} from "@/app/api/utils/payments/razorpayService";
import { writeOperationalEvent } from "@/app/api/utils/observability";

function readDriverId(payload) {
  return (
    payload?.payload?.subscription?.entity?.notes?.driver_id ||
    payload?.payload?.payment?.entity?.notes?.driver_id ||
    payload?.payload?.payment_link?.entity?.notes?.driver_id ||
    null
  );
}

function readSubscription(payload) {
  return payload?.payload?.subscription?.entity || null;
}

export async function POST(request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");
  if (!verifyRazorpayWebhook(rawBody, signature)) {
    return Response.json({ error: "Invalid webhook signature" }, { status: 401 });
  }

  try {
    const payload = JSON.parse(rawBody);
    const eventType = payload.event;
    const driverId = readDriverId(payload);
    const subscription = readSubscription(payload);
    const eventId = payload.id || null;

    await sql.transaction(async (tx) => {
      await tx`
        INSERT INTO subscription_events (
          driver_id,
          event_type,
          razorpay_event_id,
          razorpay_payload
        )
        VALUES (${driverId}, ${eventType}, ${eventId}, ${JSON.stringify(payload)}::jsonb)
        ON CONFLICT (razorpay_event_id) WHERE razorpay_event_id IS NOT NULL DO NOTHING
      `;

      if (!driverId) return;
      if (eventType === "subscription.charged") {
        const nextRenewalAt = subscription?.current_end
          ? new Date(subscription.current_end * 1000).toISOString()
          : null;
        await tx`
          UPDATE drivers
          SET subscription_status = 'active',
              mandate_status = COALESCE(mandate_status, 'confirmed'),
              subscription_failure_count = 0,
              next_renewal_at = COALESCE(${nextRenewalAt}, next_renewal_at),
              subscription_expiry = COALESCE(${nextRenewalAt}, subscription_expiry),
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ${driverId}
        `;
      } else if (eventType === "subscription.halted") {
        await tx`
          UPDATE drivers
          SET subscription_status = 'halted',
              subscription_halted_at = COALESCE(subscription_halted_at, CURRENT_TIMESTAMP),
              subscription_failure_count = subscription_failure_count + 1,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ${driverId}
        `;
      } else if (eventType === "subscription.cancelled") {
        await tx`
          UPDATE drivers
          SET subscription_status = 'cancelled',
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ${driverId}
        `;
      } else if (eventType === "subscription.completed") {
        await tx`
          UPDATE drivers
          SET subscription_status = 'expired',
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ${driverId}
        `;
      } else if (eventType === "payment.failed") {
        await tx`
          UPDATE drivers
          SET subscription_failure_count = subscription_failure_count + 1,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ${driverId}
        `;
      } else if (eventType === "mandate.confirmed") {
        await tx`
          UPDATE drivers
          SET mandate_status = 'confirmed',
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ${driverId}
        `;
      }
    });

    if (eventType === "subscription.halted" && driverId) {
      try {
        const link = await generatePaymentLink(
          driverId,
          399,
          "TukTukGo subscription fallback payment",
        );
        await sql`
          UPDATE drivers
          SET manual_payment_link = ${link.short_url || null},
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ${driverId}
        `;
      } catch (error) {
        await writeOperationalEvent({
          eventType: "subscription_fallback_link_failed",
          targetType: "driver",
          targetId: driverId,
          severity: "warn",
          metadata: { message: error.message },
        });
      }
    }

    return Response.json({ received: true });
  } catch (err) {
    console.error("POST /api/webhooks/razorpay error:", err);
    return Response.json({ error: "Webhook processing failed" }, { status: 400 });
  }
}
