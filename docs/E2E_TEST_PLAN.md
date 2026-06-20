# TukTukGo Real-Device E2E Test Plan

Run this checklist before every production release. Use one admin account, one
driver account, and one passenger account on real devices.

## Setup

- Neon database migrations are applied.
- PostGIS is enabled.
- The React Router web backend is deployed and reachable from both devices.
- The maintenance worker is running beside the web backend.
- `FAST2SMS_API_KEY` is configured for signup/signin OTP tests.
- At least one active service zone covers the physical test pickup location.

## Admin Flow

- Sign in as admin.
- Create or verify an active service zone.
- Approve the test driver.
- Activate the test driver's subscription.
- Open Admin Audit and confirm approval/subscription actions are logged.

## Driver Online Flow

- Sign in as driver on device A.
- Confirm the driver is approved and subscribed.
- Go online while physically inside the active service zone.
- Keep the app open for at least 2 minutes.
- Confirm the driver remains online while heartbeat continues.
- Background the app long enough to miss heartbeat timeout.
- Confirm backend auto-offlines the driver after timeout.
- Reopen the app and go online again.

## Passenger Ride Flow

- Sign in as passenger on device B.
- Set pickup inside the active service zone.
- Set destination.
- Request a ride.
- Confirm request is accepted with HTTP `202` behavior and appears active.
- Confirm driver polling shows the ride request within the normal polling window.
- Driver accepts ride.
- Confirm passenger device shows accepted ride and driver details.
- Driver completes ride.
- Confirm passenger ride closes and admin ride history updates.

## Polling Recovery

- Driver goes online.
- Kill or background the driver app.
- Passenger creates a ride request while driver is disconnected.
- Reopen the driver app.
- Confirm the pending ride request appears after the next driver poll.

## OTP And Offline Behavior

- Sign out and sign back in with phone OTP.
- Confirm OTP send/verify works through the deployed backend.
- Background the driver app while online.
- Confirm the maintenance worker marks the driver offline after the heartbeat timeout.

## Abuse And Timeout Guards

- Passenger attempts a second active request.
- Confirm API rejects it.
- Passenger cancels and immediately requests again.
- Confirm post-cancellation cooldown blocks the request.
- Driver accepts a ride but does not complete it.
- Wait past accepted ride timeout.
- Confirm maintenance auto-cancels the ghost ride.

## Pass Criteria

- No blank screens or stuck loading states.
- Ride state transitions remain valid.
- Admin audit entries exist for admin actions.
- Polling discovery works within the expected window.
- Phone OTP works through the configured SMS provider.
- Driver heartbeat and subscription expiry enforcement work on real devices.
