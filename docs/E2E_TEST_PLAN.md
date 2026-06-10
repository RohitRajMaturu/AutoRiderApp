# AutoRide Real-Device E2E Test Plan

Run this checklist before every production release. Use one admin account, one
driver account, and one passenger account on real devices.

## Setup

- Neon database migrations are applied.
- PostGIS is enabled.
- FastAPI realtime backend is running with `--workers 1`.
- Mobile app has `EXPO_PUBLIC_REALTIME_WS_URL` set to the FastAPI host.
- MSG91 template IDs and auth key are configured for SMS/OTP fallback tests.
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
- Confirm driver device receives the realtime ride alert.
- Driver accepts ride.
- Confirm passenger device shows accepted ride and driver details.
- Driver completes ride.
- Confirm passenger ride closes and admin ride history updates.

## Reconnect Replay

- Driver goes online.
- Kill or background the driver app.
- Passenger creates a ride request while driver is disconnected.
- Reopen the driver app.
- Confirm pending ride request is replayed after WebSocket reconnect.

## SMS Fallback

- Driver is approved/subscribed but WebSocket is unavailable or app is offline.
- Passenger creates a ride in the same zone.
- Confirm driver receives MSG91 ride alert SMS.
- Driver opens app and accepts ride.
- Simulate passenger WebSocket unavailable.
- Confirm passenger receives ride accepted fallback SMS.

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
- WebSocket delivery works when connected.
- SMS fallback works when WebSocket delivery is unavailable.
- Driver heartbeat and subscription expiry enforcement work on real devices.
