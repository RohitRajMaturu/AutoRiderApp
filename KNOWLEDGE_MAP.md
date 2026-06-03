# AutoRide Knowledge Map

Use this document as context for Claude, Codex, or another implementation agent. It describes the current repository shape, active architecture, verified backend behavior, and the next useful implementation areas.

## Project Identity

AutoRide is an India-focused auto-rickshaw ride connection platform.

Core actors:
- Passenger: request rides, choose pickup/drop, adjust pickup on a map, cancel rides, view history.
- Driver: register vehicle/documents, wait for approval, toggle online, accept nearby rides, complete rides.
- Admin: review drivers, inspect ride/admin stats, manage subscription eligibility.

Primary stack:
- Mobile: Expo React Native, Expo Router, TanStack Query, Zustand, SecureStore, AsyncStorage.
- Web/backend: React Router 7 app with server route handlers under `web/src/app/api`.
- Database: PostgreSQL through `pg` / node-postgres.
- Auth: Auth.js credentials flow plus backend `auth(request)` JWT session decoding.
- Maps/location: Ola Maps through backend-only REST calls.

## Repository Layout

```text
.
├── mobile/
│   ├── src/app/                  # Expo Router screens and role route groups
│   ├── src/store/useAppStore.js  # Shared theme, active ride, test mode state
│   ├── src/utils/auth/           # Mobile auth modal, token storage, hooks
│   └── package.json
├── web/
│   ├── db/migrations/            # PostgreSQL schema migrations
│   ├── scripts/                  # DB check/migration helper scripts
│   ├── src/auth.js               # Auth.js JWT cookie/session resolver
│   ├── src/app/api/              # Backend/server route handlers
│   ├── src/app/account/          # Sign in/sign up/logout pages
│   └── package.json
├── README.md
├── PRODUCTION_INTEGRATIONS.md
└── run-local.ps1
```

## Runtime And Verification

Useful commands:

```powershell
.\run-local.ps1
.\run-local.ps1 -SkipInstall
.\run-local.ps1 -ClearExpoCache
cd web; npm run typecheck
cd web; npm run test:api
cd web; npm run db:check
cd web; npm run db:migrate
```

`run-local.ps1` starts the web backend and Expo app, setting mobile API env vars such as `EXPO_PUBLIC_BASE_URL`, `EXPO_PUBLIC_APP_URL`, and `EXPO_PUBLIC_PROXY_BASE_URL`.

## Environment

Backend-only secrets and controls:
- `DATABASE_URL`: PostgreSQL connection string.
- `AUTH_SECRET`: Auth.js JWT/session secret.
- `OLAMAPS_API_KEY`: Ola Maps key. Never expose this in the Expo bundle.
- `ENABLE_ADMIN_SETUP`: set to `true` only during local/bootstrap setup. The route is hard-disabled in production.
- `DRIVER_RIDE_RADIUS_KM`: nearby ride discovery radius, default `8`, allowed `1..50`.
- `DRIVER_LOCATION_MAX_AGE_MINUTES`: driver coordinate freshness window, default `10`, allowed `1..240`.
- `RATE_LIMIT_MAX_REQUESTS`: API requests per method/path/IP window, default `120`; set `0` to disable locally.
- `RATE_LIMIT_WINDOW_MS`: rate-limit window, default `60000`.

## Database State

Current schema tooling:
- Migrations live in `web/db/migrations`.
- Apply migrations with `cd web; npm run db:migrate`.
- Verify tables with `cd web; npm run db:check`.
- Optional `psql` helper: `web/scripts/apply-schema.ps1`.

Main tables:
- `auth_users`
- `auth_accounts`
- `auth_sessions`
- `auth_verification_tokens`
- `drivers`
- `rides`

The domain schema includes driver approval/online state, subscription expiry, last known driver coordinates, passenger/driver ride ownership, status timestamps, provider place IDs, route distance/duration/fare metadata, and route polyline/provider fields.

## Mobile Architecture

Routing is Expo Router based:
- `mobile/src/app/index.jsx`: landing screen, auth redirect, test mode role picker.
- `mobile/src/app/_layout.jsx`: TanStack Query provider, splash handling, auth modal, route stacks.
- `mobile/src/app/(passenger)/`: passenger home/profile/rides tabs.
- `mobile/src/app/(driver)/`: driver dashboard/profile/wallet tabs.
- `mobile/src/app/(admin)/`: admin dashboard/drivers/rides tabs.

Auth and API behavior:
- Mobile stores auth as `{ jwt, user }` in SecureStore under `auto-ride-auth`.
- `/api/auth/token` returns `{ jwt, user, auth }`.
- Mobile fetch helpers attach the stored JWT as a bearer token for backend API calls.
- Test mode persists with `@autoconnect_test_mode` and `@autoconnect_test_role`; it is useful for demos but can hide real auth/backend failures.

Passenger location behavior:
- Current location and reverse-geocode calls have timeouts so pickup detection does not hang indefinitely.
- Autocomplete, place details, reverse geocode, and route estimate all go through backend `/api/locations/*` and `/api/routes/estimate`.
- Native mobile shows pickup/destination map pins and supports dragging pickup; mobile does not call Ola Maps directly.

## Backend/API Architecture

API handlers live under `web/src/app/api`.

