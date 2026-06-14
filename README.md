# AutoConnect - Ride Connection Platform

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

### 3. Environment Variables
The platform handles core environment variables like `DATABASE_URL`.

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
```

FAST2SMS_API_KEY is required for phone OTP on signup and signin. Without it, OTP requests will silently fail. Get a key at fast2sms.com. CORS_ORIGINS should be set to your deployed web domain(s) in production; omitting it disables CORS validation, which is acceptable only for local development.

Before deploying rating support, run `006_ride_ratings.sql` on your production Postgres. Otherwise completed rides will 500 on the rating endpoint.

Ride matching uses admin-managed PostGIS service zones. Run `npm run db:migrate`,
then create at least one active zone from the Admin Zones tab before testing new
passenger requests or driver online status.

The mobile app does not call Ola Maps directly. Expo screens call backend routes under `/api/locations/*` and `/api/routes/estimate`, keeping the provider key out of the client bundle.

Mobile auth stores `{ jwt, user }` in SecureStore under the stable key `auto-ride-auth`. `/api/auth/token` returns this shape after WebView sign-in, and mobile API calls send the JWT as a bearer token.

Backend `/api/*` routes include basic rate limiting and security headers. Set `RATE_LIMIT_MAX_REQUESTS=0` only for local debugging.

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

## Backend Verification

```powershell
cd web
npm run typecheck
npm run test:api
npm run db:check
```

Focused API tests cover auth resolution, ride authorization conflicts, admin driver validation, and nearby driver filtering.

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
- Verify polling-based ride discovery on the deployed VPS.
- Verify the maintenance worker marks expired drivers offline and cancels timed-out accepted rides.
- Replace GeoJSON polygon import with map-based polygon drawing/editing when operations need visual zone editing.
- Add push notifications only when the pilot needs out-of-app ride alerts.

## Project Structure
- `/mobile/src`: Expo application code.
- `/web/src/app/api`: Backend server routes.
- `/web/src/app/account`: Web-based authentication pages used by the mobile app.
- `/web/db/migrations`: PostgreSQL schema migrations.
- `/web/scripts`: Database check/migration/maintenance helper scripts.

## Design Philosophy
This app follows a "High-Fidelity SaaS" design system, focusing on structural clarity through micro-details, ghost borders, and a clean typographic hierarchy.
