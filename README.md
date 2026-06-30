# TukTukGo - Ride Connection Platform

A lightweight auto-rickshaw ride connection platform for India.

Architecture, setup, operations, QA, design guidance, feature status, and pending work are consolidated in [PROJECT_GUIDE.md](PROJECT_GUIDE.md).

## Tech Stack
- **Frontend**: React Native (Expo)
- **Backend**: React Router server routes on Node.js
- **Database**: PostgreSQL via `pg` / node-postgres
- **Authentication**: Auth.js credentials flow with role-based onboarding
- **Maps/Location Provider**: Ola Maps (Krutrim Cloud) via backend-only REST integration

## Core Features
- **Passengers**: Request rides, choose fixed fare or a guided negotiated offer, adjust pickup on a native map, see driver details, share trip status through the OS share sheet, and track ride history.
- **Drivers**: Create their account, register vehicle/license, complete KYC, toggle online/offline status, accept nearby rides, send fare counters, complete rides, and view paginated completed ride history.
- **Super Admin** (`auth_users.role = 'admin'`): Approve/reject driver applications,
  manage zones, autos, verification, subscriptions, institutions, and global
  Phase 2 operations, including ride, revenue, cancellation, and driver KPIs
  on web and mobile.
- **Institution Admin** (`auth_users.role = 'institution_admin'`): Manage only
  the institution linked through `institution_admin_users`, including routes,
  members, attendance, trips, and invoices.
- **Subscription Model**: Drivers need an active subscription to go online.

## Getting Started