Database utility:
- `web/src/app/api/utils/sql.js` uses `pg.Pool` with `process.env.DATABASE_URL`.
- The local `sql\`...\`` tagged-template style is preserved.
- `sql.transaction(async (tx) => { ... })` now runs a real PostgreSQL transaction with `BEGIN`, `COMMIT`, and `ROLLBACK`.

Auth utility:
- `web/src/auth.js` decodes Auth.js JWT cookies with `@auth/core/jwt`.
- It loads the current user from `auth_users`.
- Protected route handlers call `auth(request)`.
- It returns `{ user: { id, email, phone, role, name, image } }` or `null`.

Server controls:
- API body size is limited for write methods.
- API rate limiting is enabled for `/api/*`.
- Security headers are added globally: content-type sniffing protection, referrer policy, frame policy, and a restricted permissions policy.

Major API groups:
- `POST/GET /api/rides`
- `GET/PATCH /api/rides/:id`
- `POST/GET /api/drivers`
- `PATCH /api/drivers/status`
- `GET/PATCH /api/admin/drivers`
- `GET /api/admin/rides`
- `GET /api/admin/stats`
- `POST /api/admin/setup`
- `GET/PUT /api/user-profile`
- `GET /api/locations/autocomplete`
- `GET /api/locations/place/:placeId`
- `GET /api/locations/place?placeId=...`
- `GET /api/locations/reverse`
- `GET /api/routes/estimate`
- `GET /api/auth/token`

## Domain Flows

Passenger ride request:
1. Mobile resolves pickup and destination through backend location endpoints.
2. Native map pins allow pickup adjustment without exposing provider keys.
3. `POST /api/rides` validates addresses and coordinates, prevents duplicate active rides, stores optional place IDs, and stores route estimate metadata.
4. Passenger polls `/api/rides` for active status.
5. Passenger cancels through `PATCH /api/rides/:id` with `{ action: "cancel" }`.

Driver ride handling:
1. Approved driver toggles online via `PATCH /api/drivers/status`.
2. Backend requires active subscription before online status is allowed.
3. Driver coordinates are stored from device location when available.
4. Driver ride feed returns assigned rides plus nearby unassigned requested rides only when the driver's coordinates are fresh.
5. Driver accepts through `{ action: "accept" }` and completes through `{ action: "complete" }`.

Admin:
1. Admin dashboard calls `/api/admin/stats` and `/api/admin/drivers`.
2. Driver review uses `PATCH /api/admin/drivers`.
3. Admin setup is local/bootstrap only: it requires `ENABLE_ADMIN_SETUP=true`, is blocked once any admin exists, and is unavailable when `NODE_ENV=production`.

## Maps, Places, And Fare Logic

Location provider code is in `web/src/app/api/utils/locations.js`.

Provider behavior:
- With `OLAMAPS_API_KEY`, backend calls Ola Maps REST APIs.
- Without a key or when the provider fails, backend returns configurable local fallback data.
- Route estimation calls Ola Directions with `mode: "auto"` for auto-rickshaw routing.
- Provider query endpoints validate bounded strings and coordinate ranges before calling the utility.

Fare metadata:
- Server formula: `35 + distanceKm * 18`.
- Currency: `INR`.
- `/api/routes/estimate` returns `distanceKm`, `durationMins`, `estimatedFare`, `polyline`, `provider`, and `currency`.
- `POST /api/rides` stores fare/route metadata for future use.
- Passenger-facing fare, ETA, and surge UI are intentionally not enabled yet.

## Test Coverage

Focused API tests live under `web/src/app/api/__tests__`.

Current coverage:
- Auth session resolution and missing-token behavior.
- Ride detail authorization and cancel conflict behavior.
- Admin driver update validation, admin-only access, and missing-row handling.
- Driver nearby ride filtering radius and location freshness behavior.

Run with:

```powershell
cd web
npm run test:api
```

## Remaining Work

High-value next tasks:
- Manually confirm WebView sign-in and bearer-token API calls across Expo Go and device builds.
- Add passenger fare/ETA preview if the product decision changes.
- Add payment-backed driver subscription renewal with verified webhooks.
- Add Expo push notifications for ride requested, accepted, cancelled, and completed.
- Add observability, structured audit logging, privacy policy, and location retention rules.
- Continue expanding lower-risk validation and tests as new provider/admin/payment routes are added.

## Implementation Hotspots

When changing auth:
- Start with `web/src/auth.js`, account pages under `web/src/app/account`, and Auth.js configuration in `web/__create/index.ts`.
- Keep `/api/auth/token` aligned with mobile SecureStore shape.
- Ensure protected API handlers call `auth(request)`.

When changing database schema:
- Add new SQL files under `web/db/migrations`.
- Run `cd web; npm run db:migrate`.
- Verify with `cd web; npm run db:check`.
- Keep indexes aligned with passenger, driver, and admin query patterns.

When changing maps/location:
- Keep mobile calling backend endpoints, never Ola Maps directly.
- Reuse `/api/locations/*` and `/api/routes/estimate`.
- Store normalized coordinates and optional provider place IDs.
- Keep fallback behavior stable so local mobile testing does not crash when the provider is down.

When adding payments:
- Backend should own subscription creation and webhook verification.
- Update `drivers.subscription_expiry` only from trusted payment state.
- Keep `/api/drivers/status` as the final online eligibility gate.

When adding notifications:
- Add a device push-token table keyed by user/device.
- Mobile should register and refresh Expo push tokens.
- Backend should send notifications from ride lifecycle events.
