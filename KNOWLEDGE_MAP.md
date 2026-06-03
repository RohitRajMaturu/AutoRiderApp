# AutoConnect Knowledge Map

Use this document as context for Claude, Codex, or another implementation agent. It summarizes the current repository shape, architectural decisions, implementation hotspots, known gaps, and high-value next tasks.

## Project Identity

AutoConnect is a lightweight India-focused auto-rickshaw ride connection platform.

Core actors:
- Passenger: request rides, choose pickup/drop, see active ride, cancel, view history.
- Driver: register vehicle/documents, wait for approval, toggle online, accept and complete rides.
- Admin: review drivers, inspect ride/admin stats, manage subscriptions conceptually.

Primary stack:
- Mobile: Expo React Native, Expo Router, TanStack Query, Zustand, SecureStore, AsyncStorage.
- Web/backend: React Router 7 app with server route handlers under `web/src/app/api`.
- Database: PostgreSQL through `pg` / node-postgres.
- Maps/location: Ola Maps (Krutrim Cloud) through backend-only REST calls.
- Auth: intended Auth.js/custom flow, but currently incomplete.

## Repository Layout

```text
.
├── mobile/                       # Expo app
│   ├── src/app/                  # Expo Router screens and role route groups
│   ├── src/store/useAppStore.js  # Shared theme, active ride, test mode state
│   ├── src/utils/auth/           # Mobile auth modal, token storage, hooks
│   └── package.json
├── web/                          # React Router app plus API routes
│   ├── db/migrations/            # PostgreSQL schema migrations
│   ├── scripts/                  # DB check/migration helper scripts
│   ├── src/auth.js               # Current auth shim; returns null
│   ├── src/app/api/              # Backend/server route handlers
│   ├── src/app/account/          # Sign in/sign up/logout pages
│   └── package.json
├── README.md
├── PRODUCTION_INTEGRATIONS.md
└── run-local.ps1
```

## Runtime And Local Development

`run-local.ps1` is the intended local launcher:
- Installs `web` and `mobile` dependencies if `node_modules` is missing.
- Starts the web backend with `npm run dev` from `web/`.
- Starts Expo Go from `mobile/`.
- Sets mobile env variables such as `EXPO_PUBLIC_BASE_URL`, `EXPO_PUBLIC_APP_URL`, and `EXPO_PUBLIC_PROXY_BASE_URL` to the LAN backend URL.

Useful commands:

```powershell
.\run-local.ps1
.\run-local.ps1 -SkipInstall
.\run-local.ps1 -ClearExpoCache
cd web; npm run typecheck
cd web; npm run db:check
cd web; npm run db:migrate
```

## Database State

Database URL format:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DB_NAME?sslmode=disable
```

Current local DB status verified with `npm run db:check`:
- Connected: yes.
- Driver: `pg`.
- Database: `AutoRider`.
- User: `postgres`.
- Missing required tables: none.

Schema tooling:
- Migration file: `web/db/migrations/001_init_autoconnect.sql`.
- Check command: `cd web; npm run db:check`.
- Apply command: `cd web; npm run db:migrate`.
- Optional `psql` helper: `web/scripts/apply-schema.ps1`.

Required tables now created:
- `auth_users`
- `auth_accounts`
- `auth_sessions`
- `auth_verification_tokens`
- `drivers`
- `rides`

## Mobile Architecture

Routing is Expo Router based:
- `mobile/src/app/index.jsx`: landing screen, auth redirect, test mode role picker.
- `mobile/src/app/_layout.jsx`: TanStack Query provider, splash handling, auth modal, route stacks.
- `mobile/src/app/(passenger)/`: passenger home/profile/rides tabs.
- `mobile/src/app/(driver)/`: driver dashboard/profile/wallet tabs.
- `mobile/src/app/(admin)/`: admin dashboard/drivers/rides tabs.

State and data fetching:
- `mobile/src/store/useAppStore.js` uses Zustand.
- Global store contains theme values, cached driver location, active ride, driver online flag, and persisted test mode role.
- TanStack Query is used for API polling and mutation invalidation.

Auth:
- `mobile/src/utils/auth/useAuth.js` loads auth state from Expo SecureStore.
- A 3-second race prevents blank screens if SecureStore hangs or throws.
- Auth UI is driven through `useAuthModal` and web account pages.

Important mobile behavior:
- Test mode is persisted in AsyncStorage with `@autoconnect_test_mode` and `@autoconnect_test_role`.
- Test mode routes directly into passenger, driver, or admin screens without real backend auth.
- Mobile fetch is wrapped by `mobile/src/__create/fetch.ts`, so relative `/api/...` calls are forwarded to `EXPO_PUBLIC_BASE_URL`.
- Mobile does not receive the Ola Maps API key.

## Backend/API Architecture

API handlers live under `web/src/app/api`.

Database utility:
- `web/src/app/api/utils/sql.js`
- Uses `pg.Pool` with `process.env.DATABASE_URL`.
- Preserves the local `sql\`...\`` tagged template style used by existing route handlers.

