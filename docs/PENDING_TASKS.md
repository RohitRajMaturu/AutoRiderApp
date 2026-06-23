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
- Set Exotel masked-calling values:
  - `EXOTEL_SID`
  - `EXOTEL_API_KEY`
  - `EXOTEL_API_TOKEN`
  - `EXOTEL_SUBDOMAIN`
  - `EXOTEL_VIRTUAL_NUMBER`
  - `EXOTEL_APP_ID`
- Set Razorpay subscription values:
  - `RAZORPAY_KEY_ID`
  - `RAZORPAY_KEY_SECRET`
  - `RAZORPAY_WEBHOOK_SECRET`
  - `RAZORPAY_PLAN_STARTER`
  - `RAZORPAY_PLAN_ACTIVE`
  - `RAZORPAY_PLAN_PRO`
- Set production observability values:
  - `SENTRY_DSN`
  - `SENTRY_ENVIRONMENT`
  - `VITE_SENTRY_DSN`
  - `EXPO_PUBLIC_SENTRY_DSN`
  - `GRAFANA_CLOUD_URL`
  - `GRAFANA_CLOUD_USER`
  - `GRAFANA_CLOUD_API_KEY`
  - `OTEL_EXPORTER_OTLP_ENDPOINT`
  - `OTEL_SERVICE_NAME`
- Set production notification retention values if defaults are not acceptable:
  - `OPERATIONAL_EVENT_RETENTION_DAYS`
  - `INACTIVE_PUSH_TOKEN_RETENTION_DAYS`
- Set no-driver timeout if backend auto-cancellation should be enabled:
  - `NO_DRIVER_REQUEST_TIMEOUT_SECONDS=0` keeps it disabled.
  - A production value such as `180` or `300` enables maintenance-driven
    cancellation of unaccepted requests.
- Set `SUBSCRIPTION_HALT_GRACE_DAYS` if the default 5-day Razorpay halt grace
  period should change.
- Configure production private upload storage:
  - `UPLOAD_STORAGE_PROVIDER=r2` or `s3`
  - `UPLOAD_S3_ENDPOINT`
  - `UPLOAD_S3_BUCKET`
  - `UPLOAD_S3_REGION`
  - `UPLOAD_S3_ACCESS_KEY_ID`
  - `UPLOAD_S3_SECRET_ACCESS_KEY`
  - `UPLOAD_PUBLIC_BASE_URL` if needed by the chosen storage/CDN setup.
- Configure production alert recipients/channels for Sentry, Grafana, and
  UptimeRobot.

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
- Exotel account, virtual number, and masking app for phone-number privacy.
- Razorpay account, subscription plans, webhook secret, and test/live webhook
  delivery validation.
- Sentry project(s), Grafana Cloud stack, OpenTelemetry endpoint, and
  UptimeRobot monitors.

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

- Confirm Exotel call masking commercial setup and production call-flow copy.
- Confirm Razorpay monthly subscription pricing and grace-period rules.
- Confirm observability alert thresholds, owners, and escalation channels.
- Finalize privacy policy, data-retention language, and legal review.
- Decide when out-of-app push notifications should be enabled for the pilot.
- Finalize no-driver escalation policy:
  - exact value for `NO_DRIVER_REQUEST_TIMEOUT_SECONDS`
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
- Logout no longer navigates before auth is cleared, preventing role-dashboard
  redirect loops after sign-out.
- `KeyboardAvoidingAnimatedView` no longer captures mutable React refs inside
  Reanimated worklets, resolving the `Tried to modify key current` warning.
- Infrastructure env placeholders are documented in `web/.env.example` and
  `mobile/.env.example`; local ignored `.env` files can carry real values.
- Exotel masked-call service, call-log table, and
  `POST /api/rides/:rideId/call` are implemented behind env configuration.
- Passenger and driver call buttons now use the masked-call API instead of
  opening `tel:` links with raw phone numbers.
- Admin ride UIs mask phone numbers by default.
- Razorpay subscription schema, status/create/cancel routes, webhook signature
  verification, webhook state updates, and fallback payment-link handling are
  implemented behind env configuration.
- Driver wallet shows Razorpay subscription status/actions when configured and
  keeps admin-managed pilot access copy when it is not configured.
- `/api/health` and `/api/metrics` are implemented for production monitoring
  scaffolding.
- Maintenance can cancel stale no-driver requests when
  `NO_DRIVER_REQUEST_TIMEOUT_SECONDS` is configured, and enforces halted
  subscription grace-period online restrictions.
- Push-token storage, mobile registration, and basic Expo push sending from ride
  lifecycle events.
- Operational event table and retention cleanup.
- Consolidated schema generator and `web/db/autoride_full_schema.sql`.
- Real-device E2E checklist.

Remaining implementation work after provider choices or product decisions:

- Install and initialize Sentry SDKs for backend, mobile, and web once project
  DSNs are available.
- Connect Grafana Loki/Tempo exporters or sidecar after Grafana Cloud details are
  available. `/api/metrics` is ready for scraping.
- Tune no-driver timeout/escalation values once the business rule is finalized.
  The passenger UI currently warns after 60 seconds of waiting, and backend
  timeout is disabled until configured.
