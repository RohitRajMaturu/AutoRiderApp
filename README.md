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
1. Sign up as a regular user in the app.
2. Temporarily set `ENABLE_ADMIN_SETUP=true` in the backend environment.
3. Call the setup endpoint: `POST /api/admin/setup`.
4. Remove `ENABLE_ADMIN_SETUP` before production. The route is blocked once an admin exists.
5. Restart the app to see the Admin Panel.

The setup route is also hard-disabled when `NODE_ENV=production`.

### 3. Environment Variables
The platform handles core environment variables like `DATABASE_URL`.

For production-grade location search and routing, configure the backend with:

```env
AUTH_SECRET=replace_with_a_long_random_secret
OLAMAPS_API_KEY=your_ola_maps_api_key
DRIVER_RIDE_RADIUS_KM=8
DRIVER_LOCATION_MAX_AGE_MINUTES=10
RATE_LIMIT_MAX_REQUESTS=120
RATE_LIMIT_WINDOW_MS=60000
```

The mobile app does not call Ola Maps directly. Expo screens call backend routes under `/api/locations/*` and `/api/routes/estimate`, keeping the provider key out of the client bundle.

Mobile auth stores `{ jwt, user }` in SecureStore under the stable key `auto-ride-auth`. `/api/auth/token` returns this shape after WebView sign-in, and mobile API calls send the JWT as a bearer token.

Backend `/api/*` routes include basic rate limiting and security headers. Set `RATE_LIMIT_MAX_REQUESTS=0` only for local debugging.

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

## Project Structure
- `/mobile/src`: Expo application code.
- `/web/src/app/api`: Backend server routes.
- `/web/src/app/account`: Web-based authentication pages used by the mobile app.
- `/web/db/migrations`: PostgreSQL schema migrations.
- `/web/scripts`: Database check/migration helper scripts.

## Design Philosophy
This app follows a "High-Fidelity SaaS" design system, focusing on structural clarity through micro-details, ghost borders, and a clean typographic hierarchy.