Auth utility:
- `web/src/auth.js`
- Current implementation:

```js
export async function auth() {
  return null;
}
```

This is the central blocker for real protected API flows. Most protected routes call `auth()` and return `401` when it returns null.

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

## Current Data Model

The current migration creates these main domain tables.

`auth_users`
- `id`
- `name`
- `email`
- `phone`
- `role`: `passenger`, `driver`, or `admin`
- `emailVerified`
- `image`
- `created_at`
- `updated_at`

`drivers`
- `id`
- `user_id`
- `vehicle_number`
- `auto_photo_url`
- `license_url`
- `is_approved`
- `is_online`
- `last_lat`
- `last_lng`
- `subscription_expiry`
- `created_at`
- `updated_at`

`rides`
- `id`
- `passenger_id`
- `driver_id`
- `pickup_address`
- `pickup_place_id`
- `pickup_lat`
- `pickup_lng`
- `dest_address`
- `dest_place_id`
- `dest_lat`
- `dest_lng`
- `distance_km`
- `duration_mins`
- `estimated_fare`
- `route_polyline`
- `route_provider`
- `status`: `requested`, `accepted`, `completed`, or `cancelled`
- `accepted_at`
- `completed_at`
- `cancelled_at`
- `created_at`
- `updated_at`

Auth support tables:
- `auth_accounts`
- `auth_sessions`
- `auth_verification_tokens`

## Key Domain Flows

Passenger ride request:
1. `mobile/src/app/(passenger)/index.jsx` attempts to load current location through `expo-location`.
2. GPS and reverse-geocode calls have timeouts so the UI does not stay stuck on detection.
3. Pickup/destination autocomplete calls `/api/locations/autocomplete`.
4. Place selection may call `/api/locations/place/:placeId`.
5. Passenger submits `POST /api/rides` with addresses and resolved coordinates.
6. Passenger polls `/api/rides` every 6 seconds for active ride status.
7. Passenger cancels through `PATCH /api/rides/:id` with `{ action: "cancel" }`.

Driver onboarding:
1. Driver home calls `GET /api/drivers`.
2. If no driver row exists, mobile shows registration.
3. Registration submits `POST /api/drivers`.
4. Backend inserts driver and sets `auth_users.role = 'driver'`.
5. Driver waits until admin sets `is_approved = true`.

Driver ride handling:
1. Approved driver toggles online via `PATCH /api/drivers/status`.
2. Mobile uses device coordinates when permission is available.
3. Backend blocks online status if `subscription_expiry` is missing or expired.
4. Online driver polls `/api/rides` every 5 seconds.
5. Driver accepts through `PATCH /api/rides/:id` with `{ action: "accept" }`.
6. The accept query only succeeds when ride is still `requested` and `driver_id IS NULL`.
7. Driver completes through `{ action: "complete" }`.

Admin:
1. Admin dashboard calls `/api/admin/stats` and `/api/admin/drivers`.
2. Admin driver review uses `PATCH /api/admin/drivers`.
3. `POST /api/admin/setup` upgrades the current user to admin and should not exist in production.

## Maps, Places, And Fare Logic

Location provider code is in `web/src/app/api/utils/locations.js`.

Provider selection:
- If `OLAMAPS_API_KEY` exists, backend calls Ola Maps APIs.
- If the provider is unavailable, backend returns configurable local fallback data.
- For typed autocomplete in fallback mode, backend still returns a selectable suggestion instead of an empty list.

Implemented capabilities:
- Autocomplete: Ola Maps Places Autocomplete or local fallback.
- Place details: Ola Maps Place Details or local fallback.
- Reverse geocode: Ola Maps Reverse Geocode or local coordinate label.
- Route estimate: Ola Maps Directions with `mode: "auto"` or local haversine fallback.

Fare estimate:
- Formula: `35 + distanceKm * 18`.
- Currency: `INR`.
- `/api/routes/estimate` returns `distanceKm`, `durationMins`, `estimatedFare`, `polyline`, `provider`, and `currency`.

Verified provider status:
- A live Ola Maps autocomplete request with the key in `web/.env` returned HTTP `200` and 5 predictions.

## Known Gaps And Risks

