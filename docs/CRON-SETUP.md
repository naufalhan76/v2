# Cron Setup — Daily Reminder Generation

The endpoint `POST /api/admin/reminders/run` generates reminders from AC unit
service due dates and warranty expiry. It can be invoked manually from the
dashboard, or scheduled to run automatically once per day.

This document covers three scheduling options. Pick the one that matches your
hosting setup.

## Authentication

The endpoint accepts two auth modes:

1. **`Authorization: Bearer <CRON_SECRET>`** — for unattended cron jobs. Set
   the `CRON_SECRET` environment variable to a long random string (e.g.
   `openssl rand -hex 32`). The endpoint compares it in constant time.
2. **Authenticated session** — for manual admin invocation from the dashboard
   "Generate Reminder Sekarang" button. Requires SUPERADMIN or ADMIN role.

If `CRON_SECRET` is not set, only the role check applies and unattended cron
jobs will not work.

## Required env

```
CRON_SECRET=<long random string>
```

Add it to your hosting provider's secret store (Vercel project env, Supabase
Vault, etc.) — never commit the real value.

---

## Option A: Supabase pg_cron (recommended for staging)

Best when the app is already on Supabase. `pg_cron` and `pg_net` ship with
Supabase but must be enabled per project (Database > Extensions in the
dashboard).

Store the secret in Postgres so the cron SQL can read it:

```sql
-- Run once, replace the value with your real CRON_SECRET
ALTER DATABASE postgres SET app.cron_secret TO 'replace-with-real-secret';
```

Schedule the daily job at 08:00 server time:

```sql
SELECT cron.schedule(
  'generate-reminders-daily',
  '0 8 * * *',  -- 8am daily
  $$
    SELECT net.http_post(
      url := 'https://v2.nufnh.my.id/api/admin/reminders/run',
      headers := ('{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.cron_secret', true) || '"}')::jsonb
    );
  $$
);
```

Verify the job exists and inspect runs:

```sql
SELECT * FROM cron.job WHERE jobname = 'generate-reminders-daily';
SELECT * FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'generate-reminders-daily')
ORDER BY start_time DESC LIMIT 10;
```

To unschedule:

```sql
SELECT cron.unschedule('generate-reminders-daily');
```

Notes:
- `pg_net` calls are async; failures appear in `net._http_response`.
- `current_setting('app.cron_secret', true)` returns NULL if the setting is
  missing (the `true` flag suppresses the error). Make sure the `ALTER
  DATABASE` ran successfully.

---

## Option B: Vercel Cron (for V1 prod migration)

When the app is deployed to Vercel, add a cron entry to `vercel.json`. Vercel
calls the endpoint with a header `x-vercel-cron: 1` from a known IP range, but
since our endpoint validates `Authorization: Bearer`, we use Vercel's
`crons` block plus the project secret.

```json
{
  "crons": [
    {
      "path": "/api/admin/reminders/run",
      "schedule": "0 8 * * *"
    }
  ]
}
```

Vercel's built-in cron only sends a GET by default, so use one of these
approaches for our POST endpoint:

1. **Add a thin GET wrapper** that forwards to the POST handler (simplest).
2. **Use a Vercel Cron + Edge Function** that POSTs with the secret header.

Add `CRON_SECRET` to Vercel project env (Production scope). Vercel cron
requests carry a `x-vercel-cron-signature` header on Pro plans; for Hobby,
rely on the bearer secret check.

---

## Option C: External cron (cron-job.org / GitHub Actions)

Free and host-agnostic. Useful when you don't have pg_cron and aren't on
Vercel.

### cron-job.org

1. Create a job at https://cron-job.org
2. URL: `https://v2.nufnh.my.id/api/admin/reminders/run`
3. Method: `POST`
4. Headers: `Authorization: Bearer <CRON_SECRET>`
5. Schedule: `0 8 * * *` (daily 08:00)

### curl (one-off / smoke test)

```bash
curl -X POST https://v2.nufnh.my.id/api/admin/reminders/run \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json"
```

Expected response:

```json
{
  "success": true,
  "data": { "generated_count": 12, "skipped_count": 3 }
}
```

### GitHub Actions

`.github/workflows/reminders-cron.yml`:

```yaml
name: Daily Reminders
on:
  schedule:
    - cron: '0 8 * * *'  # 08:00 UTC daily
  workflow_dispatch: {}

jobs:
  trigger:
    runs-on: ubuntu-latest
    steps:
      - name: Call reminder generation endpoint
        run: |
          curl -fsSL -X POST "$ENDPOINT" \
            -H "Authorization: Bearer $CRON_SECRET" \
            -H "Content-Type: application/json"
        env:
          ENDPOINT: https://v2.nufnh.my.id/api/admin/reminders/run
          CRON_SECRET: ${{ secrets.CRON_SECRET }}
```

Add `CRON_SECRET` under Settings > Secrets > Actions.

---

## Manual trigger

A "Generate Reminder Sekarang" button is available at `/dashboard/reminders`
for SUPERADMIN/ADMIN users. It calls the same endpoint with the current
session, bypassing the cron secret. Useful for backfilling after schema
changes or testing the generator output.

---

## Reminder rule prerequisite

The reminder generator only creates `customer_reminders` rows for AC units
that match an active row in `reminder_rules`. If no active rules exist, the
endpoint returns successfully but generates zero reminders.

### Default rule (migration 015)

`migrations/015_default_reminder_rule.sql` seeds one rule named
`'Default same-day'` with `days_before_due = 0`. This rule causes the
generator to produce a reminder on the exact day `ac_units.next_service_due_date`
equals today. The migration is idempotent — running it more than once will
not create duplicate rows.

To apply the migration, run it against your Supabase project:

```bash
psql "$DATABASE_URL" -f migrations/015_default_reminder_rule.sql
```

To roll it back:

```bash
psql "$DATABASE_URL" -f migrations/015_rollback_default_reminder_rule.sql
```

### Inspecting active rules

```sql
SELECT * FROM reminder_rules WHERE is_active = true ORDER BY days_before_due;
```

Each row with `is_active = true` defines one reminder trigger. The
`days_before_due` value controls how many days before `next_service_due_date`
the reminder is queued. A value of `0` means the reminder fires on the same
day the service is due. A value of `7` means it fires seven days in advance.

If you need reminders at multiple lead times (e.g. same-day and three days
prior), insert additional rules with the appropriate `days_before_due` values.
