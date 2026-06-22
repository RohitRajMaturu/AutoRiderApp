# Pending Tasks

This list separates tasks by why they are pending, so it is clear what can be
done by code, what needs credentials, and what needs real devices or business
decisions.

## Configuration Required

- Set production Pusher values:
  - `PUSHER_APP_ID`
  - `PUSHER_KEY`
  - `PUSHER_SECRET`
  - `PUSHER_CLUSTER=ap2`
  - `EXPO_PUBLIC_PUSHER_KEY`
  - `EXPO_PUBLIC_PUSHER_CLUSTER=ap2`
- Set production notification retention values if defaults are not acceptable:
  - `OPERATIONAL_EVENT_RETENTION_DAYS`
  - `INACTIVE_PUSH_TOKEN_RETENTION_DAYS`
- Configure production private upload storage:
  - `UPLOAD_STORAGE_PROVIDER=r2` or `s3`
  - `UPLOAD_S3_ENDPOINT`
  - `UPLOAD_S3_BUCKET`
  - `UPLOAD_S3_REGION`
  - `UPLOAD_S3_ACCESS_KEY_ID`
  - `UPLOAD_S3_SECRET_ACCESS_KEY`
  - `UPLOAD_PUBLIC_BASE_URL` if needed by the chosen storage/CDN setup.
- Configure production observability destinations once selected:
  - error tracking DSN
  - metrics endpoint
  - log shipping endpoint
  - alert recipients.

## External Dependencies

- Pusher Channels account/app in region `ap2`.
- HyperVerge live/sandbox credentials and confirmed endpoint paths:
  - `HYPERVERGE_APP_ID`
  - `HYPERVERGE_APP_KEY`
  - `HYPERVERGE_READ_KYC_URL`
  - `HYPERVERGE_FACE_MATCH_URL`
  - `HYPERVERGE_DL_LOOKUP_URL`
  - `HYPERVERGE_RC_LOOKUP_URL`
- R2/S3-compatible object storage account and bucket.
- Toll-free/proxy calling provider for phone-number privacy.
- Payment provider for driver subscription renewal:
  - Razorpay, Cashfree, Stripe, or another approved provider.
- Production observability provider:
  - Sentry, PostHog, Datadog, OpenTelemetry stack, or equivalent.

## Real-Device Validation

- Run [REAL_DEVICE_E2E_CHECKLIST.md](REAL_DEVICE_E2E_CHECKLIST.md).
- Verify Pusher negotiated-ride events on physical passenger and driver devices.
- Verify Expo push-token registration on physical iOS and Android builds.
- Verify push notifications are received for ride requested, accepted, cancelled,
  started, completed, counter offer, and counter accepted.
- Verify fixed-fare ride lifecycle on devices:
  - request
  - accept
  - start
  - cancel
  - complete
  - rate.
- Verify negotiated fare lifecycle on devices:
  - request
  - accept
  - counter
  - approve counter
  - lock-out losing driver
  - expiry fallback.
- Verify KYC submission and admin review on production-like devices.

## Product Or Business Decisions

- Choose and contract a toll-free/proxy calling provider.
- Choose payment provider and subscription pricing rules.
- Choose observability provider and alerting policy.
- Finalize privacy policy, data-retention language, and legal review.
- Decide when out-of-app push notifications should be enabled for the pilot.
- Finalize no-driver escalation policy:
  - how long a passenger can wait before the request expires or escalates
  - whether high-demand zones should widen dispatch radius
  - whether fare guidance should suggest a higher quick-accept offer
  - what passenger copy should be shown when supply is low.

## In-Repo Status

Completed locally:

- Fare negotiation schema, APIs, Pusher private-channel auth, mobile UI, and
  backend race tests.
- Passenger fare negotiation now uses a single offer model with suggested fare
  chips and bounded custom offers. The backend still stores min/max guardrails.
- Driver negotiation cards show the passenger offer, keep countered rides visible
  while waiting for passenger approval, and page nearby requests locally in
  batches of 5.
- Driver earnings now use final fare, refresh after ride completion, and driver
  wallet includes lazy paginated completed ride history.
- Passenger trip-status sharing uses the native OS share sheet so WhatsApp and
  recent share targets appear naturally.
- Passenger/driver/admin route groups redirect to the login/welcome screen after
  logout instead of rendering a blank protected tab screen.
- Push-token storage, mobile registration, and basic Expo push sending from ride
  lifecycle events.
- Operational event table and retention cleanup.
- Consolidated schema generator and `web/db/autoride_full_schema.sql`.
- Real-device E2E checklist.

Remaining code work after provider choices or product decisions:

- Replace direct `tel:` calls with the selected proxy-calling API.
- Add payment subscription checkout/webhook routes once a provider is selected.
- Add provider-specific observability transport once a destination is selected.
- Implement backend no-driver expiry/escalation policy once the business rule is
  finalized. The passenger UI currently warns after 60 seconds of waiting.
