# QA Report — Reminder System (MSN ERP V2)

**Date:** 2026-05-27
**Auditor:** automated static analysis
**Files audited:** 7

## Severity Legend

| Level | Meaning |
|-------|---------|
| CRIT  | Data loss, security bypass, or silent corruption |
| HIGH  | Wrong behaviour visible to users or operators |
| MED   | Edge-case bug or missing guard |
| LOW   | Code smell, UX gap, or minor inconsistency |
| INFO  | Observation, no action required |

---

## 1. Rules CRUD

### F-001 — days_before_due=0 allowed by server action [MED]

**File:** `src/lib/actions/reminders.ts:116-121`
**Scenario:** Create rule with `days_before_due = 0`
**Finding:** Server action guard is `< 0`, so 0 passes. A rule with 0 days lead time means reminders are only generated on the exact due date. Likely unintentional; the UI Zod schema enforces `min(1)` but direct server action calls bypass this.
**Fix:** Change guard to `input.days_before_due < 1` (or `<= 0`).

### F-002 — No upper-bound guard on days_before_due in server action [LOW]

**File:** `src/lib/actions/reminders.ts:116-121`
**Scenario:** Create rule with `days_before_due = 999`
**Finding:** Server action has no max check. UI Zod schema caps at 90, but direct API callers can insert arbitrarily large values. `generateRemindersFromAcUnits` uses `maxLead` to compute the cutoff window — a huge value would query all AC units ever.
**Fix:** Add `|| input.days_before_due > 365` to the server-side guard.

### F-003 — updateReminderRule silently succeeds on non-existent rule_id [MED]

**File:** `src/lib/actions/reminders.ts:186-197`
**Scenario:** Call `updateReminderRule('nonexistent-uuid', { name: 'x' })`
**Finding:** Supabase `.update().eq().select().single()` returns a PGRST116 error ("JSON object requested, multiple (or no) rows returned") when no row matches. This is thrown and caught, returning `{ success: false, error: '...' }`. However the error message is the raw Supabase message, not a user-friendly "Rule not found". Not a data-corruption bug but confusing for callers.
**Fix:** Check `data` is non-null after update, or use `.maybeSingle()` and explicitly return "Rule not found".

### F-004 — deleteReminderRule does not verify row exists [LOW]

**File:** `src/lib/actions/reminders.ts:210-233`
**Scenario:** Call `deleteReminderRule('nonexistent-uuid')`
**Finding:** `.update().eq()` with no matching row succeeds silently (0 rows affected, no error). The action returns `{ success: true }` even though nothing changed.
**Fix:** Add `.select('rule_id').single()` after update, or check affected row count.

### F-005 — revalidatePath points to wrong route [LOW]

**File:** `src/lib/actions/reminders.ts:142`, `src/lib/actions/reminders.ts:196`, `src/lib/actions/reminders.ts:225`
**Finding:** `createReminderRule`, `updateReminderRule`, and `deleteReminderRule` all call `revalidatePath('/dashboard/settings/reminders')`. The actual page is at `/dashboard/settings/reminder-rules`. The revalidation is a no-op; the rules page uses local state (`loadRules()`) so this is not user-visible, but it is dead code.
**Fix:** Change to `revalidatePath('/dashboard/settings/reminder-rules')`.

### F-006 — auto_send flag stored but never acted upon [HIGH]

**File:** `src/lib/actions/reminders.ts`, `src/app/api/admin/reminders/run/route.ts`
**Scenario:** Create rule with `auto_send=true`, run `/api/admin/reminders/run`
**Finding:** `generateRemindersFromAcUnits` inserts reminders with `status: 'PENDING'` regardless of `rule.auto_send`. No code path reads `auto_send` to trigger actual sending. The UI description says "sistem otomatis mengirim reminder" but this is misleading — nothing is sent automatically.
**Severity:** HIGH because operators may enable `auto_send` expecting actual delivery.
**Fix:** Either implement auto-send dispatch in `generateRemindersFromAcUnits`, or remove the `auto_send` field and UI toggle until the gateway is integrated.


---

## 2. Template Rendering

### F-007 — Unknown placeholders left as-is, not stripped [INFO]

**File:** `src/lib/reminder-utils.ts:90-97`
**Scenario:** Template contains `{{unknown_var}}`
**Finding:** By design, unknown placeholders are preserved verbatim. This is documented in the code comment. However, customers will see raw `{{unknown_var}}` text in their WhatsApp/email message if a typo is made in the template. There is no validation warning in the UI when saving a rule.
**Fix (LOW):** Add a lint step in the form that warns when the template contains `{{...}}` tokens not in the known variable list.

