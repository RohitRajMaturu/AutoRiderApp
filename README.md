# AutoConnect - Ride Connection Platform

A lightweight auto-rickshaw ride connection platform for India.

## Tech Stack
- **Frontend**: React Native (Expo)
- **Backend**: React Router server routes on Node.js plus FastAPI realtime backend
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
PASSENGER_REQUEST_COOLDOWN_SECONDS=30
PASSENGER_POST_CANCEL_COOLDOWN_SECONDS=60
DRIVER_HEARTBEAT_TIMEOUT_SECONDS=120
ACCEPTED_RIDE_TIMEOUT_MINUTES=45
RATE_LIMIT_MAX_REQUESTS=120
RATE_LIMIT_WINDOW_MS=60000
```

Ride matching uses admin-managed PostGIS service zones. Run `npm run db:migrate`,
then create at least one active zone from the Admin Zones tab before testing new
passenger requests or driver online status.

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

## FastAPI Realtime Backend

The production realtime backend lives in `/backend`. Deploy it on a single
always-on VPS while the product is single-city/single-region:

```powershell
cd backend
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1
```

Use `--workers 1` intentionally. Active WebSocket connections are stored in
in-memory Python dictionaries, so multiple workers would split connection state.
PostgreSQL remains the durable source of truth for rides, drivers, tokens,
zones, notification attempts, OTP challenges, and audit trails.

Configure the mobile app with the FastAPI WebSocket URL:

```env
EXPO_PUBLIC_REALTIME_WS_URL=wss://your-api.example.com
```

The current bridge is:
- Existing Node/Auth.js session issues short-lived realtime tokens through
  `POST /api/auth/realtime-token`.
- FastAPI validates those opaque tokens against PostgreSQL.
- Driver WebSocket reconnect replays pending ride requests.
- Driver heartbeat and ride timeout maintenance run as in-process asyncio tasks.
- MSG91 OTP and transactional SMS hooks are present and activated by environment
  variables.

Horizontal scaling is intentionally deferred. When multi-city expansion requires
multiple backend instances, add Redis/pub-sub or an equivalent broker to sync
WebSocket delivery state across instances.

## Pending Production Work

The app currently runs as a hybrid backend: existing Node/React Router API routes
continue to serve stable auth, admin, location, and REST flows, while FastAPI
handles realtime WebSocket, heartbeat, OTP groundwork, MSG91 hooks, and
in-process maintenance.

Pending items:

- Add real MSG91 template IDs/auth key in backend environment and test OTP/SMS on approved MSG91 templates.
- Decide whether to keep hybrid backend or gradually migrate existing Node API routes to FastAPI.
- If migrating to FastAPI, move endpoints in phases: rides first, admin second, locations third, auth last.
- Complete real-device E2E testing for passenger, driver, and admin flows.
- Verify WebSocket ride alert delivery on the deployed VPS with `--workers 1`.
- Verify driver reconnect replay after app background/foreground and network drops.
- Verify SMS fallback when driver WebSocket is unavailable.
- Verify passenger ride-accepted fallback SMS after WebSocket delivery failure.
- Replace rectangle-only zone creation with polygon drawing/editing when operations need non-rectangular service areas.
- Add production observability for ride dispatch, WebSocket disconnects, MSG91 failures, and maintenance actions.
- Update Neon/Postgres SSL mode if needed to remove the `sslmode=require` driver warning.
- Add Redis/pub-sub only when horizontal scaling or multi-city deployment requires multiple backend instances.

## Project Structure
- `/mobile/src`: Expo application code.
- `/backend/app`: FastAPI realtime, heartbeat, OTP, MSG91, and WebSocket service.
- `/web/src/app/api`: Backend server routes.
- `/web/src/app/account`: Web-based authentication pages used by the mobile app.
- `/web/db/migrations`: PostgreSQL schema migrations.
- `/web/scripts`: Database check/migration helper scripts.

## Design Philosophy
This app follows a "High-Fidelity SaaS" design system, focusing on structural clarity through micro-details, ghost borders, and a clean typographic hierarchy.
