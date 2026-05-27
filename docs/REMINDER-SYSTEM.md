# Service Reminder System

End-to-end documentation for the V2 reminder pipeline that nudges customers
when their AC unit is due for routine service.

---

## Overview

The reminder system pulls the next-service date that the technician records
during job completion, and turns it into outbound WhatsApp/Email messages
according to configurable rules. Admins review and dispatch the queue from
the dashboard, or let auto-send rules handle it.

```
Technician Complete Job Form
        │  (next_service_recommendation_date)
        ▼
service_reports.next_service_recommendation_date
        │  (auto-update on submission)
        ▼
ac_units.next_service_due_date
        │  (daily cron OR manual "Generate Reminder Sekarang")
        ▼
generateRemindersFromAcUnits()
        │  (creates customer_reminders rows in PENDING)
        ▼
/dashboard/reminders queue
        │  Admin → Send / Dismiss
        ▼
markReminderSent / markReminderDismissed
        │  (status flips to SENT / DISMISSED)
        ▼
[future] Gateway integration → real WhatsApp/Email delivery
```

---

## Workflow

1. **Technician submits service report** — enters next-service date
   recommendation in the Complete Job Form
   (`src/components/technician/complete-job-form.tsx`).
2. **System sets `ac_units.next_service_due_date`** — the report submission
   handler in `src/app/api/technician/jobs/[id]/report/route.ts` mirrors the
   recommendation date onto the AC unit.
3. **Daily cron (or manual trigger)** — `POST /api/admin/reminders/run` calls
   `generateRemindersFromAcUnits()` which scans AC units whose due date falls
   within any active rule's `days_before_due` window and inserts matching
   `customer_reminders` rows. Idempotent: dedup key is
   `(ac_unit_id, rule_id, due_date)`.
4. **Admin reviews queue** at `/dashboard/reminders` — pending reminders show
   recipient, channel, message preview, and due date. Admin clicks
   "Tandai Terkirim" or "Abaikan" per row.