### F-008 — null context values render as empty string silently [INFO]

**File:** `src/lib/reminder-utils.ts:93`
**Scenario:** AC unit has `brand=null`, template uses `{{ac_brand}}`
**Finding:** `null`/`undefined` values render as `""`. Message becomes e.g. "AC  ModelX di Jl. Sudirman" (double space). Not a bug per se, but produces awkward output.
**Fix (LOW):** Render null as a fallback string like `"-"` or `"(tidak diketahui)"`.

### F-009 — No XSS/injection risk in template rendering [INFO]

**File:** `src/lib/reminder-utils.ts:85-98`
**Finding:** `formatReminderMessage` does plain string replacement with no HTML encoding. Since output goes to WhatsApp/email body (not rendered as HTML in the app), this is safe. No action needed.

### F-010 — Long messages not truncated [LOW]

**File:** `src/lib/actions/reminders.ts:612`
**Finding:** `message` column length is not enforced in the action layer. If the DB column has a VARCHAR limit and the rendered message exceeds it, Supabase will return a truncation/overflow error that surfaces as a generic "Failed to generate reminders". No explicit length guard exists.
**Fix:** Add `message: formatReminderMessage(...).slice(0, 1600)` (WhatsApp limit) or appropriate limit before insert.


---

## 3. Reminder Generation

### F-011 — AC units with null next_service_due_date correctly excluded [INFO]

**File:** `src/lib/actions/reminders.ts:534`
**Finding:** Query uses `.not('next_service_due_date', 'is', null)` — units with null due date are excluded from generation. Correct behaviour.

### F-012 — Overdue AC units (due_date < today) excluded from generation [HIGH]

**File:** `src/lib/actions/reminders.ts:536`
**Scenario:** AC unit with `next_service_due_date = yesterday`
**Finding:** Query uses `.gte('next_service_due_date', todayIso)` — overdue units are silently skipped. No reminder is ever generated for them. Operators have no visibility that overdue units were skipped unless they check the monitoring tab manually.
**Fix:** Either include overdue units (remove the `.gte` filter) or log/return a separate `overdue_skipped` count in the result so the API response surfaces it.

### F-013 — Dedup key is (ac_unit_id, rule_id, due_date) — correct but incomplete [MED]

**File:** `src/lib/actions/reminders.ts:557-561`
**Finding:** The dedup set is built from ALL existing reminders for the matched ac_unit_ids, regardless of status. This means a DISMISSED or FAILED reminder blocks re-generation for the same (unit, rule, due_date) triple forever. If an operator dismisses a reminder and wants to regenerate it, they cannot — `generateRemindersFromAcUnits` will skip it.
**Fix:** Exclude DISMISSED/FAILED/CANCELLED rows from the dedup query, or add a "force regenerate" option.

### F-014 — No DB-level unique constraint mentioned for dedup key [CRIT]

**File:** `src/lib/actions/reminders.ts:549-561`
**Finding:** Dedup is done in application memory. If two concurrent calls to `generateRemindersFromAcUnits` run simultaneously (e.g. cron fires twice, or admin clicks "Generate" while cron runs), both will read the same empty `existingKey` set and both will insert the same rows, creating duplicates. There is no DB-level `UNIQUE(ac_unit_id, rule_id, due_date)` constraint referenced in the code.
**Fix:** Add a `UNIQUE(ac_unit_id, rule_id, due_date)` constraint to the `customer_reminders` table and handle the conflict with `ON CONFLICT DO NOTHING`.

### F-015 — Customer with no phone (WHATSAPP) or email (EMAIL) silently skipped [MED]

**File:** `src/lib/actions/reminders.ts:599-603`
**Finding:** When `pickRecipient` returns null, the unit+rule combo is counted as `skipped++` with no distinction from dedup skips. The API response returns a single `skipped_count` that conflates "already exists" and "no recipient". Operators cannot tell why reminders were skipped.
**Fix:** Track `skipped_no_recipient` separately and include in the response.

### F-016 — Inactive rules correctly excluded from generation [INFO]

**File:** `src/lib/actions/reminders.ts:492`
**Finding:** Query filters `.eq('is_active', true)` — inactive rules are excluded. Correct.

### F-017 — Channel determines recipient field correctly [INFO]

**File:** `src/lib/actions/reminders.ts:450-461`
**Finding:** `pickRecipient` returns `phone_number` for WHATSAPP and `email` for EMAIL. Correct.


---

## 4. Customer Reminders Queue

### F-018 — markReminderSent uses READ_ROLES not WRITE_ROLES [MED]

