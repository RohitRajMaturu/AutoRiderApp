# TukTukGo — Cron Job Setup

All jobs are Bearer-token-protected POST endpoints. Set `CRON_SECRET` in the application environment to a random value of at least 32 characters.

## VPS application-user crontab (`crontab -e`)

```cron
BASE_URL=https://your-domain.com
CRON_SECRET=your-cron-secret

# TukTukPass
30 5 * * * curl -sf -X POST -H "Authorization: Bearer $CRON_SECRET" $BASE_URL/api/jobs/pass-generate-rides
*/15 * * * * curl -sf -X POST -H "Authorization: Bearer $CRON_SECRET" $BASE_URL/api/jobs/pass-reminders
*/10 * * * * curl -sf -X POST -H "Authorization: Bearer $CRON_SECRET" $BASE_URL/api/jobs/pass-no-show-handler
0 5 * * * curl -sf -X POST -H "Authorization: Bearer $CRON_SECRET" $BASE_URL/api/jobs/pass-auto-resume
59 23 * * * curl -sf -X POST -H "Authorization: Bearer $CRON_SECRET" $BASE_URL/api/jobs/pass-expire
0 9 * * * curl -sf -X POST -H "Authorization: Bearer $CRON_SECRET" $BASE_URL/api/jobs/pass-renewal-reminder
0 9 * * * curl -sf -X POST -H "Authorization: Bearer $CRON_SECRET" $BASE_URL/api/jobs/pass-expiry-final-reminder

# TukTukSafe Schools
0 6 * * * curl -sf -X POST -H "Authorization: Bearer $CRON_SECRET" $BASE_URL/api/jobs/institution-generate-trips
0 20 * * * curl -sf -X POST -H "Authorization: Bearer $CRON_SECRET" $BASE_URL/api/jobs/institution-evening-reminder
0 19 28-31 * * [ "$(date -d tomorrow +\%d)" = "01" ] && curl -sf -X POST -H "Authorization: Bearer $CRON_SECRET" $BASE_URL/api/jobs/institution-generate-invoices
0 10 * * * curl -sf -X POST -H "Authorization: Bearer $CRON_SECRET" $BASE_URL/api/jobs/institution-chase-overdue
```

The times above are interpreted in the server's configured timezone. Set the VPS timezone to `Asia/Kolkata`, or adjust the schedule to produce the equivalent IST run times.

If these entries are installed under `/etc/cron.d/tuktukgo` instead, add the operating-system user (for example, `tuktukgo`) between each schedule and `curl` command as required by that format.

## Verify a job manually

```bash
curl -sf -X POST -H "Authorization: Bearer $CRON_SECRET" $BASE_URL/api/jobs/pass-generate-rides | jq
```
