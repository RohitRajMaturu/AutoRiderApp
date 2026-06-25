# TukTukGo Production Integrations Backlog

This app is intentionally light right now. The items below are the major integrations needed before treating it like a production Ola/Uber-style ride platform.

## 1. Maps, Places, And Geocoding

Current state:
- Backend location endpoints now exist for autocomplete, place details, reverse geocoding, and route estimate.
- If `OLAMAPS_API_KEY` is configured, the backend uses Ola Maps APIs.
- If no provider key is configured, the backend falls back to configurable local dev data.
- Pickup can default to device current location.

Production requirement:
- Configure a real places autocomplete provider in production.
- Convert selected places into latitude/longitude using geocoding.
- Show pickup/drop markers on a map.
- Let users adjust pickup pin manually.
- Reverse geocode current location into a readable address.

Recommended provider:
- Ola Maps through Krutrim Cloud for places, geocoding, and auto-rickshaw route estimates.

Implementation notes:
- Mobile should call a backend endpoint, not the provider directly, for autocomplete and geocoding.
- Backend should own API keys, rate limiting, caching, and provider-specific response normalization.
- Implemented backend endpoints:
  - `GET /api/locations/autocomplete?q=...&lat=...&lng=...`
  - `GET /api/locations/place/:placeId`
  - `GET /api/locations/reverse?lat=...&lng=...`
  - `GET /api/routes/estimate?pickupLat=...&pickupLng=...&destLat=...&destLng=...`
- Store normalized fields on rides:
  - `pickup_address`
  - `pickup_place_id`
  - `pickup_lat`
  - `pickup_lng`
  - `dest_address`
  - `dest_place_id`
  - `dest_lat`
  - `dest_lng`

Acceptance criteria:
- Typing in pickup/destination shows real places.
- Selecting a place updates address and coordinates.
- Current location defaults pickup without blocking manual entry.
- Suggestions are biased near the user location.
- No map provider secret is exposed in the mobile bundle.

Pending team work:
- Add a production `OLAMAPS_API_KEY`.
- Add billing, quota alerts, and API restrictions for the selected maps provider.
- Add map UI with pickup/destination pins and drag-to-adjust behavior.
- Persist `pickup_place_id` and `dest_place_id` in the database if provider place IDs are required for audit/debugging.

## 2. Route, Fare, And ETA Estimation

Current state:
- Fare/ETA are not based on real distance or traffic.

Production requirement:
- Estimate route distance, duration, and fare before ride request.
- Recalculate if pickup or destination changes.
- Do not implement surge pricing or dynamic marketplace pricing.

Implementation notes:
- Use Directions API from the chosen maps provider.
- Keep fare rules configurable in backend.
- Persist estimated distance, duration, fare, and provider route metadata.
- Keep this lightweight: fixed base fare plus distance/time rules are enough.

Acceptance criteria:
- Passenger sees fare/ETA before requesting.
- Backend computes fare, not mobile.
- Fare calculation is reproducible for audit/support.

## 3. Authentication And Sessions

Current state:
- Auth is partially stubbed/lightweight for local testing.

Production requirement:
- Fully working signup/signin/session refresh.
- Secure mobile token storage.
- Role-based access for passenger, driver, admin.

Implementation notes:
- Finalize auth provider and token strategy.
- Add backend auth middleware to all protected API routes.
- Add account recovery and phone/email verification.

Acceptance criteria:
- Protected APIs cannot be used without valid auth.
- Passenger/driver/admin routes enforce role checks.
- Sessions survive app restart and expire safely.

## 4. Payments And Driver Subscriptions

Current state:
- Subscription eligibility exists in the backend.
- Razorpay is the selected provider in the current infrastructure plan, but
  production credentials, real plans, and webhook delivery still need validation.
  Backend status/create/cancel routes, webhook verification, fallback payment
  link handling, and the mobile wallet panel are implemented behind env
  configuration.

