# TukTukGo Project Guide

This is the single supporting document for TukTukGo. `README.md` remains the quick-start overview; this guide contains the architecture, developer setup, feature status, design rules, operations, QA checklist, and remaining launch work.

Last consolidated: 2026-06-29.

## Contents

1. [Product and architecture](#product-and-architecture)
2. [Repository and local setup](#repository-and-local-setup)
3. [Database and backend](#database-and-backend)
4. [Core product flows](#core-product-flows)
5. [Pilot feature pack](#pilot-feature-pack)
6. [Mobile UI, accessibility, and motion](#mobile-ui-accessibility-and-motion)
7. [Localization](#localization)
8. [Production configuration](#production-configuration)
9. [Release validation](#release-validation)
10. [Remaining work](#remaining-work)
11. [Implementation rules](#implementation-rules)

## Product and architecture

TukTukGo is an India-focused auto-rickshaw ride platform with three roles:

- Passenger: sign up, manage a profile and saved places, request fixed or negotiated rides, schedule rides, cancel, chat, call through masking, share trip status, trigger SOS tracking, rate drivers, and view history.
- Driver: register a vehicle, complete KYC, wait for approval, manage subscription access, go online, receive nearby requests, negotiate fares, start/complete/cancel rides, rate passengers, and view earnings and incentives.
- Admin: review drivers and KYC, manage subscriptions and service zones, inspect rides and operational activity, and audit privileged actions.

Primary stack:

- Mobile: Expo React Native, Expo Router, TanStack Query, Zustand, SecureStore, React Native SVG/Animated, Pusher.
- Web/backend: React Router 7 server routes under `web/src/app/api`.
- Database: PostgreSQL through `pg`; PostGIS supports service-zone and nearby-driver queries.
- Authentication: Auth.js credentials flow with JWT sessions.
- Maps: Ola Maps through backend-only normalized endpoints, with configurable local fallbacks.
- External integrations: Fast2SMS, Expo Push, Pusher, HyperVerge, Exotel, Razorpay, Sentry, and optional R2/S3 storage.

```mermaid
flowchart LR
  Mobile[Expo app] --> API[React Router API]
  Web[Web and admin] --> API
  API --> DB[(PostgreSQL/PostGIS)]
  API --> Maps[Ola Maps]
  API --> Realtime[Pusher]
  API --> SMS[Fast2SMS]
  API --> Push[Expo Push]
  API --> KYC[HyperVerge]
  API --> Calls[Exotel]
  API --> Pay[Razorpay]
  Realtime --> Mobile
```

## Repository and local setup

```text
.
|-- mobile/                       Expo app and role-based screens
|   |-- assets/animations/        Generated motion assets
|   |-- src/app/                  Expo Router routes
|   |-- src/components/           Shared UI, chat, loaders, motion
|   |-- src/theme/                Theme and icon tokens
|   `-- src/utils/                Auth, Pusher, query, notifications
|-- web/
|   |-- db/migrations/            Ordered PostgreSQL migrations
|   |-- db/autoride_full_schema.sql
|   |-- scripts/                  Migration, schema, maintenance helpers
|   |-- src/app/api/              Server API handlers
|   |-- src/app/track/            Public SOS tracking page
|   `-- src/auth.js               Session resolution
|-- README.md                     Quick-start overview
|-- PROJECT_GUIDE.md              This canonical guide
`-- run-local.ps1                 Local launcher
```

### Requirements

- Node.js 20 or newer
- npm
- Access to the development PostgreSQL database
- Expo Go or a development build on a physical phone
- Computer and phone on the same network for LAN testing

### Install and configure

```powershell
cd web
npm install
Copy-Item .env.example .env

cd ..\mobile
npm install
Copy-Item .env.example .env
```

Minimum web settings:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE
AUTH_SECRET=use-a-secure-shared-development-secret
AUTH_URL=http://YOUR_LAN_IP:4000
ENABLE_OTP_VERIFICATION=false
```

Minimum mobile LAN settings:

```env
EXPO_PUBLIC_APP_URL=http://YOUR_LAN_IP:4000
EXPO_PUBLIC_BASE_URL=http://YOUR_LAN_IP:4000
EXPO_PUBLIC_HOST=YOUR_LAN_IP:4000
EXPO_PUBLIC_PROXY_BASE_URL=http://YOUR_LAN_IP:4000
EXPO_PUBLIC_WEB_URL=http://YOUR_LAN_IP:4000
```

Do not use `localhost` from a physical phone. Find the active Wi-Fi IPv4 address with `ipconfig`. Keep secrets in ignored `.env` files and share them only through a secure channel.

### Start and verify

```powershell
.\run-local.ps1
.\run-local.ps1 -SkipInstall
.\run-local.ps1 -ClearExpoCache

cd web
npm run db:migrate
npm run db:check
npm run typecheck
npm run test:api

cd ..\mobile
npm run lint
npx expo export --platform web
```

Manual alternative: run `npm run dev:lan` in `web` and `npm start` in `mobile`.

`run-local.ps1` detects the current LAN address and passes the same origin to Auth.js and Expo for that run. It intentionally stops with a clear error when port 4000 is already occupied; allowing the backend to fall through to another port breaks the WebView cookie and login callback origin.

Troubleshooting:

- Verify `http://YOUR_LAN_IP:4000` opens on the phone.
- Allow Node.js and ports 4000/8081 through Windows Firewall.
- Restart web and Expo after environment changes.
- Use `run-local.ps1 -ClearExpoCache` if Metro retains old values.
- If port 4000 is reported as occupied, stop the old web process before launching; do not let the backend move to port 4001 while Expo still targets port 4000.
- Run migrations before debugging API errors after a pull or branch switch.

## Database and backend

Migrations are the source of truth. Apply them with `npm run db:migrate`, verify with `npm run db:check`, and regenerate the fresh-install bundle with `npm run db:schema:bundle`.

Important tables include:

- Auth: `auth_users`, `auth_accounts`, `auth_sessions`, `auth_verification_tokens`, `otp_challenges`, `otp_cooldowns`.
- Ride domain: `rides`, `ride_driver_notifications`, `ride_fare_offers`, `ride_chat_messages`, `ride_ratings` fields.
- Driver domain: `drivers`, `driver_kyc_checks`, `driver_incentives`.
- Safety/profile: `auth_users.saved_places`, `sos_tracking_tokens`.
- Operations: `geo_zones`, `admin_audit_log`, `operational_events`, `user_push_tokens`, subscription/call records.

`web/src/app/api/utils/sql.js` owns the PostgreSQL pool and supports real transactions through `sql.transaction(async (tx) => ...)`.

Major endpoint groups:

- Rides: `/api/rides`, `/api/rides/:id`, fare offers, counter approval, negotiation expiry, chat, ratings, masked calls.
- Scheduled dispatch: `POST /api/rides/dispatch-scheduled` with `Authorization: Bearer $CRON_SECRET`.
- SOS: `POST/DELETE /api/rides/:id/sos`, public `GET /api/track/:token`, and `/track/:token`.
- Drivers: registration/status, KYC, earnings, incentives, ride history, subscription routes.
- Profiles: `GET/PUT/PATCH /api/user-profile`.
- Locations: autocomplete, place details, reverse geocode, and route/fare estimate.
- Admin: drivers, KYC, rides, stats, zones, audit, setup bootstrap.
- Platform: auth token, Pusher auth, push tokens, health, metrics, upload, payment webhooks.

Security rules:

- Keep provider secrets server-side.
- Require `auth(request)` and role/ownership checks on protected routes.
- Validate strings, coordinates, timestamps, status transitions, and payload sizes server-side.
- Never expose raw passenger/driver phone numbers in ride feeds.
- Keep precise location data only as long as operationally required.

## Core product flows

### Passenger ride

1. Resolve pickup/destination through backend location endpoints.
2. Preview backend-computed distance, ETA, and fare.
3. Create fixed, negotiated, or scheduled ride request.
4. Backend validates service zone, cooldowns, active rides, and coordinates.
5. Drivers receive eligible requests through notification records, polling, push, and Pusher where configured.
6. Passenger follows accepted/start/completed/cancelled state through polling plus realtime events.
7. During an accepted ride, passenger may chat, masked-call, share status, or send one SOS tracking link.
8. Both parties can rate after completion.

### Driver eligibility and ride handling

1. Driver registers vehicle and documents, submits KYC, and receives admin approval.
2. Online mode requires approved KYC, active subscription, fresh location, and an active dispatch zone.
3. Driver feed polls every five seconds and uses private ride channels for negotiated/accepted lifecycle updates.
4. Acceptance is transactionally locked so only one driver wins.
5. Driver starts and completes the ride; earnings use final fare with estimated fare fallback.

### Admin and maintenance

- Admin actions are authorization-gated and audited.
- Zone boundaries use PostGIS and can be created/edited through map or GeoJSON tools.
- `npm run maintenance` offlines stale drivers, cancels timed-out rides, applies configured no-driver timeouts, and removes expired operational/auth/token data.
- Admin bootstrap is development-only, disabled in production, and unavailable once an admin exists.

## Pilot feature pack

Implemented and migrated on 2026-06-29:

- Earnings banner: today/week/month totals plus today's completed ride count.
- Saved Places: up to five validated places, profile add/edit/delete, and booking chips.
- SOS live tracking: a 64-character token, one Fast2SMS message, public 10-second polling, manual stop, and automatic end/expiry states. No recurring SMS exists.
- Scheduled rides: 15 minutes to 24 hours ahead; cron dispatch begins 30 minutes before pickup.
- Driver incentives: daily 8-ride/INR 50 progress and persisted 5-day/INR 200 streak support.

Pilot migrations:

- `020_saved_places.sql`
- `021_sos_tracking.sql`
- `022_scheduled_rides.sql`
- `023_driver_incentives.sql`

The repository already contained other migrations with prefixes 020-022. Full filenames are unique and the migration runner applies them in filename order.

Scheduled-dispatch production cron:

```cron
* * * * * curl -s -X POST https://your-api.com/api/rides/dispatch-scheduled -H "Authorization: Bearer YOUR_CRON_SECRET" > /dev/null 2>&1
```

## Mobile UI, accessibility, and motion

### UI rules

- Reuse tokens from `mobile/src/theme`; keep the TukTukGo teal/auto-yellow identity.
- Use React Native icons, never browser CSS pseudo-elements for native screens.
- Respect safe areas and bottom gesture insets.
- Use an 8-point spacing rhythm: 16px outer padding, 12px card padding, 48-56px primary controls.
- Keep important touch targets at least 44x44 dp.
- Communicate status with text/icons as well as color.
- Add accessibility roles, labels, and hints to important actions.
- Prefer skeletons or local progress indicators over full-screen flicker.
- Handle offline/realtime degradation without blanking screens; retain polling fallback.
- Use optimistic updates only when rollback is safe.

### Motion runtime

Runtime components are in `mobile/src/components/motion` and use existing React Native `Animated` plus `react-native-svg`:

- `AutoMotionScene`
- `AutoMotionLoader`
- `AutoMotionSuccess`
- `AutoMotionEmptyState`
- `AutoMotionButtonLoader`
- `MotionPressable`

Generated assets live in `mobile/assets/animations/auto-motion`. Regenerate them with:

```powershell
cd mobile
npm run animations:build
```

Motion principles:

- Prefer transforms and opacity; avoid blur, complex masks, and heavy particles.
- Main loops should generally last 1.2-2.5 seconds.
- Keep generated Lottie JSON under 100KB when possible and vector-only.
- Respect reduced-motion preferences.
- Use 120-180ms spring press feedback and restrained success/error pulses.
- Do not add Lottie or Rive native runtimes unless the build is explicitly validated on Android, iOS, and web.

Core palette: primary `#43B8B3`, primary dark `#339E9A`, auto yellow `#F3B51B`, auto green `#1F8A4C`, text `#17272B`, success `#22C55E`, error `#EF4444`, border `#D8E4E5`.

## Localization

Target passenger/driver languages are English, Hindi, and Telugu. The app already has a language context and profile preference foundation, but coverage must be audited before calling all screens fully translated.

Rules:

- Use stable locale codes (`en`, `hi`, `te`) and stable translation keys.
- Keep API states and error codes language-neutral; translate at the presentation boundary.
- Keep user-entered names, addresses, chat, and feedback unchanged.
- Use English fallback and locale-aware INR/date/duration/plural formatting.
- Cache the preference locally to prevent an English flash on startup.
- Generate push copy in the recipient's preferred language only after templates receive native-speaker review.

Remaining localization rollout:

1. Audit hardcoded passenger/driver strings and translation completeness.
2. Normalize legacy language labels to locale codes if still present.
3. Translate the complete ride, safety, payment, cancellation, KYC, and profile journeys.
4. Review Hindi/Telugu terminology with native speakers.
5. Test font scaling, long labels, small screens, and release builds.
6. Add translation completeness checks to CI.

Admin and operational web screens may remain English for the pilot.

## Production configuration

Configure only the integrations in use and keep secrets out of Git.

- Core: `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`, `CORS_ORIGINS`.
- Maps: `OLAMAPS_API_KEY` and restricted billing/quota controls.
- SMS/SOS: `FAST2SMS_API_KEY`, route/language settings; confirm HTTPS-link delivery.
- Scheduled rides: unique `CRON_SECRET` of at least 32 random characters and the VPS cron entry.
- Realtime: `PUSHER_APP_ID`, `PUSHER_KEY`, `PUSHER_SECRET`, `PUSHER_CLUSTER=ap2`, mobile public key/cluster.
- KYC: HyperVerge app credentials and confirmed OCR/face/DL/RC endpoints.
- Storage: `UPLOAD_STORAGE_PROVIDER=r2|s3`, endpoint, bucket, region, access credentials, signed URL TTL.
- Masked calls: Exotel SID, API credentials, subdomain, virtual number, app ID.
- Payments: Razorpay key/secret, webhook secret, and real plan IDs.
- Monitoring: separate web/mobile Sentry DSNs, source-map credentials, Grafana/OpenTelemetry values, UptimeRobot monitors.
- Retention/timeouts: heartbeat, accepted ride, no-driver, operational event, inactive push token, and subscription grace values.

Production acceptance for an integration requires credentials, sandbox/live testing, quota/alert setup, failure handling, and real-device verification—not merely populated environment variables.

## Release validation

Record device model, OS, app build, backend commit, and database before testing. Use one passenger, two approved/subscribed drivers, and one admin in an active zone.

### Automated gate

```powershell
cd web
npm run db:migrate
npm run db:check
npm run typecheck
npm run test:api

cd ..\mobile
npm run lint
npx expo export --platform web
```

### Passenger and safety

- Sign up/sign in, consent, profile, language preference, emergency contact, and saved-place CRUD.
- Select locations, verify estimate, request fixed and negotiated rides, cancel, and observe cooldowns.
- Schedule rides at minimum/maximum boundaries; confirm no immediate dispatch and cron dispatch inside 30 minutes.
- Verify accepted ride details, chat, masked call, start/completion, cancellation, rating, and history.
- Start SOS once; confirm exactly one SMS, public map updates, manual share, stop state, ride-ended state, and four-hour expiry behavior.
- Confirm raw phone numbers and unrestricted provider keys never appear.

### Driver

- Register, submit KYC, receive admin approval, and activate subscription.
- Go online inside a zone; verify heartbeat and automatic offline behavior.
- Receive fixed/negotiated/scheduled requests, accept race behavior, start, cancel, complete, and rate passenger.
- Verify earnings today/week/month and the daily incentive progress/achievement state.

### Realtime, notifications, and recovery

- Verify Pusher counters, locks, accepted/start/completed/cancelled events on two devices.
- Background/kill the driver app, create a request, reopen, and verify polling recovery.
- Verify Expo token refresh and lifecycle push delivery while backgrounded.
- Confirm accepted-ride cancellation produces one branded local notice plus the expected push, without duplicate OS alerts.

### Admin and operations

- Review driver/KYC, rides, zones, subscriptions, and audit activity.
- Verify search, filters, sorting, pagination, GeoJSON validation, and zone activation.
- Cold-load SSR admin dashboards and confirm charts do not collapse or emit hydration warnings.
- Confirm maintenance offlines stale drivers, cancels ghost/no-driver rides according to configured values, and removes expired records.
- Send temporary web/mobile Sentry events to the correct projects, then remove the triggers.

Pass criteria: no blank/stuck screens; valid ride transitions; one winning driver; correct authorization; no secret/phone leakage; polling recovery; successful scheduled/SOS behavior; clean automated checks.

## Remaining work

### Deployment and credentials

- Install and monitor the scheduled-ride VPS cron using the production URL and secret.
- Validate Fast2SMS transactional link delivery for SOS.
- Configure and validate production Ola Maps, Pusher, HyperVerge, R2/S3, Exotel, Razorpay, Sentry, Grafana/OpenTelemetry, and uptime credentials.
- Seed streak incentive rows when the streak campaign is activated.
- Verify Expo push on physical iOS/Android release builds.

### Product and policy decisions

- Finalize no-driver timeout/escalation and dispatch-radius policy.
- Confirm driver subscription pricing, retry/grace rules, and fallback payments.
- Confirm masked-call commercial flow and user copy.
- Define monitoring thresholds, owners, and escalation channels.
- Complete privacy policy, data retention language, and legal review.
- Decide production push-notification preferences and opt-out behavior.

### Engineering and QA

- Complete Hindi/Telugu translation coverage and native-speaker review.
- Run the full physical-device release checklist, especially SOS SMS, native scheduling pickers, KYC uploads, push, and payment/calling providers.
- Validate HyperVerge private endpoints and ensure full Aadhaar is never stored or logged.
- Review current npm audit findings deliberately; do not use forced breaking upgrades without regression testing.
- Continue focused tests for provider failures, cron idempotency, incentives, and payment/webhook races.

## Implementation rules

- Inspect actual files and current contracts before changing code.
- Preserve unrelated user changes and avoid rewriting configuration wholesale.
- Keep mobile provider access behind backend endpoints.
- Add schema changes as idempotent migrations, apply them, verify the DB, and regenerate the consolidated schema.
- Keep protected route ownership/role checks explicit.
- Prefer reusable theme/UI/motion primitives already in the repository.
- After each logical feature, run proportional lint, typecheck, tests, and export/build checks.
- Keep commits small and descriptive.
- Update this guide when architecture, operational requirements, QA gates, or pending work changes. Do not create additional Markdown planning/status files; consolidate updates here.