5. **Auto-send rules (when configured)** — if a rule has `auto_send=true`,
   matching reminders bypass admin review (current implementation still flips
   status only — see [Future Work](#future-work)).

---

## Database Schema

Migration: [`supabase/migrations/02_phase5_reminders.sql`](../supabase/migrations/02_phase5_reminders.sql)

### `reminder_rules` — configurable thresholds + templates

| Column | Type | Notes |
|--------|------|-------|
| `rule_id` | UUID PK | `gen_random_uuid()` |
| `name` | TEXT | Display name |
| `days_before_due` | INT | Lead time in days (default 7) |
| `channel` | TEXT | `WHATSAPP` or `EMAIL` |
| `message_template` | TEXT | Mustache-style variables (see below) |
| `is_active` | BOOLEAN | Soft-disable toggle |
| `auto_send` | BOOLEAN | If true, skip manual review |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

RLS: SUPERADMIN/ADMIN full access; FINANCE read-only.

### `customer_reminders` — generated queue

| Column | Type | Notes |
|--------|------|-------|
| `reminder_id` | UUID PK | |
| `customer_id` | TEXT FK → `customers` | |
| `ac_unit_id` | TEXT FK → `ac_units` | |
| `service_report_id` | UUID FK → `service_reports` | Optional — set when generated from a specific report |
| `rule_id` | UUID FK → `reminder_rules` | |
| `due_date` | DATE | Mirrored from `ac_units.next_service_due_date` |
| `channel` | TEXT | Snapshot from rule at generation time |
| `recipient` | TEXT | Phone or email |
| `message` | TEXT | Rendered template (frozen at generation time) |
| `status` | TEXT | `PENDING` / `SENT` / `FAILED` / `CANCELLED` / `DISMISSED` |
| `sent_at` / `sent_by` | TIMESTAMPTZ / UUID | Audit fields |
| `external_id` | TEXT | Future: gateway message id |
| `error_message` | TEXT | Failure reason |
| `notes` | TEXT | Free-form admin note |

Index: `(status, due_date)` for queue sorting.

### `ac_units` — extended

```sql
ALTER TABLE ac_units ADD COLUMN next_service_due_date DATE;
```

### `service_reports` — extended

```sql
ALTER TABLE service_reports
  ADD COLUMN next_service_recommendation_date DATE,
  ADD COLUMN next_service_recommendation_notes TEXT;
```

---

## Template Variables

`message_template` supports double-brace placeholders. Unknown placeholders
are left as-is so they're easy to spot in QA. `null`/`undefined` values
render as an empty string.

| Variable | Source |
|----------|--------|
| `{{customer_name}}` | `customers.customer_name` |
| `{{ac_brand}}` | `ac_units.brand` |
| `{{ac_model}}` | `ac_units.model_number` |
| `{{location}}` | `locations.full_address, locations.city` (joined) |
| `{{due_date}}` | `ac_units.next_service_due_date`, formatted `id-ID` (e.g. "27 Mei 2026") |

Rendering is implemented in `formatReminderMessage()` in
[`src/lib/reminder-utils.ts`](../src/lib/reminder-utils.ts).

### Example

```
Halo {{customer_name}}, AC {{ac_brand}} {{ac_model}} di {{location}}
akan jatuh tempo service rutin pada {{due_date}}. Silakan hubungi
kami untuk jadwal kunjungan. Terima kasih.
```

Renders as:

```
Halo Budi Santoso, AC Daikin FTKQ25UVM4 di Jl. Sudirman No.10, Jakarta
akan jatuh tempo service rutin pada 27 Mei 2026. Silakan hubungi
kami untuk jadwal kunjungan. Terima kasih.
```

---

## Default Rule

Migration seeds one rule on first run:

| Field | Value |
|-------|-------|
| `name` | `7 hari sebelum jatuh tempo` |
| `days_before_due` | `7` |
| `channel` | `WHATSAPP` |
| `is_active` | `true` |
| `auto_send` | `false` |

---

## Adding New Rules

UI route: **`/dashboard/settings/reminder-rules`** (SUPERADMIN/ADMIN).

Or programmatically via `createReminderRule()` in
`src/lib/actions/reminders.ts`:

```ts
await createReminderRule({
  name: '14 hari sebelum jatuh tempo (email)',
  days_before_due: 14,
  channel: 'EMAIL',
  message_template:
    'Halo {{customer_name}},\n\nAC {{ac_brand}} {{ac_model}} di {{location}} akan jatuh tempo service rutin pada {{due_date}}. Silakan balas email ini untuk menjadwalkan kunjungan.\n\nTerima kasih.',
  is_active: true,
  auto_send: false,
})
```

Validation enforced server-side:

- `name` non-empty
- `days_before_due >= 0`
- `channel` ∈ `{WHATSAPP, EMAIL}`
- `message_template` non-empty

Soft-delete: `deleteReminderRule()` flips `is_active` to false; rules are
never hard-deleted.

---

## Cron / Scheduling

Daily generation runs against `POST /api/admin/reminders/run`.

Two auth modes:

1. **`Authorization: Bearer <CRON_SECRET>`** — for unattended cron jobs
2. **Authenticated SUPERADMIN/ADMIN session** — for manual runs from the
   dashboard

See **[`docs/CRON-SETUP.md`](./CRON-SETUP.md)** for full setup instructions
(Supabase pg_cron, GitHub Actions, and Vercel Cron options).

### Manual Trigger

From the admin reminder page (`/dashboard/reminders`), click
**"Generate Reminder Sekarang"**. This calls the same generator without
requiring `CRON_SECRET` — it relies on the active admin session.

Useful when:

- Testing rules immediately after creating one
- A technician submits a same-day report and the customer's due date is
  already inside the rule window
- The cron has been paused or hasn't fired yet

---

## Server Actions Reference

All in `src/lib/actions/reminders.ts`:

| Action | Auth | Purpose |
|--------|------|---------|
| `getReminderRules()` | SUPERADMIN/ADMIN/FINANCE | List rules (active + inactive), newest first |
| `createReminderRule(input)` | SUPERADMIN/ADMIN | Create a rule |
| `updateReminderRule(id, patch)` | SUPERADMIN/ADMIN | Patch fields |
| `deleteReminderRule(id)` | SUPERADMIN/ADMIN | Soft-delete (sets `is_active=false`) |
| `getCustomerReminders(filters?)` | SUPERADMIN/ADMIN/FINANCE | Paginated queue with joins on customer + AC unit + rule |
| `markReminderSent(id, externalId?)` | SUPERADMIN/ADMIN/FINANCE | Status → `SENT`, captures `sent_by` and `external_id` |
| `markReminderFailed(id, errorText)` | SUPERADMIN/ADMIN/FINANCE | Status → `FAILED`, records error |
| `markReminderDismissed(id)` | SUPERADMIN/ADMIN/FINANCE | Status → `DISMISSED` |
| `generateRemindersFromAcUnits({ asSystem? })` | SUPERADMIN/ADMIN (or `asSystem=true` from cron route) | Scan + insert pending reminders. Idempotent. |
| `renderTemplate(template, vars)` | any | Server-side preview helper |

---

## Generation Logic

`generateRemindersFromAcUnits()` algorithm:

1. Fetch all `is_active=true` rules. If none, exit early.
2. Compute `cutoff = today + max(days_before_due across rules)`.
3. Fetch AC units with `next_service_due_date BETWEEN today AND cutoff`,
   joined to location → customer.
4. Fetch existing `customer_reminders` rows for those AC unit IDs to build
   a dedup set keyed on `(ac_unit_id, rule_id, due_date)`.
5. For each (unit × rule) pair where `due_date <= today + rule.days_before_due`:
   - Skip if dedup key already present (created in a prior run).
   - Skip if recipient (phone/email) is missing.
   - Otherwise, render the template and queue an insert.
6. Bulk insert and return `{ created, skipped, rulesScanned }`.

Idempotency means safe re-runs — running the cron twice in one day inserts
nothing the second time. The dedup key also covers the case where two rules
fire for the same unit on the same date (each rule generates its own row).

---

## Future Work

The system today **records** sent status but does not actually invoke a
delivery gateway. Steps to wire it up:

### WhatsApp (Business API or third-party)

1. Add provider env vars (e.g. `WA_BUSINESS_PHONE_ID`, `WA_BUSINESS_TOKEN`).
2. Create `src/lib/server/whatsapp-sender.ts` with a `sendWhatsApp(to, message)`
   function that returns a `{ success, externalId, error }` shape.
3. In `markReminderSent`, branch on `channel === 'WHATSAPP'` and call the
   sender before flipping status. On failure, call `markReminderFailed`.
4. For `auto_send=true` rules, dispatch immediately at the end of
   `generateRemindersFromAcUnits()` instead of leaving status as `PENDING`.

### Email

1. Reuse the existing Resend integration (`RESEND_API_KEY`).
2. Create `src/lib/server/reminder-email-sender.ts` that wraps `Resend.emails.send`.
3. Same admin-flip vs auto-send branching as above.

### Open questions before going live

- Rate limiting / backoff when WhatsApp Business API throttles
- Customer opt-out tracking (`customers.reminder_opt_out` column?)
- Quiet-hours enforcement (don't send 22:00–07:00)
- Retry strategy for `FAILED` reminders — manual re-queue button vs auto-retry

These are tracked in the V2 risk register; see
`docs/V1-vs-V2-comparison.md` § Risk register.

---

## Related Docs

- **Cron setup**: [`docs/CRON-SETUP.md`](./CRON-SETUP.md)
- **V1 vs V2 comparison**: [`docs/V1-vs-V2-comparison.md`](./V1-vs-V2-comparison.md)
- **Migration**: [`supabase/migrations/02_phase5_reminders.sql`](../supabase/migrations/02_phase5_reminders.sql)
- **Backend actions**: [`src/lib/actions/reminders.ts`](../src/lib/actions/reminders.ts)
- **Template helpers**: [`src/lib/reminder-utils.ts`](../src/lib/reminder-utils.ts)
- **Cron route**: [`src/app/api/admin/reminders/run/route.ts`](../src/app/api/admin/reminders/run/route.ts)
