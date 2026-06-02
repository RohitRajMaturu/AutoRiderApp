# AutoConnect - Ride Connection Platform

A lightweight auto-rickshaw ride connection platform for India.

## Tech Stack
- **Frontend**: React Native (Expo)
- **Backend**: Node.js (Serverless Functions)
- **Database**: PostgreSQL (Neon)
- **Authentication**: Built-in system with Email/Password + Role-based Onboarding
- **Maps/Location Provider**: Ola Maps (Krutrim Cloud) via backend-only REST integration

## Core Features
- **Passengers**: Request rides, see driver details, track ride history.
- **Drivers**: Register vehicle/license, toggle online/offline status, accept nearby rides.
- **Admin**: Approve/Reject driver applications, manage subscriptions.
- **Subscription Model**: Drivers need an active subscription to go online.

## Getting Started

### 1. Database Setup
Create the required Postgres tables from the checked-in migration:

```powershell
cd web
.\scripts\apply-schema.ps1
```

If you are using a hosted Postgres database or a different local URL:

```powershell
cd web
.\scripts\apply-schema.ps1 -DatabaseUrl "postgresql://USER:PASSWORD@HOST:5432/DB_NAME?sslmode=require"
```

You can inspect table status with:

```powershell
cd web
npm run db:check
```

The initial schema lives in `web/db/migrations/001_init_autoconnect.sql` and creates the auth, driver, and ride tables required by the current API routes.

### 2. Admin Setup
To become an admin for testing:
1. Sign up as a regular user in the app.
2. Call the setup endpoint: `POST /api/admin/setup`.
3. Restart the app to see the Admin Panel.

### 3. Environment Variables
The platform handles core environment variables like `DATABASE_URL`.

For production-grade location search and routing, configure the backend with:

```env
OLAMAPS_API_KEY=your_ola_maps_api_key
```

The mobile app does not call Ola Maps directly. Expo screens call backend routes under `/api/locations/*` and `/api/routes/estimate`, keeping the provider key out of the client bundle.

## Completed Backend Location Work

- Server-side Ola Maps autocomplete through `GET /api/locations/autocomplete`.
- Server-side Ola Maps place details through `GET /api/locations/place/:placeId` and `GET /api/locations/place?placeId=...`.
- Server-side Ola Maps reverse geocoding through `GET /api/locations/reverse`.
- Auto-rickshaw route estimation through `GET /api/routes/estimate` using Ola routing mode `auto`.
- Fare calculation from route distance: base fare INR 35 plus INR 18 per kilometer.
- Configurable local fallback data for development when Ola Maps is unavailable or `OLAMAPS_API_KEY` is not configured.

## Project Structure
- `/apps/mobile/src`: Expo application code.
- `/apps/web/src/app/api`: Backend serverless functions.
- `/apps/web/src/app/account`: Web-based authentication pages used by the mobile app.

## Design Philosophy
This app follows a "High-Fidelity SaaS" design system, focusing on structural clarity through micro-details, ghost borders, and a clean typographic hierarchy.
