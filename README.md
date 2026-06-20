# TukTukGo - Ride Connection Platform

A lightweight auto-rickshaw ride connection platform for India.

## Tech Stack
- **Frontend**: React Native (Expo)
- **Backend**: React Router server routes on Node.js
- **Database**: PostgreSQL via `pg` / node-postgres
- **Authentication**: Auth.js credentials flow with role-based onboarding
- **Maps/Location Provider**: Ola Maps (Krutrim Cloud) via backend-only REST integration

## Core Features
- **Passengers**: Request rides, adjust pickup on a native map, see driver details, track ride history.
- **Drivers**: Register vehicle/license, toggle online/offline status, accept nearby rides.
- **Admin**: Approve/Reject driver applications, manage subscriptions.
- **Subscription Model**: Drivers need an active subscription to go online.

## Getting Started

### 1. Database Setup
Create the required Postgres tables from the checked-in migration:

```powershell
cd web
npm run db:migrate
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

### 2. Admin Setup
To become an admin for testing:
1. Temporarily set `ENABLE_ADMIN_SETUP=true` in the web environment.
2. Optionally set `ADMIN_SETUP_PHONES=919999999999` to restrict admin creation to your real phone number.
3. Tap `Continue as Admin` from the mobile welcome screen.
4. Create the account with your real phone number, email, and password.
5. After setup, use normal sign-in with that phone number or email.
6. Remove `ENABLE_ADMIN_SETUP` before production. The route is blocked once an admin exists.

The setup route is also hard-disabled when `NODE_ENV=production`.

### Test Accounts
Seeded test users from `web/scripts/seed-test-users.mjs` use temporary password `12345` after running `007_seed_account_passwords.sql`:
- Admin: `admin7893725929@autoride.test` or phone `7893725929`
- Passenger: `passenger9908027984@autoride.test` or phone `9908027984`
- Driver: `driver9885553312@autoride.test` or phone `9885553312`

### 3. Environment Variables
The platform handles core environment variables like `DATABASE_URL`.
Copy `web/.env.example` to `web/.env` and fill in real values.

For production-grade location search and routing, configure the backend with:

```env
AUTH_SECRET=replace_with_a_long_random_secret
OLAMAPS_API_KEY=your_ola_maps_api_key
ENABLE_ADMIN_SETUP=true
ADMIN_SETUP_PHONES=919999999999
PASSENGER_REQUEST_COOLDOWN_SECONDS=30
PASSENGER_POST_CANCEL_COOLDOWN_SECONDS=60
DRIVER_HEARTBEAT_TIMEOUT_SECONDS=120
ACCEPTED_RIDE_TIMEOUT_MINUTES=45
MAINTENANCE_INTERVAL_SECONDS=30
EXPO_PUBLIC_SUPPORT_PHONE=91XXXXXXXXXX
EXPO_PUBLIC_GUIDELINES_URL=https://your-guidelines-url
EXPO_PUBLIC_PRIVACY_URL=https://your-privacy-url
NEXT_PUBLIC_APP_DOWNLOAD_URL=https://your-app-store-link
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
UPLOAD_SIGNED_URL_TTL_SECONDS=3600
```

FAST2SMS_API_KEY is required for phone OTP on signup and signin. Without it, OTP requests will silently fail. Get a key at fast2sms.com. CORS_ORIGINS should be set to your deployed web domain(s) in production; omitting it disables CORS validation, which is acceptable only for local development.

Before deploying rating support, run `006_ride_ratings.sql` on your production Postgres. Otherwise completed rides will 500 on the rating endpoint.

Ride matching uses admin-managed PostGIS service zones. Run `npm run db:migrate`,
then create at least one active zone from the Admin Zones tab before testing new
passenger requests or driver online status.

The mobile app does not call Ola Maps directly. Expo screens call backend routes under `/api/locations/*` and `/api/routes/estimate`, keeping the provider key out of the client bundle.

Mobile auth stores `{ jwt, user }` in SecureStore under the stable key `auto-ride-auth`. `/api/auth/token` returns this shape after WebView sign-in, and mobile API calls send the JWT as a bearer token.

Mobile role screens are guarded after logout. If a user signs out and then uses the device back button, passenger, driver, and admin route groups redirect back to the welcome/login screen instead of showing the previous logged-in role UI.

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

## Completed Backend Location Work

- Server-side Ola Maps autocomplete through `GET /api/locations/autocomplete`.
- Server-side Ola Maps place details through `GET /api/locations/place/:placeId` and `GET /api/locations/place?placeId=...`.
- Server-side Ola Maps reverse geocoding through `GET /api/locations/reverse`.
- Auto-rickshaw route estimation through `GET /api/routes/estimate` using Ola routing mode `auto`.
- Route metadata is stored when rides are created so fare/ETA can be shown later.
- Fare calculation exists server-side as base fare INR 35 plus INR 18 per kilometer, but passenger-facing fare/surge UI is intentionally not enabled yet.
- Native mobile ride request screen shows pickup/destination pins and supports drag-to-adjust pickup without exposing Ola Maps keys.
- Configurable local fallback data for development when Ola Maps is unavailable or `OLAMAPS_API_KEY` is not configured.

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

## Pending Driver KYC Work

The KYC system is structurally complete, but live HyperVerge verification still needs credentials and sandbox validation:

- Add real `HYPERVERGE_APP_ID` and `HYPERVERGE_APP_KEY` values to the deployed web environment.
- Set the deployed HyperVerge endpoint URLs if they differ from the shared defaults in `web/.env.example`.
- Run sandbox KYC submissions end-to-end once credentials and confirmed endpoints are available.
- Verify that full Aadhaar never appears in logs, DB rows, or vendor raw results after sandbox testing.

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
- Full storyboard, timing, Lottie, Rive, theme, and implementation guide: `docs/MOTION_SYSTEM.md`.

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
  Api --> Maintenance[Maintenance worker]
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

## Pending Production Work

The app currently runs as a lightweight Node/React Router backend. Ride
discovery is polling-based, and cleanup runs in the scheduled maintenance
worker rather than inside request handlers.

Pending items:

- Complete real-device E2E testing for passenger, driver, and admin flows.
- Complete HyperVerge live verification once credentials and private endpoint docs are available.
- Verify polling-based ride discovery on the deployed VPS.
- Verify the maintenance worker marks expired drivers offline and cancels timed-out accepted rides.
- Replace GeoJSON polygon import with map-based polygon drawing/editing when operations need visual zone editing.
- Add push notifications only when the pilot needs out-of-app ride alerts.

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