**File:** `src/lib/actions/reminders.ts:314`
**Finding:** `markReminderSent`, `markReminderFailed`, and `markReminderDismissed` all check `READ_ROLES` (`SUPERADMIN`, `ADMIN`, `FINANCE`). This means FINANCE role can mark reminders as sent/dismissed, which is a write operation. Likely unintentional — FINANCE should be read-only for reminders.
**Fix:** Change auth check in these three functions to `WRITE_ROLES`.

### F-019 — markReminderSent does not guard against re-sending already-SENT reminder [MED]

**File:** `src/lib/actions/reminders.ts:309-343`
**Scenario:** Call `markReminderSent` on a reminder already in SENT status
**Finding:** No status pre-check. The update runs unconditionally, overwriting `sent_at` with a new timestamp. This corrupts the original send time.
**Fix:** Add `.eq('status', 'PENDING')` to the update filter, or check current status first and return an error if already SENT.

### F-020 — markReminderFailed truncates error_message at 1000 chars [INFO]

**File:** `src/lib/actions/reminders.ts:361`
**Finding:** `errorText.slice(0, 1000)` — truncation is implemented correctly.

### F-021 — markReminderDismissed allows dismissing SENT reminders [LOW]

**File:** `src/lib/actions/reminders.ts:384-413`
**Finding:** No status guard — any reminder regardless of current status can be dismissed. Dismissing a SENT reminder is semantically odd but not data-corrupting.
**Fix:** Restrict to `status IN ('PENDING', 'FAILED')` to match the UI which only shows the dismiss button for those statuses.

### F-022 — Concurrent send attempts can double-update [MED]

**File:** `src/lib/actions/reminders.ts:309-343`
**Scenario:** Two operators click "Kirim" on the same reminder simultaneously
**Finding:** Both calls will read PENDING, both will update to SENT. No optimistic lock or status pre-check. The second update overwrites `sent_at` and `sent_by` from the first.
**Fix:** Add `.eq('status', 'PENDING')` to the WHERE clause of the update. If 0 rows are affected, return an error.

### F-023 — bulkSendMutation fires N parallel server actions [LOW]

**File:** `src/app/dashboard/reminders/_components/queue-tab.tsx:277-285`
**Finding:** `Promise.allSettled` fires all `markReminderSent` calls in parallel. For large selections this could cause DB connection pressure. No batching or concurrency limit.
**Fix (LOW):** Consider chunking into batches of 10-20.


---

## 5. Monitoring Tab

### F-024 — AC units with no service history excluded from monitoring [INFO]

**File:** `src/lib/actions/reminders.ts:739`
**Finding:** Query uses `.or('last_service_date.not.is.null,next_service_due_date.not.is.null')` — units with neither field set are excluded. This is intentional per the docstring. Correct.

### F-025 — AC units with last_service_date but no next_service_due_date shown correctly [INFO]

**File:** `src/lib/actions/reminders.ts:739`, `monitoring-tab.tsx:90-97`
**Finding:** Such units appear in the table with `next_service_due_date = null`. `daysBetween(null)` returns `null`, `RemainingDaysBadge` renders "—". Correct behaviour.

### F-026 — Sort by Sisa Hari with null values [INFO]

**File:** `src/app/dashboard/reminders/_components/monitoring-tab.tsx:387-391`
**Finding:** `accessorFn` returns `Number.POSITIVE_INFINITY` for null due dates, so nulls sort last in ascending order. Correct.

### F-027 — has_pending_reminder only checks PENDING status, not FAILED [MED]

**File:** `src/lib/actions/reminders.ts:757-766`
**Finding:** The pending set query filters `.eq('status', 'PENDING')`. A unit with a FAILED reminder shows `has_pending_reminder = false` and the "Buat Reminder" button appears, allowing a duplicate manual reminder to be created on top of the failed one. The dedup key `(ac_unit_id, rule_id, due_date)` would block auto-generation but `createManualReminder` does NOT check for existing reminders.
**Fix:** Include FAILED in the pending check, or check for existing reminders in `createManualReminder`.

### F-028 — Stats cards computed from full unfiltered set [INFO]

**File:** `src/app/dashboard/reminders/_components/monitoring-tab.tsx:198-215`
**Finding:** Stats (overdue, dueThisWeek, activeReminders) are computed from `units` (full set), not `filtered`. This is correct — stats should reflect the global picture, not the current filter.

### F-029 — getServicedAcUnits fetches ALL matching rows with no pagination [MED]

**File:** `src/lib/actions/reminders.ts:707-847`
**Finding:** No `.range()` or `limit` is applied to the main AC units query. For large deployments with thousands of AC units this will fetch everything into memory, then filter client-side. The monitoring tab also loads all 500 reminders in `getCustomerReminders({ limit: 500 })`.
**Fix:** Add server-side pagination or at minimum a hard cap (e.g. `.limit(2000)`).


