# Real-Device E2E Checklist

Run this on physical passenger and driver devices against the same backend and
database. Record device model, OS version, app build, backend commit, and
database name before starting.

## Setup

- Apply migrations: `cd web && npm run db:migrate`.
- Confirm schema: `cd web && npm run db:check`.
- Seed or create one admin, one passenger, and two approved subscribed drivers.
- Create at least one active service zone that covers all test devices.
- Configure Ola Maps, Auth secret, Pusher Channels, and mobile `EXPO_PUBLIC_*`
  values for the test backend.
- For monitoring validation, configure separate `VITE_SENTRY_DSN` and
  `EXPO_PUBLIC_SENTRY_DSN` values for the web and mobile test builds.
- Keep backend and maintenance worker running.

## Passenger

- Sign up and sign in.
- Accept consent prompt.
- Select pickup and destination.
- Verify route estimate loads without exposing provider keys in mobile logs.
- Request a fixed-fare ride.
- Cancel before driver acceptance.
- Request another fixed-fare ride.

## Driver

- Sign up and sign in.
- Register vehicle and document details.
- Submit KYC details and documents.
- Admin approves KYC and driver application.
- Driver toggles online inside the active service zone.
- Driver receives nearby fixed-fare ride request.
- Driver accepts ride.
- Driver sees accepted ride card with call icon, Start Ride, and Cancel.
- Driver starts ride.
- Driver completes ride.

## Fare Negotiation

- Passenger requests negotiated ride with min/max fare.
- Driver A sees negotiated request and sends a counter above max.
- Passenger sees counter within 1 second when Pusher is configured.
- Driver B accepts inside the range.
- Passenger and Driver A receive lock-out update.
- Confirm Driver A cannot accept the already locked ride.
- Repeat with two drivers tapping accept at nearly the same time.
- Confirm only one `rides.driver_id` wins and losing client gets a 409 or lock-out.
- Repeat with no driver response until expiry.
- Confirm passenger expiry fallback changes the ride back to fixed dispatch.

## Privacy And Notifications

- Confirm passenger and driver screens do not display raw phone numbers.
- Confirm call actions are icon-only until proxy calling is implemented.
- Grant notification permission on both devices.
- Confirm `user_push_tokens` receives active Expo tokens.
- Sign out and sign back in; confirm token is refreshed rather than duplicated.
- From each passenger, driver, and admin role group, sign out and confirm the
  welcome screen appears without a flash of protected tab content.
- Press the device back button after logout and confirm the protected role group
  cannot be reopened.

## Admin

- Admin reviews drivers, KYC queue, rides, zones, and audit log.
- Open the admin dashboard and admin-ops dashboard after a cold page load.
- Confirm both charts keep their expected height and render after hydration
  without blank/collapsed containers or hydration warnings.
- Confirm admin actions create audit log entries.
- Confirm non-admin users cannot access admin routes.

## Error Monitoring

- Trigger one temporary handled test event in a production-like web build.
- Confirm it appears only in the web Sentry project with the correct environment.
- Trigger one temporary handled test event in a production-like mobile build.
- Confirm it appears only in the mobile Sentry project with the correct environment.
- Remove both temporary triggers after verification.

## Cleanup

- Stop one online driver app for longer than `DRIVER_HEARTBEAT_TIMEOUT_SECONDS`.
- Confirm maintenance marks the driver offline.
- Leave an accepted ride idle past `ACCEPTED_RIDE_TIMEOUT_MINUTES`.
- Confirm maintenance cancels it with `accepted_timeout`.
- Confirm old operational events and inactive push tokens are removed according
  to retention env values.
