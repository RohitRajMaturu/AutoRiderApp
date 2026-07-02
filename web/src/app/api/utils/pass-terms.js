import sql from "@/app/api/utils/sql";

export const PASS_TERMS_VERSION = "2026-07-02-v1";

export const PASS_TERMS_SECTIONS = [
  {
    title: "Recurring service and driver matching",
    body: "A TukTukPass requests recurring rides for the route, days, and time you select. Service starts only after payment and successful driver matching. The assigned driver may change, and an available backup driver may be used after a driver no-show.",
  },
  {
    title: "Schedule conflicts and ride priority",
    body: "You cannot create passes with overlapping travel days and pickup times. Drivers cannot accept overlapping institution or passenger-pass schedules. During an active recurring ride, that committed ride takes priority over standalone ride requests.",
  },
  {
    title: "Fare and payment",
    body: "Review the pass total, estimated ride count, platform fee, and payment details before paying. Driver matching begins only after payment is confirmed. Provider outages may delay payment activation without changing the pass request you reviewed.",
  },
  {
    title: "Cancellation and refunds",
    body: "Before cancellation, we show the pass amount, amount paid, applicable deduction, and exact refund. A cancellation at least 3 days before the pass starts receives a full refund; otherwise the current policy provides a 50% refund. A pass cannot be cancelled while one of its rides is in progress. Future pending rides are cancelled after confirmation. Refund processing time depends on the payment provider and bank.",
  },
  {
    title: "Pauses, expiry, and renewal",
    body: "A paused pass does not create service outside its allowed pause period and resumes on the shown date. Passes expire on their end date unless renewed. We may send renewal and expiry reminders, but you remain responsible for reviewing the pass status in the app.",
  },
  {
    title: "No-shows and individual ride refunds",
    body: "If the assigned driver does not arrive, we may activate an available, conflict-free backup driver. If no backup is available, the affected ride is marked for refund. Passenger no-shows and late cancellations may be handled separately under the displayed ride policy.",
  },
  {
    title: "Pickup details, safety, and notifications",
    body: "Use accurate searchable pickup and destination locations and keep your phone reachable. Verify the vehicle and driver shown in the app, and share the ride OTP only with the assigned driver. Service, safety, payment, cancellation, and schedule notifications may be sent to your registered device or contact details.",
  },
  {
    title: "Your acknowledgement",
    body: "By accepting, you confirm that the route and schedule are accurate, that you understand the payment and refund rules above, and that TukTukGo may store this consent with its terms version and link it to the pass created from it.",
  },
];

export async function getPassTermsStatus(passengerId, scopedSql = sql) {
  const rows = await scopedSql`
    SELECT
      EXISTS(
        SELECT 1 FROM commuter_passes
        WHERE passenger_id = ${passengerId}
          AND status IN ('PENDING_MATCH', 'ACTIVE', 'PAUSED')
          AND end_date >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date
      ) AS has_current_pass,
      (
        SELECT id FROM pass_terms_consents
        WHERE passenger_id = ${passengerId}
          AND terms_version = ${PASS_TERMS_VERSION}
          AND pass_id IS NULL
          AND consumed_at IS NULL
        ORDER BY accepted_at DESC
        LIMIT 1
      ) AS consent_id
  `;
  const status = rows[0] || {};
  return {
    required: !status.has_current_pass && !status.consent_id,
    hasCurrentPass: Boolean(status.has_current_pass),
    consentId: status.consent_id || null,
    version: PASS_TERMS_VERSION,
    sections: PASS_TERMS_SECTIONS,
  };
}

export async function acceptPassTerms(passengerId, userAgent = "") {
  return sql.transaction(async (tx) => {
    await tx`SELECT id FROM auth_users WHERE id = ${passengerId} FOR UPDATE`;
    const existing = await tx`
      SELECT id, accepted_at FROM pass_terms_consents
      WHERE passenger_id = ${passengerId}
        AND terms_version = ${PASS_TERMS_VERSION}
        AND pass_id IS NULL
        AND consumed_at IS NULL
      LIMIT 1
    `;
    if (existing[0]) return existing[0];
    const rows = await tx`
      INSERT INTO pass_terms_consents (
        passenger_id, terms_version, accepted_user_agent
      ) VALUES (
        ${passengerId}, ${PASS_TERMS_VERSION}, ${String(userAgent || "").slice(0, 500) || null}
      )
      RETURNING id, accepted_at
    `;
    return rows[0];
  });
}