---

## 6. createManualReminder

### F-030 — No active rule returns user-friendly Indonesian error [INFO]

**File:** `src/lib/actions/reminders.ts:891-897`
**Finding:** Returns `{ success: false, error: 'Tidak ada rule reminder aktif...' }`. Correct and user-friendly.

### F-031 — createManualReminder with inactive ruleId does not validate is_active [MED]

**File:** `src/lib/actions/reminders.ts:871-878`
**Scenario:** Pass an explicit `ruleId` that belongs to an inactive rule
**Finding:** When `ruleId` is provided, the query fetches the rule without checking `is_active`. An operator can create a reminder using a deactivated rule by passing its ID directly (e.g. via API or future UI).
**Fix:** Add `.eq('is_active', true)` to the explicit ruleId fetch, or validate after fetch.

### F-032 — createManualReminder is not idempotent — creates duplicate rows [HIGH]

**File:** `src/lib/actions/reminders.ts:961-976`
**Scenario:** Call `createManualReminder(acUnitId)` twice for the same unit
**Finding:** No dedup check. Each call inserts a new row. Unlike `generateRemindersFromAcUnits` which checks `existingKey`, `createManualReminder` does a blind insert. Two PENDING reminders for the same unit/rule/due_date will exist.
**Fix:** Add an upsert with `ON CONFLICT (ac_unit_id, rule_id, due_date) DO NOTHING` or check for existing PENDING reminder before inserting.

### F-033 — Overdue AC unit gets today as due_date fallback [LOW]

**File:** `src/lib/actions/reminders.ts:944-945`
**Finding:** `const dueIso = unit.next_service_due_date ?? new Date().toISOString().slice(0, 10)` — if `next_service_due_date` is null, today's date is used as `due_date`. This silently creates a reminder with a misleading due date. The monitoring tab shows the "Buat Reminder" button for units with null due date, so this path is reachable.
**Fix:** Return an error if `next_service_due_date` is null rather than substituting today.


---

## 7. API /api/admin/reminders/run

### F-034 — CRON_SECRET not set: bearer token check skipped entirely [MED]

**File:** `src/app/api/admin/reminders/run/route.ts:68-77`
**Finding:** If `CRON_SECRET` env var is not configured, the cron-secret branch is skipped silently. Any authenticated ADMIN/SUPERADMIN can still trigger generation via session. However if the intent is to lock the endpoint to cron-only, the absence of `CRON_SECRET` leaves it open to any admin. This is a deployment configuration risk, not a code bug.
**Fix (INFO):** Document in `docs/CRON-SETUP.md` that `CRON_SECRET` must be set in production.

### F-035 — timingSafeEqual returns false for different-length secrets [INFO]

**File:** `src/app/api/admin/reminders/run/route.ts:117-123`
**Finding:** Early-return on length mismatch is correct and does not leak timing info about the secret length since the length of the provided token is attacker-controlled anyway. Implementation is correct.

### F-036 — Auth failure returns 403 not 401 [LOW]

**File:** `src/app/api/admin/reminders/run/route.ts:28`
**Finding:** `jsonError('Unauthorized: ...', 403)` — HTTP 403 Forbidden is returned for both unauthenticated and unauthorised cases. Strictly, unauthenticated should be 401. Not a security issue but violates HTTP semantics.
**Fix:** Return 401 when no credentials are provided, 403 when credentials are valid but role is insufficient.

### F-037 — Response omits rulesScanned count [LOW]

**File:** `src/app/api/admin/reminders/run/route.ts:54-57`
**Finding:** The action returns `{ created, skipped, rulesScanned }` but the API response only exposes `{ generated_count, skipped_count }`. `rulesScanned` is logged but not returned to the caller. Useful for cron monitoring dashboards.
**Fix:** Add `rules_scanned: rulesScanned` to the success response.

### F-038 — Both auth paths create separate Supabase clients [LOW]

**File:** `src/app/api/admin/reminders/run/route.ts:83-111`
**Finding:** `getUserFromRequest` may create one client, then the role lookup creates another. Minor inefficiency but not a correctness issue.


---

## 8. Edge Cases

### F-039 — Customer soft-deleted but reminder still exists — orphan [MED]

**File:** `src/lib/actions/reminders.ts` (general)
**Finding:** The codebase uses soft deletes. If a customer is soft-deleted, their `customer_reminders` rows remain. `getCustomerReminders` joins `customers` — if RLS hides soft-deleted customers the join may return null for `customers`, causing the queue tab to show `customer_name = '-'` with no indication the customer is deleted. The reminder can still be "sent" to the stored recipient.
**Fix:** Add a filter to exclude reminders whose customer is soft-deleted, or display a "Customer dihapus" indicator in the queue.