Highest priority:
- `web/src/auth.js` returns `null`; protected APIs cannot work with real sessions until this is implemented.
- Admin setup route is unsafe for production and should be gated or removed.
- Several backend routes trust input without validation beyond basic presence checks.
- `GET /api/rides/:id` does not require auth, so ride details may be exposed by ID.

Backend correctness:
- `PATCH /api/admin/drivers` builds a SQL string for `subscription_days`; validate and clamp this value before using it in an interval.
- `complete` and `cancel` ride actions can return `{ ride: undefined }` without a non-2xx error if no row is updated.
- Driver ride feed currently shows all unassigned requested rides, not geographically nearby rides.

Mobile experience:
- Route/fare estimate endpoint exists, but passenger request flow does not yet show fare/ETA before submitting.
- UI files contain some mojibake/encoding artifacts in comments and emoji text. Avoid spreading this when editing.
- Test mode is useful for demos but can hide auth/backend integration problems.

Production readiness:
- Payments/subscriptions need Razorpay/Cashfree/Stripe integration plus verified webhooks.
- Push notifications need token storage, refresh handling, and backend send workflow.
- Observability, rate limiting, privacy policy, and location retention are not implemented.
- Secrets should stay backend-only; do not expose unrestricted maps/payment keys in the mobile bundle.

## Implementation Hotspots

When adding auth:
- Start with `web/src/auth.js`.
- Check `web/src/app/account/signin/page.jsx` and `signup/page.jsx`.
- Align `/api/auth/token` with the mobile SecureStore format expected by `mobile/src/utils/auth/store.js`.
- Make sure `auth()` returns `{ user: { id, email, role? } }` or update every dependent route.

When changing database schema:
- Add new SQL files under `web/db/migrations`.
- Run `cd web; npm run db:migrate`.
- Verify with `cd web; npm run db:check`.
- Keep indexes aligned with passenger, driver, and admin query patterns.

When adding map UI:
- Keep mobile calling backend endpoints, not Ola Maps directly.
- Use existing `/api/locations/*` and `/api/routes/estimate`.
- Store normalized coordinates and optional provider place IDs.
- Add map pins and drag-to-adjust pickup without leaking provider secrets.

When adding payments:
- Backend should own subscription creation and webhook verification.
- Update `drivers.subscription_expiry` only from trusted payment state.
- Keep `/api/drivers/status` as the final online eligibility gate.

When adding notifications:
- Add device push token table keyed by user/device.
- Mobile registers/refreshes Expo push tokens.
- Backend sends events on ride requested, accepted, cancelled, completed.

## Agent Prompt Seeds

Use these prompts with another agent after attaching this knowledge map.

Auth implementation:
```text
Using KNOWLEDGE_MAP.md as context, implement real auth for this app. Start by replacing web/src/auth.js so protected API routes receive a valid session with user.id. Inspect the existing account pages and mobile auth utilities first. Keep changes minimal, preserve test mode, and add focused verification steps.
```

Database change:
```text
Using KNOWLEDGE_MAP.md as context, add the next PostgreSQL migration under web/db/migrations. Preserve the existing pg-based scripts, update README if setup changes, run npm run db:migrate, and verify with npm run db:check.
```

Passenger fare preview:
```text
Using KNOWLEDGE_MAP.md as context, add fare and ETA preview to the passenger request screen. Reuse /api/routes/estimate, debounce coordinate changes, show loading/error states, and submit ride only after pickup/destination coordinates are resolved.
```

Nearby driver matching:
```text
Using KNOWLEDGE_MAP.md as context, improve driver ride discovery so online drivers only see nearby unassigned rides. Add backend distance filtering first, then update the driver UI copy and query behavior. Avoid exposing provider keys to mobile.
```

Admin hardening:
```text
Using KNOWLEDGE_MAP.md as context, harden admin operations. Require auth on every admin route, remove or gate /api/admin/setup, validate PATCH /api/admin/drivers input, and return explicit errors when no rows update.
```

Production maps:
```text
Using KNOWLEDGE_MAP.md and PRODUCTION_INTEGRATIONS.md as context, improve Ola Maps integration end to end. Keep API keys server-side, reuse the existing provider adapter, add map UI pins on mobile, and persist place IDs and route estimate metadata.
```

Notifications:
```text
Using KNOWLEDGE_MAP.md as context, add Expo push notifications for ride requested, accepted, cancelled, and completed. Include token registration, backend storage, stale token cleanup, and minimal notification preferences.
```

## Suggested Implementation Order

1. Implement real auth/session handling.
2. Harden protected routes and row-level access.
3. Add fare/ETA preview using existing route estimate endpoint.
4. Add nearby ride filtering and real driver location updates.
5. Add payment-backed subscription renewal.
6. Add notifications.
7. Add observability, rate limits, and production security cleanup.