For setup on another developer's computer or phone, follow the
[local setup guide](PROJECT_GUIDE.md#repository-and-local-setup).

Start the mobile app with the project-isolated Metro cache:

```powershell
cd mobile
npm start
```

If Expo's online dependency check is unavailable, use `npm run start:offline`.
The launcher keeps Metro cache files under `mobile/.metro-temp` instead of the
shared Windows temporary directory, preventing `ENOTEMPTY` cache-clear races.

### 1. Database Setup
Create the required Postgres tables from the checked-in migrations:

```powershell
cd web
npm run db:migrate
```

For a fresh database, a consolidated schema bundle is also generated at
`web/db/autoride_full_schema.sql`. Regenerate it after adding migrations:

```powershell
cd web
npm run db:schema:bundle
```

If you are using another machine or a different database, set `DATABASE_URL` in `web/.env` first, then run the same command. You can also pass a custom URL to the PowerShell helper if you prefer `psql`:

```powershell
cd web
.\scripts\apply-schema.ps1 -DatabaseUrl "postgresql://USER:PASSWORD@HOST:5432/DB_NAME?sslmode=require"
```

You can inspect table status with:

```powershell
cd web
npm run db:check
```

The schema lives under `web/db/migrations`. `001_init_autoconnect.sql` creates the auth, driver, and ride tables, while later migrations extend the auth account model.

Current verified local state:
- `npm run db:check` connects to database `AutoRider` as user `postgres`.
- Required tables are present: `auth_users`, `auth_accounts`, `auth_sessions`, `auth_verification_tokens`, `drivers`, and `rides`.

### 2. Super Admin Setup
To become the platform super admin for testing:
1. Temporarily set `ENABLE_ADMIN_SETUP=true` in the web environment.
2. Optionally set `ADMIN_SETUP_PHONES=919999999999` to restrict admin creation to your real phone number.
3. Tap `Continue as Admin` from the mobile welcome screen.
4. Create the account with your real phone number, email, and password.
5. After setup, use normal sign-in with that phone number or email.
6. Remove `ENABLE_ADMIN_SETUP` before production. The route is blocked once an admin exists.

The setup route is also hard-disabled when `NODE_ENV=production`.

Passenger and driver accounts are self-service from the mobile welcome screen.
Super admins do not create driver login accounts; they approve/reject driver
applications and KYC after the driver signs up and submits details.
Institution-admin accounts are provisioned by the super admin while registering
an institution; they do not receive access to zones, global drivers, KYC, or
other institutions.

### Driver Zone Assignment

Drivers are mapped to service zones automatically from their current GPS
coordinates. No manual driver-to-zone mapping is required:

1. The driver grants location access and goes online.
2. `/api/drivers/status` finds the active zone containing those coordinates and
   stores its `zone_id`.
3. Ride dispatch and driver polling re-evaluate the stored location and repair
   a missing or stale `zone_id` before matching rides.
4. Drivers outside every active dispatch-enabled zone cannot go online.

If an online driver does not receive a nearby request, verify approval,
subscription expiry, current coordinates, service-zone boundaries, and the
configured dispatch radius rather than manually editing `drivers.zone_id`.

### Test Accounts
Seeded test users from `web/scripts/seed-test-users.mjs` use temporary password `12345` after running `007_seed_account_passwords.sql`:
- Super Admin: `admin7893725929@autoride.test` or phone `7893725929`
- Passenger: `passenger9908027984@autoride.test` or phone `9908027984`
- Driver: `driver9885553312@autoride.test` or phone `9885553312`

To populate the Pass & Institution Console with an idempotent demo institution,
routes, members, trips, passes, invoice, and SLA event:

```powershell
cd web
npm run seed:phase2
```

The demo institution admin is `admin@greenfield.demo` with temporary password
`12345`. Select **Institution Admin** on `/admin-login`; super admins can onboard
additional institutions and create their restricted admin credentials from the
**TukTukSafe** tab in the Pass & Institution Console.

### 3. Environment Variables
The platform handles core environment variables like `DATABASE_URL`.
Copy `web/.env.example` to `web/.env` and fill in real values.

For production-grade location search and routing, configure the backend with:

```env
AUTH_SECRET=replace_with_a_long_random_secret
AUTH_URL=https://your-api-domain.com
OLAMAPS_API_KEY=your_ola_maps_api_key
ENABLE_ADMIN_SETUP=true
ADMIN_SETUP_PHONES=919999999999
PASSENGER_REQUEST_COOLDOWN_SECONDS=30
PASSENGER_POST_CANCEL_COOLDOWN_SECONDS=60
DRIVER_HEARTBEAT_TIMEOUT_SECONDS=120
DRIVER_RIDE_RADIUS_KM=8
MAX_TRIP_DISTANCE_KM=25
BACK_TO_BACK_DISPATCH_RADIUS_KM=2
ACCEPTED_RIDE_TIMEOUT_MINUTES=45
NO_DRIVER_REQUEST_TIMEOUT_SECONDS=300
SUBSCRIPTION_HALT_GRACE_DAYS=5
MAINTENANCE_INTERVAL_SECONDS=30
VITE_ANDROID_APP_URL=https://play.google.com/store/apps/details?id=your.app.id
VITE_IOS_APP_URL=https://apps.apple.com/app/your-app-id
VITE_PRIVACY_URL=https://your-privacy-url
VITE_SENTRY_DSN=
FAST2SMS_API_KEY=your_fast2sms_api_key
CORS_ORIGINS=https://your-domain.com,https://your-other-domain.com
RATE_LIMIT_MAX_REQUESTS=120
RATE_LIMIT_WINDOW_MS=60000
UPLOAD_STORAGE_PROVIDER=r2
UPLOAD_S3_ENDPOINT=https://ACCOUNT_ID.r2.cloudflarestorage.com
UPLOAD_S3_BUCKET=auto-ride-kyc
UPLOAD_S3_REGION=auto
UPLOAD_S3_ACCESS_KEY_ID=your_r2_access_key_id
UPLOAD_S3_SECRET_ACCESS_KEY=your_r2_secret_access_key
UPLOAD_PUBLIC_BASE_URL=
UPLOAD_SIGNED_URL_TTL_SECONDS=3600
EXOTEL_SID=
EXOTEL_API_KEY=
EXOTEL_API_TOKEN=
EXOTEL_SUBDOMAIN=api.exotel.com
EXOTEL_VIRTUAL_NUMBER=
EXOTEL_APP_ID=
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
RAZORPAY_PLAN_STARTER=
RAZORPAY_PLAN_ACTIVE=
RAZORPAY_PLAN_PRO=
```

FAST2SMS_API_KEY is required for phone OTP on signup and signin. Without it, OTP requests will silently fail. Get a key at fast2sms.com. CORS_ORIGINS should be set to your deployed web domain(s) in production; omitting it disables CORS validation, which is acceptable only for local development.

Before deploying rating support, run `006_ride_ratings.sql` on your production Postgres. Otherwise completed rides will 500 on the rating endpoint.

Ride matching uses admin-managed PostGIS service zones. Run `npm run db:migrate`,
then create at least one active zone from the Admin Zones tab before testing new
passenger requests or driver online status.

Admin service zones can be created or edited visually from the mobile Admin
Zones tab. Operations can search an area, tap two corners for a rectangle, tap
three or more vertices for a custom polygon, or paste GeoJSON when importing an
existing boundary.

The mobile app does not call Ola Maps directly. Expo screens call backend routes under `/api/locations/*` and `/api/routes/estimate`, keeping the provider key out of the client bundle.

Mobile auth stores `{ jwt, user }` in SecureStore under the stable key `auto-ride-auth`. `/api/auth/token` returns this shape after WebView sign-in, and mobile API calls send the JWT as a bearer token.

Mobile passenger/driver signup intentionally uses the shared web auth page inside `AuthWebView` with `client=mobile`. This keeps OTP, consent capture, duplicate-account handling, and onboarding cleanup in one place. Mobile signup is constrained to passenger and driver roles; admin access remains sign-in/admin-setup only.

The public web landing page reads `VITE_ANDROID_APP_URL` and `VITE_IOS_APP_URL` for store buttons. If either value is blank, that button renders as a non-clickable coming-soon state instead of a placeholder link.

Mobile role screens are guarded after logout. As soon as resolved auth becomes
null, passenger, driver, and admin route layouts stop rendering their tab trees.
They do not call `<Redirect>` themselves because the root navigator may be
mid-transition. The root layout is the sole logout navigation owner and waits
for `rootNavigationState.key` before calling `router.replace("/")`.

The web admin dashboards use `echarts-for-react` with fixed-height shimmer
placeholders while data loads. The mobile admin dashboard uses animated
`react-native-svg` area, bar, donut, and sparkline visualizations so it remains
compatible with Expo Go and Hermes.

Admin fare totals, ride charts, driver "today" trip counts, and driver earnings
use `Asia/Kolkata` calendar boundaries. Ride volume is bucketed by request time,
revenue/completions by completion time, and cancellations by cancellation time;
database session timezone does not determine the displayed day.

Backend `/api/*` routes include basic rate limiting and security headers. Set `RATE_LIMIT_MAX_REQUESTS=0` only for local debugging.

### Upload Storage

Local development stores uploaded images under `web/public/uploads`.
Production should use private object storage. Cloudflare R2 is the recommended
cost-effective default because it is S3-compatible and avoids the usual object
storage egress costs.

Use these production settings:

```env
UPLOAD_STORAGE_PROVIDER=r2
UPLOAD_S3_ENDPOINT=https://ACCOUNT_ID.r2.cloudflarestorage.com
UPLOAD_S3_BUCKET=auto-ride-kyc
UPLOAD_S3_REGION=auto
UPLOAD_S3_ACCESS_KEY_ID=your_r2_access_key_id
UPLOAD_S3_SECRET_ACCESS_KEY=your_r2_secret_access_key
UPLOAD_SIGNED_URL_TTL_SECONDS=3600
```

The app code talks to a vendor-neutral storage adapter, not directly to R2. To
migrate later, copy the bucket objects to another S3-compatible provider and
change the `UPLOAD_S3_*` environment variables. Keep KYC buckets private; the
backend returns signed read URLs for HyperVerge and mobile previews.

Ride discovery is polling-based by design for the Secunderabad pilot:
- Drivers poll `/api/rides` every 5 seconds while online.
- Passengers poll `/api/rides` every 6 seconds while watching an active ride.
- `npm run maintenance` runs the independent cleanup worker every 30 seconds by default, marking expired drivers offline, cancelling ghost accepted rides, and deleting expired auth/OTP/realtime-token rows.

Fare negotiation is the exception to the polling-only model. Negotiated ride
requests use Pusher private ride channels for counter offers, lock-out events,
and expiry notifications, with the database transaction remaining the source of
truth.

Configure these values for negotiation realtime:

```env
# web/.env
PUSHER_APP_ID=
PUSHER_KEY=
PUSHER_SECRET=
PUSHER_CLUSTER=ap2

# mobile/.env
EXPO_PUBLIC_PUSHER_KEY=
EXPO_PUBLIC_PUSHER_CLUSTER=ap2
```

Accepted-ride chat and cancellation updates also use private ride channels for
fast foreground delivery. Chat messages are persisted and polled as a fallback,
while cancellation state is always reconciled through ride polling. Cancelling
a ride sends the opposite party a branded in-app notice and an Expo push
notification.

The driver dashboard keeps its content mounted during background work and shows
a thin animated top progress line for loading, refreshes, and driver actions,
avoiding the previous full-screen loading flicker.

Mobile admin ride management uses server-side status filtering, search,
fare/date sorting, and 20-item pagination. Admin activity is presented as
readable operations instead of internal event keys. Obsolete mobile test mode
has been removed; all role dashboards require an authenticated session.

Service zones support a validate-preview-save workflow for GeoJSON on both
mobile and web admin. Invalid JSON uses app-native notifications, validated
boundaries are previewed before saving, edit mode has an explicit cancel action,
and active/inactive updates use immediate UI feedback.

Admin activity uses a shared server-paginated API on mobile and web with action
category filters, actor/action/detail search, and newest/oldest sorting. The web
GeoJSON creator is a dedicated full-width operations section with a map-style
boundary preview, vertex markers, and coordinate bounds.

## Completed Backend Location Work

- Server-side Ola Maps autocomplete through `GET /api/locations/autocomplete`.
- Server-side Ola Maps place details through `GET /api/locations/place/:placeId` and `GET /api/locations/place?placeId=...`.
- Server-side Ola Maps reverse geocoding through `GET /api/locations/reverse`.
- Auto-rickshaw route estimation through `GET /api/routes/estimate` using Ola routing mode `auto`.
- Route metadata is stored when rides are created so fare/ETA can be shown later.
- Fare calculation exists server-side as base fare INR 35 plus INR 18 per kilometer, but passenger-facing fare/surge UI is intentionally not enabled yet.
- Native mobile ride request screen shows pickup/destination pins and supports drag-to-adjust pickup without exposing Ola Maps keys.
- Configurable local fallback data for development when Ola Maps is unavailable or `OLAMAPS_API_KEY` is not configured.
- Mobile Admin Zones supports map-based rectangle creation, polygon drawing,
  existing-zone editing, and GeoJSON import fallback for service boundaries.

## Completed Fare Negotiation Work

- Migration `014_fare_negotiation.sql` adds negotiated ride state, fare range,
  final fare, negotiation expiry, and `ride_fare_offers`.
- Ride state machine now supports `requested -> negotiating -> accepted` and
  negotiation expiry fallback to `requested`.
- `POST /api/rides` supports `negotiation_mode: "negotiated"` with `fare_min`
  and `fare_max`.
- Pusher private-channel authorization is available at `POST /api/pusher/auth`.
- Server publishes Pusher events through signed REST calls, avoiding a long-lived
  WebSocket server.
- Driver responses are available at `POST /api/rides/:id/fare-offer`.
- Passenger counter approval is available at `POST /api/rides/:id/approve-counter`.
- Passenger-triggered expiry fallback is available at
  `POST /api/rides/:id/expire-negotiation`.
- Passenger mobile UI can request negotiated rides through suggested offer chips
  plus bounded custom offers, view a countdown, receive counter offers, approve
  counters, and fall back via safety polling.
- Driver mobile UI can accept, counter, or decline negotiated requests, keeps
  countered cards visible while waiting for passenger approval, receives lock-out
  updates, and pages busy request queues locally in batches of 5.
- Accepted driver ride cards now prioritize Start/Complete and Cancel actions;
  calling is icon-only and raw phone text is not displayed.
- Passenger UI warns after 60 seconds when no driver has accepted yet. Backend
  auto-cancellation for unaccepted requests is enabled by
  `NO_DRIVER_REQUEST_TIMEOUT_SECONDS=300` when the maintenance worker is
  running.

Pending negotiation/privacy follow-up:

- Masked calls are routed through a backend Exotel integration point so
  passenger and driver clients no longer open direct `tel:` links or receive raw
  phone numbers. Live credentials and real-phone validation are pending.
- Add live-device validation for Pusher event delivery once production Pusher
  credentials are configured.

## Notifications, Observability, And Privacy

Implemented foundation:

- Migration `015_notifications_observability_privacy.sql` adds
  `user_push_tokens`, `operational_events`, and `privacy_retention_policies`.
- Authenticated devices can register Expo push tokens through
  `POST /api/notifications/push-token`.
- Mobile attempts push-token registration after sign-in on physical iOS/Android
  devices.
- Maintenance deletes old `operational_events` and stale/inactive push tokens
  according to retention env settings.
- `OPERATIONAL_EVENT_RETENTION_DAYS` defaults to `90`.
- `INACTIVE_PUSH_TOKEN_RETENTION_DAYS` defaults to `180`.
- Sentry error monitoring is initialized for the React Router web client and
  Expo mobile app. Both integrations remain disabled when their DSN is absent.

Production approach:

- Create separate Sentry projects for web and mobile, then configure
  `VITE_SENTRY_DSN` in the web environment and `EXPO_PUBLIC_SENTRY_DSN` in the
  mobile build environment. Keep real values in ignored local `.env` files or
  deployment/build secrets; never commit them.
- Web Sentry is enabled outside development and samples 20% of production
  transactions. Mobile Sentry is enabled in production with a 20% trace sample
  rate. Mobile replay privacy options are configured, but replay sampling should
  be enabled deliberately only when the team decides to collect recordings.
- The Expo Sentry config plugin is installed. Configure the Sentry organization,
  project, and authentication token in the build environment when production
  source-map upload is required.
- Operational events are for diagnostics and lifecycle visibility. Do not store
  secrets, full phone numbers, full Aadhaar, tokens, or precise long-lived
  location trails in event metadata.
- Admin/security actions belong in `admin_audit_log`; keep that retention longer
  than diagnostics.
- Privacy retention is enforced by maintenance jobs, not manual cleanup.
- Add metrics/log shipping later from `operational_events` or app logs to the
  chosen production observability stack.
- Proxy calling is wired through the backend masked-call route; live Exotel
  credentials are still required before real calls can connect.
- Driver earnings use `final_fare` when present, refresh immediately after ride
  completion, and completed driver rides can be lazy-loaded through paginated
  history.
- Reanimated keyboard handling no longer captures mutable refs inside worklets,
  preventing the `Tried to modify key current` warning on affected devices.
- Driver subscription schema, Razorpay status/create/cancel routes, webhook
  handling, and wallet UI actions are implemented behind Razorpay env
  configuration.
- `/api/health` and `/api/metrics` provide deployment health and Prometheus-style
  metrics scaffolding.

To verify runtime error delivery after adding real DSNs, capture one temporary
test message or exception in each production-like client, confirm it appears in
the correct Sentry project, and remove the test trigger. Web and mobile should
use separate projects so releases and alerts remain attributable.

Real-device E2E checklist:

- Run the [consolidated release validation](PROJECT_GUIDE.md#release-validation)
  before launch and after ride lifecycle or auth changes.
- Track launch blockers in [remaining work](PROJECT_GUIDE.md#remaining-work).

## Completed Driver KYC Work

The driver KYC foundation is implemented with a vendor-swappable architecture:

- Database migration `011_driver_kyc.sql` adds driver KYC fields and `driver_kyc_checks`.
- Migration has been applied locally with `npm run db:migrate`.
- Vendor-neutral contract lives in `web/src/lib/kyc/contract.js`.
- Runtime vendor switch lives in `web/src/lib/kyc/config.js`.
- Dispatcher lives in `web/src/lib/kyc/verifyDriver.js`.
- HyperVerge-specific adapter shell lives in `web/src/lib/kyc/adapters/hyperverge.js`.
- HyperVerge `/readKYC`, face-match, DL lookup, and RC lookup calls are wired with configurable endpoint URLs.
- Driver KYC submission API is available at `POST /api/drivers/kyc-submit`.
- Mobile driver KYC flow is available at `mobile/src/app/(driver)/kyc-submit.jsx`.
- Driver dashboard blocks online mode until `kyc_status = 'approved'`.
- Admin KYC review queue is available at `/admin-kyc`.
- Admin API for KYC review is available at `GET/PATCH /api/admin/kyc`.
- `web/.env.example` includes `HYPERVERGE_APP_ID`, `HYPERVERGE_APP_KEY`, and endpoint URL placeholders.

KYC data handling rules:

- Full Aadhaar is sent only in the KYC submission request body.
- Only the last 4 Aadhaar digits are stored in `drivers.aadhaar_number_masked`.
- Vendor responses are stored in `driver_kyc_checks.raw_result` for audit.
- API routes and admin/mobile app code call the vendor-neutral dispatcher, not the HyperVerge adapter directly.

## External Driver KYC Launch Gates

The KYC system is structurally complete. Live HyperVerge verification still
depends on external credentials and sandbox validation:

- Add real `HYPERVERGE_APP_ID` and `HYPERVERGE_APP_KEY` values to the deployed web environment.
- Set the deployed HyperVerge endpoint URLs to the final private paths from HyperVerge.
- Run sandbox KYC submissions end-to-end once credentials and confirmed endpoints are available.
- Verify that full Aadhaar never appears in logs, DB rows, or vendor raw results after sandbox testing.

`HYPERVERGE_FACE_MATCH_URL`, `HYPERVERGE_DL_LOOKUP_URL`, and
`HYPERVERGE_RC_LOOKUP_URL` are intentionally blank in `web/.env.example` until
HyperVerge provides confirmed private paths. If they are unset, those checks
record `not_run` instead of calling a guessed URL.

## Backend Verification

```powershell
cd web
npm run typecheck
npm run test:api
npm run db:check
```

Focused API tests cover auth resolution, ride authorization conflicts, admin driver validation, and nearby driver filtering.

## Brand, Icons, And Motion

TukTukGo uses a shared auto-rickshaw brand icon across web and mobile:

- Web landing logo source: `web/public/tuktukGo.png`.
- Web browser favicon: `web/public/favicon.png`.
- Mobile Expo icon, adaptive icon foreground, splash image, and web favicon: `mobile/assets/images/icon.png`.
- The legacy `web/public/auto-ride-icon.png` and duplicate temporary icon copies were removed.
- The accidental saved Gmail export under `web/public/images/TukTukGo.html` / `TukTukGo_files/` was removed.
- `web/public/images/welcome-auto-rickshaw-transparent.png` remains a separate welcome/auth rickshaw illustration and should not be replaced by the app icon.

The checked-in `tuktukGo.png` file is a static PNG, not an APNG/GIF/WebP animation. Motion is applied in the app layer:

- Web landing header applies a subtle CSS idle animation via `tuktukgo-logo-mark` in `web/src/app/global.css`.
- Mobile landing uses the same icon image with a fixed-position polished light sweep in `mobile/src/app/index.jsx`.
- Native launcher icons and Expo splash images remain static, as expected for platform icon assets.

## Motion And Animation System

TukTukGo has a standalone premium motion system for Indian auto-rickshaw booking states:

- Generated Lottie JSON assets: `mobile/assets/animations/auto-motion`.
- Asset generator: `mobile/scripts/generate-auto-motion-assets.mjs`.
- React Native runtime components: `mobile/src/components/motion`.
- Motion runtime, performance, palette, and implementation guidance: [PROJECT_GUIDE.md](PROJECT_GUIDE.md#mobile-ui-accessibility-and-motion).

Regenerate the compact vector Lottie assets after palette changes:

```powershell
cd mobile
npm run animations:build
```

The shipped runtime components use existing `react-native-svg` and React Native
`Animated` so current passenger, driver, admin, and auth flows do not require new
native packages. Lottie and Rive integration examples are documented for a later
renderer adoption step.

Do not remove the remaining files under `mobile/assets/animations/auto-motion/`
without updating `mobile/src/components/motion/AutoMotion.jsx`; they are still
referenced by the exported `AUTO_MOTION_LOTTIE` map. The unused legacy
`mobile/assets/animations/auto-rickshaw-loader.json` file was removed during the
TukTukGo cleanup.

## Runtime Graph

```mermaid
flowchart LR
  Mobile[Expo mobile app] --> AuthWeb[WebView auth pages]
  Mobile --> Api[React Router API routes]
  WebLanding[Web landing/admin UI] --> Api
  Api --> Postgres[(PostgreSQL)]
  Api --> Ola[Ola Maps REST]
  Api --> Pusher[Pusher Channels REST]
  Pusher --> Mobile
  Api -. planned .-> Exotel[Exotel masked calls]
  Api -. planned .-> Razorpay[Razorpay subscriptions]
  WebLanding --> SentryWeb[Sentry web errors]
  Mobile --> SentryMobile[Sentry mobile errors]
  Api -. planned .-> Metrics[Grafana/OTel metrics and logs]
  Api --> Maintenance[Maintenance worker]
  Api --> DriverHistory[Paginated driver ride history]
  Mobile --> Motion[React Native motion components]
  Motion --> MotionAssets[auto-motion JSON assets]
  Mobile --> DriverKyc[Driver KYC flow]
  DriverKyc --> Api
  WebLanding --> AdminKyc[Admin KYC review]
  AdminKyc --> Api
  Api --> KycDispatcher[KYC dispatcher]
  KycDispatcher --> HyperVerge[HyperVerge adapter]
  HyperVerge -. pending confirmed endpoints .-> HyperVergeDocs[Face/DL/RC docs]
```

## Single VPS Backend

The production backend is the React Router/Node app in `/web`. Deploy it on one
always-on VPS for the single-zone Secunderabad pilot, with PostgreSQL as the
durable source of truth for auth, rides, drivers, zones, notification attempts,
OTP challenges, and audit trails.

Run the web server and the maintenance worker as separate long-running processes:

```powershell
cd web
npm run dev
npm run maintenance
```

Use the production server command chosen by the VPS process manager for the web
app, and keep `npm run maintenance` running alongside it. Horizontal scaling,
push delivery, and multi-city coordination are intentionally deferred.

## Phase 2: TukTukPass and TukTukSafe

Implemented on `feature/phase-2-tuktukpass-safe`:

- Reversible PostgreSQL schema in migrations `024` and corrective `025`, with
  rollbacks in `web/db/rollbacks`. Phase 2 money uses plain integer rupees to
  match the existing ride schema.
- Passenger pass creation, route-interest, pass detail, pause/resume/cancel,
  payment confirmation, fare calculation, and shared-route detection APIs.
- Driver pass preferences, guaranteed-earnings dashboard, schedule-conflict
  checks, and transaction/row-lock protected pass acceptance.
- Central conflict reporting uses Institution Route > TukTukPass > On-Demand as
  an operational priority, while every assignment still rejects unresolved overlaps.
- Idempotent, `CRON_SECRET`-protected pass/institution generation, reminder,
  no-show, expiry, invoice, and overdue endpoints for VPS crontab.
- Institution-scoped overview, routes, member import, attendance/trip actions,
  guardian tracking tokens, SMS opt-out webhook, invoices/SLA/trial schema, and
  a separate `/institution-admin` console.
- Ops visibility at `/admin-phase2` for driver load, passes, schools, current
  institution trips, and SLA events.
- Mobile logout guards for passenger, driver, and admin role screens.

Phase 2 environment/integration items still pending deployment credentials or
field validation:

- Validate real Razorpay payment-link and refund cycles. Pass and invoice links,
  webhook idempotency, and paid-state transitions are implemented.
- Configure the seven approved Fast2SMS WhatsApp template IDs and phone-number ID,
  then validate guardian delivery and STOP callbacks through `/api/webhooks/fast2sms`.
  WhatsApp automatically falls back to Fast2SMS SMS when delivery setup fails.
- Configure institution-admin users and institution seed data for the first pilot.
- Add R2 invoice PDF generation and transactional email delivery credentials.
- Validate live institution tracking on physical devices with Pusher `ap2`.
- Complete pilot usability QA for CSV member imports, pass location picking,
  school attendance, backup-driver escalation, and invoice payment links.

Phase 2 jobs are deliberately external-cron endpoints, not part of the
high-frequency maintenance loop. Configure `CRON_SECRET` and add these VPS
crontab calls (replace `BASE_URL` and the secret value for the deployment):

```cron
30 5 * * * curl -sf -X POST -H "Authorization: Bearer $CRON_SECRET" $BASE_URL/api/jobs/pass-generate-rides
*/15 * * * * curl -sf -X POST -H "Authorization: Bearer $CRON_SECRET" $BASE_URL/api/jobs/pass-reminders
*/10 * * * * curl -sf -X POST -H "Authorization: Bearer $CRON_SECRET" $BASE_URL/api/jobs/pass-no-show-handler
0 5 * * * curl -sf -X POST -H "Authorization: Bearer $CRON_SECRET" $BASE_URL/api/jobs/pass-auto-resume
59 23 * * * curl -sf -X POST -H "Authorization: Bearer $CRON_SECRET" $BASE_URL/api/jobs/pass-expire
0 6 * * * curl -sf -X POST -H "Authorization: Bearer $CRON_SECRET" $BASE_URL/api/jobs/institution-generate-trips
0 20 * * * curl -sf -X POST -H "Authorization: Bearer $CRON_SECRET" $BASE_URL/api/jobs/institution-evening-reminder
0 19 28-31 * * curl -sf -X POST -H "Authorization: Bearer $CRON_SECRET" $BASE_URL/api/jobs/institution-generate-invoices
0 10 * * * curl -sf -X POST -H "Authorization: Bearer $CRON_SECRET" $BASE_URL/api/jobs/institution-chase-overdue
```

For LAN development over plain HTTP, set `AUTH_URL` to the same origin used in
the browser, for example `http://192.168.1.4:4000`. Cookie security also follows
the actual request protocol in development, so a production HTTPS value cannot
silently force unusable secure cookies on a LAN HTTP session.

## Production Launch Gates

The app currently runs as a lightweight Node/React Router backend. Ride
discovery is polling-based, and cleanup runs in the scheduled maintenance
worker rather than inside request handlers.

Code-complete items that still need environment or field validation:

- Complete real-device E2E testing for passenger, driver, and admin flows.
- Complete HyperVerge live verification once credentials and private endpoint docs are available.
- Configure Pusher Channels in region `ap2` and verify negotiated ride events on
  real devices.
- Verify polling-based ride discovery on the deployed VPS.
- Verify the maintenance worker marks expired drivers offline and cancels timed-out accepted rides.
- Verify mobile push-token registration on physical devices.
- Re-verify logout/back-navigation behavior on real passenger, driver, and admin
  devices after the latest sign-out loop fix.
- Verify the admin and admin-ops charts render after SSR hydration without
  collapsing or producing hydration errors.
- Configure separate web/mobile Sentry DSNs and confirm one test event reaches
  each production project.

Deferred product decisions:

- Push-token registration and basic Expo ride-lifecycle sending are implemented.
  Real-device delivery validation is still required before relying on it.
- Add toll-free/proxy calling so raw passenger and driver phone numbers are never
  exposed to mobile clients. Exotel is wired in code and still needs live
  credentials/validation.
- Add Grafana/OpenTelemetry exporter transport and production alerting after
  provider projects are created. Sentry web/mobile SDK initialization is already
  implemented; project credentials, source-map upload, alerts, and live event
  verification remain.
- Finalize backend no-driver expiry/escalation policy. The UI now warns after
  60 seconds, but server-side cancellation/escalation thresholds still need a
  business decision.

## Project Structure
- `/mobile/src`: Expo application code.
- `/mobile/assets/images/icon.png`: TukTukGo mobile icon/splash artwork.
- `/mobile/assets/animations/auto-motion`: referenced generated motion assets.
- `/web/src/app/api`: Backend server routes.
- `/web/src/app/account`: Web-based authentication pages used by the mobile app.
- `/web/public/tuktukGo.png`: TukTukGo web logo artwork.
- `/web/public/favicon.png`: browser favicon generated from the TukTukGo icon.
- `/web/db/migrations`: PostgreSQL schema migrations.
- `/web/scripts`: Database check/migration/maintenance helper scripts.

## Design Philosophy
This app follows a "High-Fidelity SaaS" design system, focusing on structural clarity through micro-details, ghost borders, and a clean typographic hierarchy.