### F-040 — AC unit soft-deleted but reminder still exists — orphan [MED]

**File:** `src/lib/actions/reminders.ts` (general)
**Finding:** Same as F-039 for AC units. `ac_units` join may return null. The queue tab renders `ac_units = null` as `'-'`. No guard prevents sending a reminder for a deleted AC unit.
**Fix:** Same approach as F-039.

### F-041 — Rule soft-deleted (is_active=false) — existing reminders unaffected [INFO]

**File:** `src/lib/actions/reminders.ts:210-233`
**Finding:** Deactivating a rule does not cancel existing PENDING reminders that reference it. The FK `rule_id` on `customer_reminders` still points to the (now inactive) rule. This is acceptable behaviour — existing queue items should be processed or dismissed manually.

### F-042 — Queue tab loads up to 500 reminders with no server-side filter [MED]

**File:** `src/app/dashboard/reminders/_components/queue-tab.tsx:155`
**Finding:** `getCustomerReminders({ limit: 500 })` fetches 500 rows regardless of filters. All filtering is done client-side. For high-volume deployments this is inefficient and the 500 cap means older reminders are invisible.
**Fix:** Pass active filters to `getCustomerReminders` as server-side query params.

### F-043 — date filter in queue-tab uses new Date(r.due_date) without T00:00 [LOW]

**File:** `src/app/dashboard/reminders/_components/queue-tab.tsx:193-197`
**Finding:** `new Date(r.due_date)` where `due_date` is a `YYYY-MM-DD` string. Without the `T00:00:00` suffix, some JS engines parse this as UTC midnight, causing off-by-one errors in local timezones west of UTC. The monitoring tab correctly uses `` `${iso}T00:00:00` ``.
**Fix:** Use `` new Date(`${r.due_date}T00:00:00`) `` consistently.

### F-044 — MonitoringTab query key does not include filters [LOW]

**File:** `src/app/dashboard/reminders/_components/monitoring-tab.tsx:183-193`
**Finding:** `queryKey: ['serviced-ac-units']` has no filter params. All filtering is client-side, so this is correct for the current architecture. However if server-side filtering is added later, the query key must include filter params to avoid stale cache hits.

### F-045 — No loading state guard on Generate Reminder button double-click [LOW]

**File:** `src/app/dashboard/reminders/page.tsx:101-112`
**Finding:** The button is `disabled={generateMutation.isPending}` — double-click is correctly prevented. However the `QueueTab` also receives `onGenerate` and `isGenerating` props and shows a CTA in the empty state. If the empty-state CTA is clicked while a generation is in progress, `isGenerating` disables the label text but the button itself is not disabled in the empty state component.
**Fix:** Disable the empty-state action button when `isGenerating` is true.


---

## 9. Summary

### Severity Counts

| Severity | Count |
|----------|-------|
| CRIT     | 1     |
| HIGH     | 3     |
| MED      | 12    |
| LOW      | 11    |
| INFO     | 10    |
| **Total**| **37**|

### Critical / High — Action Required

| ID     | Severity | Summary |
|--------|----------|---------|
| F-014  | CRIT     | No DB-level unique constraint — concurrent generation creates duplicate reminders |
| F-006  | HIGH     | auto_send=true does nothing — misleads operators |
| F-012  | HIGH     | Overdue AC units silently excluded from generation |
| F-032  | HIGH     | createManualReminder is not idempotent — duplicate rows on double-call |

### Recommended Fix Priority

1. **F-014** — Add `UNIQUE(ac_unit_id, rule_id, due_date)` DB constraint + `ON CONFLICT DO NOTHING`
2. **F-032** — Guard `createManualReminder` against duplicate inserts
3. **F-006** — Remove or implement `auto_send` flag; do not expose non-functional UI toggle
4. **F-012** — Decide policy on overdue units; at minimum surface `overdue_skipped` count
5. **F-018** — Fix `markReminderSent/Failed/Dismissed` to use `WRITE_ROLES`
6. **F-019** — Add `.eq('status', 'PENDING')` guard to `markReminderSent`
7. **F-022** — Add optimistic lock to prevent concurrent send double-update
8. **F-013** — Exclude DISMISSED/FAILED from dedup set so reminders can be regenerated
9. **F-001** — Change `days_before_due < 0` guard to `<= 0`
10. **F-033** — Return error instead of substituting today when `next_service_due_date` is null