Production requirement:
- Driver subscription purchase/renewal.
- Payment status webhook processing.
- Prevent unsubscribed drivers from going online.

Planned provider:
- Razorpay Subscriptions with UPI AutoPay and manual payment-link fallback.

Acceptance criteria:
- Payment state is updated by verified webhooks.
- Driver online eligibility is based on backend subscription state.
- Admin can inspect subscription status.

## 5. Notifications

Current state:
- SMS is implemented behind a provider-neutral backend module.
- `SMS_PROVIDER=fast2sms` uses Fast2SMS for OTP and SMS fallback testing.
- `SMS_PROVIDER=msg91` uses MSG91 OTP and transactional templates when production-ready.
- Push-token storage and basic Expo ride lifecycle sending exist, but real-device
  delivery validation is still pending.

Production requirement:
- Push notifications for ride requested, accepted, cancelled, completed.
- Driver alerts for new ride offers.
- Passenger alerts for driver assignment.

Implementation notes:
- Expo Notifications can be used initially.
- Backend must store push tokens per user/device.
- Add notification preference and token refresh handling.

Acceptance criteria:
- Driver receives nearby ride request notification.
- Passenger receives driver accepted notification.
- Notifications are not sent to logged-out/stale devices.
- SMS provider can be changed by environment configuration without touching OTP, ride dispatch, or mobile flows.

## 6. Admin Operations

Current state:
- Admin screens exist, but operational flows are light.

Production requirement:
- Driver approval workflow.
- Ride audit trail.
- User/driver search.
- Subscription management.
- Basic fraud and abuse controls.

Acceptance criteria:
- Admin can approve/reject driver documents.
- Admin can inspect ride lifecycle and payment/subscription status.
- Admin actions are logged.

## 7. Data Model And Database Hardening

Current state:
- Schema is assumed to exist.

Production requirement:
- Versioned migrations.
- Indexes for ride lookup, driver lookup, location matching, auth.
- Reliable local/dev seed data.

Implementation notes:
- Add migration tooling and document setup.
- Consider PostGIS if using Postgres for geo queries.
- Add constraints for ride status transitions.

Acceptance criteria:
- Fresh checkout can create database schema from migrations.
- Queries used by passenger, driver, admin screens are indexed.
- Invalid status transitions are rejected.

## 8. Observability And Support

Current state:
- Generated logging was removed/simplified.

Production requirement:
- App/backend error logging.
- Request tracing.
- Basic analytics for ride funnel.
- Support/debug views for user and ride issues.

Planned stack:
- Sentry for error tracking.
- Grafana Cloud/Loki/Prometheus/Tempo with OpenTelemetry for logs, metrics, and traces.
- UptimeRobot for uptime checks.

Acceptance criteria:
- Backend errors include request id and user id when available.
- Mobile errors are captured without leaking secrets.
- Ride request failures can be diagnosed from logs.

## 9. Masked Calling

Current state:
- Mobile call actions avoid visible raw phone-number text, but direct phone
  calling waits for live Exotel credentials. Backend masked-call initiation and
  call logging are implemented behind env configuration.

Production requirement:
- Passenger and driver calls must go through a masked/toll-free number so neither
  party sees the other's real phone number.

Planned provider:
- Exotel Number Masking API.

Acceptance criteria:
- Calls are allowed only for accepted or in-progress rides.
- The backend stores call SID, ride ID, direction, status, and duration, not raw
  passenger or driver phone numbers.
- Each ride direction is rate-limited to prevent harassment.

## 10. Security, Privacy, And Compliance

Production requirement:
- Secrets only in backend/server environment.
- No provider API keys in mobile bundle unless explicitly allowed by provider restrictions.
- Rate limits on auth, autocomplete, ride creation, driver status updates.
- Privacy policy and data retention rules.
- Location data retention policy.

Acceptance criteria:
- Mobile bundle does not contain unrestricted provider secrets.
- Backend validates all role-sensitive actions.
- Location history retention is documented and enforced.
