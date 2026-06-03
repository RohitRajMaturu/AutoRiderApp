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
- Auth: Auth.js credentials flow with backend `auth(request)` JWT session decoding.

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
- SecureStore key is project-owned and stable: `auto-ride-auth`.
- Stored auth shape is `{ jwt, user }`; `/api/auth/token` returns this shape and includes `user.role` and `user.phone`.
- A 3-second race prevents blank screens if SecureStore hangs or throws.
- Auth UI is driven through `useAuthModal` and web account pages.

Important mobile behavior:
- Test mode is persisted in AsyncStorage with `@autoconnect_test_mode` and `@autoconnect_test_role`.
- Test mode routes directly into passenger, driver, or admin screens without real backend auth.
- Mobile fetch is wrapped by `mobile/src/__create/fetch.ts`, so relative `/api/...` calls are forwarded to `EXPO_PUBLIC_BASE_URL` with the stored bearer JWT when available.
- Mobile does not receive the Ola Maps API key.

## Backend/API Architecture

API handlers live under `web/src/app/api`.

Database utility:
- `web/src/app/api/utils/sql.js`
- Uses `pg.Pool` with `process.env.DATABASE_URL`.
- Preserves the local `sql\`...\`` tagged template style used by existing route handlers.

Auth utility:
- `web/src/auth.js`
- Decodes Auth.js JWT session cookies with `@auth/core/jwt`.
- Loads the current user from `auth_users`.
- Protected API route handlers pass their `Request` object as `auth(request)`.
- Returns `{ user: { id, email, phone, role, name, image } }` or `null`.

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
5. Native mobile shows a map preview once coordinates are available; pickup marker is draggable and reverse-geocodes through the backend.
6. Passenger submits `POST /api/rides` with addresses, resolved coordinates, and optional provider place IDs.
7. Backend stores route estimate metadata for future fare/ETA features, but passenger UI does not currently present fare or surge pricing.
8. Passenger polls `/api/rides` every 6 seconds for active ride status.
9. Passenger cancels through `PATCH /api/rides/:id` with `{ action: "cancel" }`.

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
3. `POST /api/admin/setup` is disabled unless `ENABLE_ADMIN_SETUP=true` and no admin user exists yet.

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
- `POST /api/rides` stores `distance_km`, `duration_mins`, `estimated_fare`, `route_polyline`, and `route_provider` for later use.
- No passenger-facing fare, ETA, or surge UI is currently shown.

Verified provider status:
- A live Ola Maps autocomplete request with the key in `web/.env` returned HTTP `200` and 5 predictions.

## Known Gaps And Risks

Recently completed hardening:
- `web/src/auth.js` now performs real Auth.js JWT cookie decoding and user lookup.
- Protected API routes now call `auth(request)`.
- `GET /api/rides/:id` now requires auth and only returns rides to the passenger, assigned driver, or an admin.
- `POST /api/admin/setup` is gated by `ENABLE_ADMIN_SETUP=true` and is blocked once an admin exists.
- `PATCH /api/admin/drivers` validates `driver_id`, `is_approved`, and `subscription_days`; subscription extension uses parameterized `make_interval` instead of interpolated SQL.
- Ride `complete` and `cancel` actions now return explicit non-2xx errors when no row is updated.
- Driver unassigned ride feed is now limited to nearby requested rides using the driver's last known coordinates; drivers without coordinates only see assigned rides.
- Ride creation, driver registration/status, and user profile updates now have basic input validation.
- `/api/auth/token` is aligned with mobile SecureStore shape `{ jwt, user }`.
- Ride creation persists provider place IDs and route estimate metadata for future fare/ETA features.
- Native passenger screen includes pickup/destination map pins and draggable pickup adjustment without calling Ola Maps directly from mobile.

Highest remaining priorities:
- Add focused API tests for auth, ride authorization, admin driver updates, and driver nearby ride filtering.
- Confirm mobile WebView sign-in and bearer-token API calls across Expo Go and device builds.
- Add rate limiting and request/security controls beyond the existing body limit.
- Continue broad input validation on lower-risk routes and provider query endpoints.

Backend correctness:
- `sql.transaction` currently runs already-created promises with `Promise.all`; use a real PostgreSQL transaction helper before multi-step writes need atomicity.
- Driver nearby filtering uses a fixed 8 km radius and last known coordinates; make the radius configurable and improve freshness handling.
- Admin setup is gated, but production deployments should leave `ENABLE_ADMIN_SETUP` unset and ideally remove the route entirely after first admin creation.

Mobile experience:
- Route/fare estimate metadata is stored on ride creation, but passenger request flow intentionally does not show fare/ETA/surge yet.
- UI files contain some mojibake/encoding artifacts in comments and emoji text. Avoid spreading this when editing.
- Test mode is useful for demos but can hide auth/backend integration problems.

Production readiness:
- Payments/subscriptions need Razorpay/Cashfree/Stripe integration plus verified webhooks.
- Push notifications need token storage, refresh handling, and backend send workflow.
- Observability, rate limiting, privacy policy, and location retention are not implemented.
- Secrets should stay backend-only; do not expose unrestricted maps/payment keys in the mobile bundle.

## Implementation Hotspots

When adding auth:
- `web/src/auth.js` already decodes Auth.js JWT cookies and returns user id/email/phone/role/name/image.
- Protected API handlers should call `auth(request)`, not `auth()`.
- Check `web/src/app/account/signin/page.jsx`, `signup/page.jsx`, and `web/__create/index.ts` before changing providers or callbacks.
- `/api/auth/token` already returns `{ jwt, user, auth }`; mobile stores `{ jwt, user }` under `auto-ride-auth`.

When changing database schema:
- Add new SQL files under `web/db/migrations`.
- Run `cd web; npm run db:migrate`.
- Verify with `cd web; npm run db:check`.
- Keep indexes aligned with passenger, driver, and admin query patterns.

When adding map UI:
- Mobile already calls backend endpoints, not Ola Maps directly.
- Native passenger screen already uses map pins and draggable pickup adjustment.
- Continue using existing `/api/locations/*` and `/api/routes/estimate`.
- Continue storing normalized coordinates and optional provider place IDs.

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

Auth verification:
```text
Using KNOWLEDGE_MAP.md as context, add focused API/session tests for the existing Auth.js JWT-backed auth(request) helper. Cover signed-in user lookup, unauthorized requests, ride detail access control, and admin route access.
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
Using KNOWLEDGE_MAP.md as context, continue admin hardening. Add tests for gated /api/admin/setup, admin-only route access, PATCH /api/admin/drivers validation, and production behavior when ENABLE_ADMIN_SETUP is unset.
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

1. Add focused backend tests for auth, authorization, admin updates, and ride state transitions.
2. Add fare/ETA preview using existing route estimate endpoint.
3. Improve nearby ride filtering radius/freshness and real driver location updates.
4. Add payment-backed subscription renewal.
5. Add notifications.
6. Add observability, rate limits, and production security cleanup.
