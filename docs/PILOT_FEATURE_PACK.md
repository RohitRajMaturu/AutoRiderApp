# TukTukGo Pilot Feature Pack

Implementation status: complete on `main` as of 2026-06-29.

## Delivered

- Driver earnings summary for today, the trailing week, and trailing month, including today's completed rides.
- Up to five passenger saved places with profile management and booking shortcuts.
- Link-based SOS live tracking with one Fast2SMS message, a four-hour token, manual revoke, terminal ride states, and 10-second public-page polling. There is no recurring SMS flow.
- Scheduled rides from 15 minutes to 24 hours ahead, protected cron dispatch 30 minutes before pickup, and scheduled ride labels.
- Driver daily incentive progress for the 8-ride / ₹50 pilot target, plus persisted streak data support for 5-day / ₹200 programs.

## Database

The consolidated schema includes `020_saved_places.sql`, `021_sos_tracking.sql`, `022_scheduled_rides.sql`, and `023_driver_incentives.sql`.

The repository already had migrations using the numeric prefixes 020–022. The new migrations retain the requested exact filenames; the migration runner sorts and applies full filenames, and every statement is idempotent.

Apply from `web/`:

```powershell
npm run db:migrate
```

## Production configuration

Set a unique secret of at least 32 random characters:

```env
CRON_SECRET=replace-with-a-random-32-character-secret
```

Run scheduled dispatch once per minute on the VPS:

```cron
* * * * * curl -s -X POST https://your-api.com/api/rides/dispatch-scheduled -H "Authorization: Bearer YOUR_CRON_SECRET" > /dev/null 2>&1
```

SOS also requires `AUTH_URL` (or `NEXTAUTH_URL`) to be the public web origin and a working `FAST2SMS_API_KEY`.

## Operational follow-up

- Install the VPS cron entry with the production URL and secret.
- Confirm the Fast2SMS account permits transactional messages containing HTTPS links.
- Seed `driver_incentives` streak rows when the pilot streak campaign is activated; daily progress works without seed rows.
- Perform a physical-device acceptance pass for native date/time controls, SMS delivery, and emergency-contact link opening.
- Review the existing npm audit findings separately before production dependency upgrades; forced audit fixes were intentionally not applied because they may be breaking.
