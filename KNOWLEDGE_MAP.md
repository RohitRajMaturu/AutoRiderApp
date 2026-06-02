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
- Database: Neon PostgreSQL through `@neondatabase/serverless`.
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
│   ├── src/auth.js               # Current auth shim; returns null
│   ├── src/app/api/              # Backend/server route handlers
│   ├── src/app/account/          # Sign in/sign up/logout pages
│   └── package.json
├── README.md
├── PRODUCTION_INTEGRATIONS.md    # Production backlog and integration notes
└── run-local.ps1                 # Starts web backend and Expo with LAN env vars
```

Note: `README.md` mentions `/apps/mobile` and `/apps/web`; the actual folders are `mobile/` and `web/`.

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
```

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
- Real API calls still require backend auth and may fail while in test mode.

## Backend/API Architecture

API handlers live under `web/src/app/api`.

Database utility:
- `web/src/app/api/utils/sql.js`
- Uses `neon(process.env.DATABASE_URL)`.
- Throws a clear error if `DATABASE_URL` is missing.

Auth utility:
- `web/src/auth.js`
- Current implementation:

```js
export async function auth() {
  return null;
}
```

This is the central blocker for real protected API flows. Most routes call `auth()` and return `401` when it returns null.

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
- `GET /api/locations/reverse`
- `GET /api/routes/estimate`
- `GET /api/auth/token`

## Current Data Model Assumptions

The code assumes these PostgreSQL tables and fields exist:

`auth_users`
- `id`
- `email`
- `phone`
- `role` with expected values such as `passenger`, `driver`, `admin`

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

`rides`
- `id`
- `passenger_id`
- `driver_id`
- `pickup_lat`
- `pickup_lng`
- `dest_lat`
- `dest_lng`
- `pickup_address`
- `dest_address`
- `status`: `requested`, `accepted`, `completed`, `cancelled`
- `accepted_at`
- `completed_at`
- `created_at`

Production integration notes also recommend adding:
- `pickup_place_id`
- `dest_place_id`
- route distance/duration/fare/provider metadata
- versioned migrations and indexes

## Key Domain Flows

Passenger ride request:
1. `mobile/src/app/(passenger)/index.jsx` loads current location through `expo-location`.
2. Pickup/destination autocomplete calls `/api/locations/autocomplete`.
3. Place selection may call `/api/locations/place/:placeId`.
4. Passenger submits `POST /api/rides` with addresses and coordinates.
5. Passenger polls `/api/rides` every 6 seconds for active ride status.
6. Passenger cancels through `PATCH /api/rides/:id` with `{ action: "cancel" }`.

Driver onboarding:
1. Driver home calls `GET /api/drivers`.
2. If no driver row exists, mobile shows registration.
3. Registration submits `POST /api/drivers`.
4. Backend inserts driver and sets `auth_users.role = 'driver'`.
5. Driver waits until admin sets `is_approved = true`.

Driver ride handling:
1. Approved driver toggles online via `PATCH /api/drivers/status`.
2. Backend blocks online status if `subscription_expiry` is missing or expired.
3. Online driver polls `/api/rides` every 5 seconds.
4. Driver accepts through `PATCH /api/rides/:id` with `{ action: "accept" }`.
5. The accept query only succeeds when ride is still `requested` and `driver_id IS NULL`.
6. Driver completes through `{ action: "complete" }`.

Admin:
1. Admin dashboard calls `/api/admin/stats` and `/api/admin/drivers`.
2. Admin driver review uses `PATCH /api/admin/drivers`.
3. `POST /api/admin/setup` upgrades the current user to admin and should not exist in production.

## Maps, Places, And Fare Logic

Location provider code is in `web/src/app/api/utils/locations.js`.

Provider selection:
- If `OLAMAPS_API_KEY` exists, use Ola Maps APIs.
- Otherwise use configurable local development fallback places.

Implemented capabilities:
- Autocomplete: Ola Maps Places Autocomplete or local fallback.
- Place details: Ola Maps Place Details or local fallback.
- Reverse geocode: Ola Maps Reverse Geocode or local coordinate label.
- Route estimate: Ola Maps Directions with auto mode or local haversine fallback.

Fare estimate:
- Base formula currently appears as `35 + distanceKm * 18`.
- Currency is `INR`.
- Fare is returned by `/api/routes/estimate` but not fully integrated into the ride creation UI.

## Known Gaps And Risks

Highest priority:
- `web/src/auth.js` returns `null`; protected APIs cannot work with real sessions until this is implemented.
- No visible migration files; schema is assumed to exist.
- Admin setup route is unsafe for production and should be gated or removed.
- Several backend routes trust input without validation beyond basic presence checks.
- `GET /api/rides/:id` does not require auth, so ride details may be exposed by ID.

Backend correctness:
- `PATCH /api/admin/drivers` builds a SQL string for `subscription_days`; validate and clamp this value before using it in an interval.
- `complete` and `cancel` ride actions can return `{ ride: undefined }` without a non-2xx error if no row is updated.
- Driver ride feed currently shows all unassigned requested rides, not geographically nearby rides.
- Driver online updates should use device coordinates when permission is available.

Mobile experience:
- Passenger screen has local suggestions and backend suggestions; keep provider normalization consistent.
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

When adding database migrations:
- Create a migrations folder in `web/` or root.
- Capture all assumed `auth_users`, `drivers`, and `rides` fields.
- Add indexes for `rides.passenger_id`, `rides.driver_id`, `rides.status`, `drivers.user_id`, `drivers.is_online`, `drivers.is_approved`.
- Add constraints for ride status values and status transitions where practical.

When adding real maps UI:
- Keep mobile calling backend endpoints, not Google/Mapbox directly.
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

Database migrations:
```text
Using KNOWLEDGE_MAP.md as context, add versioned PostgreSQL migrations for the schema currently assumed by the API routes. Include auth_users, drivers, rides, indexes, status constraints, and safe defaults. Also update README setup instructions.
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
Using KNOWLEDGE_MAP.md and PRODUCTION_INTEGRATIONS.md as context, integrate production maps end to end. Keep API keys server-side, reuse the existing provider adapter, add map UI pins on mobile, and persist place IDs and route estimate metadata.
```

Notifications:
```text
Using KNOWLEDGE_MAP.md as context, add Expo push notifications for ride requested, accepted, cancelled, and completed. Include token registration, backend storage, stale token cleanup, and minimal notification preferences.
```

## Suggested Implementation Order

1. Implement real auth/session handling.
2. Add database migrations and seed data.
3. Harden protected routes and row-level access.
4. Add fare/ETA preview using existing route estimate endpoint.
5. Add nearby ride filtering and real driver location updates.
6. Add payment-backed subscription renewal.
7. Add notifications.
8. Add observability, rate limits, and production security cleanup.
