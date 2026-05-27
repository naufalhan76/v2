# QA Findings — Technician Mobile App + Service Reports — 2026-05-27

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 3 |
| HIGH | 8 |
| MEDIUM | 9 |
| LOW | 6 |
| INFO | 4 |
| **Total** | **30** |

---

## CRITICAL

### [CRITICAL-1] Race condition on report submission — no DB-level uniqueness guard
File: src/app/api/technician/jobs/[id]/report/route.ts:92-103
Issue: Duplicate-report check is a SELECT then INSERT with no transaction or unique constraint.
Two concurrent POST requests both pass the existingReport check before either inserts,
producing two service_reports rows for the same order+technician. This corrupts billing.
Repro: Fire two simultaneous POST /api/technician/jobs/{id}/report requests.
Fix: Add a UNIQUE constraint on (order_id, technician_id) in service_reports (filtered
on deleted_at IS NULL), or wrap the check+insert in a Postgres function/transaction.

### [CRITICAL-2] Signature URL is a time-limited signed URL stored permanently
File: src/components/technician/complete-job-form.tsx:214-218
Issue: createSignedUrl(..., 60*60*24*365) produces a URL that expires in 1 year.
That URL is stored in service_reports.customer_signature_url and used as the permanent
record. After expiry the signature is inaccessible — legal/audit risk.
Fix: Use a public bucket with RLS, or store the storage path and generate signed URLs
on demand at read time. Do not persist expiring URLs as permanent records.

### [CRITICAL-3] pushsubscriptionchange re-subscribe sends no auth credentials
File: public/technician-sw.js:164-168
Issue: The fetch to /api/technician/push/subscribe inside pushsubscriptionchange has
no Authorization header and no credentials: include. The service worker has no access
to cookies in all browsers (especially Firefox). The subscribe endpoint calls
authenticateTechnician which requires either Bearer token or cookie session.
Result: every subscription rotation silently fails — the new endpoint is never saved,
push stops working after the browser rotates keys.
Fix: Store the Supabase session token in IndexedDB from the app, read it in the SW,
or use credentials: include and ensure the SW scope allows cookie forwarding.

---

## HIGH

### [HIGH-1] Today jobs query uses server UTC date — wrong for technicians in non-UTC timezones
File: src/app/api/technician/jobs/today/route.ts:21-24
Issue: startOfDay/endOfDay are computed from server UTC. scheduled_visit_date is a DATE
column (no timezone). A technician in UTC+7 at 23:00 local = 16:00 UTC will see
tomorrow's jobs as today's, and miss jobs scheduled for their local today after midnight UTC.
Fix: Accept a ?date=YYYY-MM-DD query param from the client (client knows local date),
or compare scheduled_visit_date directly as a DATE string without ISO timestamp conversion.

### [HIGH-2] Job detail leaks order data to helper technicians via wrong 404 message
File: src/app/api/technician/jobs/[id]/route.ts:32-34
Issue: When a technician is not assigned, the response is 404 "Order not found or not
assigned to you". This is correct. However the check uses .maybeSingle() with no role
filter — helpers (role=helper) can fetch full order detail including customer email,
phone, AC serial numbers. Only lead should see full detail for report/transition purposes.
Fix: Decide policy: either allow helpers read-only access (document it) or add
.eq("role", "lead") to the assignment check in the detail route.

### [HIGH-3] Transition endpoint does not guard against already-terminal status
File: src/app/api/technician/jobs/[id]/transition/route.ts:64-72
Issue: canTransition() correctly returns false for terminal states (PAID, CANCELLED)
because TRANSITION_RULES has empty objects for them. However the error message says
"Invalid transition: cannot move from PAID to EN_ROUTE" which leaks internal state.
More critically: if toCanonical() returns PENDING for an unknown legacy status,
canTransition("SOME_LEGACY", "EN_ROUTE", "TECHNICIAN") will check PENDING rules
which has no TECHNICIAN key — returns false correctly. But a legacy ARRIVED status
maps to IN_PROGRESS, so a technician on an ARRIVED order CAN transition to COMPLETED.
This is likely correct but untested and undocumented.
Fix: Add explicit test coverage for legacy status transitions. Document the behaviour.

### [HIGH-4] Report submission allows actual_total_price = 0
File: src/app/api/technician/jobs/[id]/report/route.ts:20
Issue: Schema validates actual_total_price with .min(0) — zero is accepted.
Client-side also allows 0 (actualPrice <= 0 check at line 189 of complete-job-form.tsx
catches zero, but the API itself does not). A direct API call with price=0 succeeds.
Fix: Change server schema to .min(1) or .positive() to reject zero-price reports.

### [HIGH-5] next_service_recommendation_date accepts past dates
File: src/app/api/technician/jobs/[id]/report/route.ts:26-30
Issue: The regex only validates YYYY-MM-DD format, not that the date is in the future.
A past date propagates to ac_units.next_service_due_date, causing the reminder system
to immediately generate overdue reminders for the unit.
Fix: Add .refine(d => new Date(d) > new Date(), "Date must be in the future") to the schema.

### [HIGH-6] History endpoint fetches ALL order_technician assignments then filters in DB
File: src/app/api/technician/history/route.ts:29-39
Issue: First query fetches ALL order_ids for the technician (no limit), then the second
query uses .in("order_id", orderIds). For a technician with hundreds of jobs, the IN
clause can exceed Postgres limits or cause slow query plans. Pagination is applied only
to the second query — the first is unbounded.
Fix: Use a JOIN query instead of two round-trips: select from orders JOIN order_technicians
in a single query with the status filter and pagination applied together.

### [HIGH-7] PhotoUpload removes photo from UI but does NOT delete from Supabase Storage
File: src/components/technician/photo-upload.tsx:176-182
Issue: handleRemove only calls onChange(updated) — the file remains in the storage bucket.
Orphaned files accumulate indefinitely. For a private bucket this is a storage cost issue;
for a public bucket it is also a data exposure issue (URL still works after removal).
Fix: Call supabase.storage.from(bucket).remove([path]) before removing from state.
Extract the path from the public URL.

### [HIGH-8] requireFinanceRoleAPI returns 403 for unauthenticated requests instead of 401
File: src/app/api/middleware/auth.ts:130-134
Issue: When user is null (no session, no token), requireFinanceRoleAPI returns HTTP 403
with body "Unauthorized: Finance role required". Unauthenticated should be 401.
This is a separate issue from the technician routes but affects the shared auth layer.
Fix: Return 401 when user is null, 403 only when user exists but lacks the role.

---

## MEDIUM

### [MEDIUM-1] Auto-price recalculation logic has a stale-closure bug
File: src/components/technician/complete-job-form.tsx:160-167
Issue: The materials useEffect sets actualPrice only when actualPrice === 0 || !draftRestored.
After draft restore, draftRestored=true so the condition becomes actualPrice===0 only.
If the technician clears all materials (total becomes 0) after restoring a draft,
actualPrice stays at the old draft value — the auto-sync is silently broken.
Fix: Track a separate boolean "userHasManuallyEditedPrice". Only skip auto-sync when that is true.

### [MEDIUM-2] SignaturePad re-init does not restore value when disabled prop changes
File: src/components/technician/signature-pad.tsx:26-73
Issue: The init useEffect depends only on [disabled]. When disabled flips from true to false
(e.g. after submit error), the pad re-initialises but value is not in the dependency array.
The restored signature from draft will be lost — the pad shows blank.
Fix: Add value to the dependency array, or split init and value-restore into separate effects.

### [MEDIUM-3] Work timer resets to 0 on every re-render that changes canonical_status
File: src/components/technician/job-detail-content.tsx:62-71
Issue: workTimer state is reset to 0 whenever canonical_status changes to anything other
than IN_PROGRESS. If the query refetches (staleTime=30s) and returns the same IN_PROGRESS
status, the effect re-runs because job?.canonical_status is a new string reference each
render — the timer resets to 0 every 30 seconds.
Fix: Only start the timer once when entering IN_PROGRESS. Store the start timestamp
(Date.now()) and compute elapsed time from it rather than incrementing a counter.

### [MEDIUM-4] History infinite query uses page-number pagination — not cursor-based
File: src/components/technician/history-list.tsx:58-63
Issue: getNextPageParam returns page+1. If new records are inserted between page fetches,
records shift and the user sees duplicates or skips items. Standard practice for
infinite scroll is cursor-based (e.g. last seen order_id or scheduled_visit_date).
Fix: Switch API and client to cursor pagination using the last record timestamp.

### [MEDIUM-5] public-key endpoint returns empty string when VAPID env is missing
File: src/app/api/technician/push/public-key/route.ts:11-12
Issue: Returns { publicKey: "" } with HTTP 200 when NEXT_PUBLIC_VAPID_PUBLIC_KEY is unset.
The service worker receives an empty key, calls urlBase64ToUint8Array(""), and the
pushManager.subscribe() call throws a DOMException — unhandled in the SW catch block.
Fix: Return HTTP 503 with { error: "Push not configured" } when the env var is missing.

### [MEDIUM-6] PhotoUpload progress bar is per-file but displayed as overall progress
File: src/components/technician/photo-upload.tsx:158
Issue: uploadProgress is set to ((i+1)/totalFiles)*100 inside the loop, so it shows
100% after the first file if only one file is selected, then resets to 0 on the next.
For multi-file uploads the progress jumps non-linearly. Minor UX issue but confusing.
Fix: Accumulate progress across all files or show a per-file indicator.

### [MEDIUM-7] Draft restore silently ignores invalid JSON without user feedback
File: src/components/technician/complete-job-form.tsx:57-65
Issue: loadDraft catches JSON.parse errors and returns null. If localStorage has a
corrupted draft (e.g. from a previous crash mid-write), the technician loses their
draft with no warning. They may re-enter data thinking it was saved.
Fix: On parse error, show a toast "Draft rusak, memulai dari awal" and clear the key.

### [MEDIUM-8] MaterialInput uses array index as React key
File: src/components/technician/material-input.tsx:104
Issue: key={index} causes incorrect reconciliation when rows are removed from the middle.
Removing row 1 of 3 causes row 2 to inherit row 1 input state (focus, cursor position).
Fix: Assign a stable id (e.g. crypto.randomUUID()) to each row on creation and use that as key.

### [MEDIUM-9] Transition log insert failure is silently swallowed
File: src/app/api/technician/jobs/[id]/transition/route.ts:88-95
Issue: The order_status_transitions insert is not awaited with error handling — if it
fails (e.g. schema mismatch, RLS), the error is thrown but caught by the outer try/catch
which returns 500. However the order status has already been updated. The transition
succeeds in the DB but the audit log is missing. This is an atomicity gap.
Fix: Wrap the order update and log insert in a Postgres function/RPC call, or accept
the gap and log the failure without rolling back (document the trade-off).

---

## LOW

### [LOW-1] Today jobs query includes legacy status values in the IN clause
File: src/app/api/technician/jobs/today/route.ts:78
Issue: .in("status", ["ASSIGNED","EN_ROUTE","EN ROUTE","IN_PROGRESS","ARRIVED"])
mixes canonical and legacy values. This works but is inconsistent with the canonical
status approach. After Phase 5 data migration the legacy values will never match,
making the extra values dead code that confuses future maintainers.
Fix: Use only canonical values. If legacy rows still exist pre-migration, use toCanonical()
mapping at the query layer or add a DB view.

### [LOW-2] Job detail only shows first order_item for location and AC unit
File: src/components/technician/job-detail-content.tsx:92-94
Issue: const orderItem = job.order_items?.[0] — only the first item is displayed.
Orders with multiple AC units (multi-item orders) show only one unit and one location.
The technician has no visibility into the other units they need to service.
Fix: Render all order_items in the service info card, not just index 0.

### [LOW-3] Offline banner allows form interaction but submit is blocked — no draft-save prompt
File: src/components/technician/complete-job-form.tsx:444-446
Issue: Submit button is disabled when offline (disabled={submitting || !isOnline}).
The technician can fill the entire form offline but has no explicit "save draft" button.
Auto-save runs every 500ms so data is preserved, but there is no UI affordance telling
the technician their work is being saved. They may close the app thinking data is lost.
Fix: Add a visible "Draft tersimpan" indicator that updates on each auto-save.

### [LOW-4] Service worker precaches /technician-manifest.json which may not exist
File: public/technician-sw.js:9
Issue: PRECACHE_URLS includes /technician-manifest.json. If this file does not exist
at install time, cache.addAll() rejects and the SW install fails entirely — the app
loses all offline capability.
Fix: Verify the manifest file exists at that path, or use cache.add() individually
with error handling so one missing file does not abort the full install.

### [LOW-5] Profile page company field rendered twice
File: src/components/technician/profile-content.tsx:186-188, 205-209
Issue: technician.company is shown once in the header (line 187) and again in the
contact details section (line 207) with an Info icon. Same data displayed twice.
Fix: Remove the duplicate — keep it in the header or the details section, not both.

### [LOW-6] Unsubscribe order: server DELETE fires before browser unsubscribe
File: src/components/technician/profile-content.tsx:113-119
Issue: disablePush() calls the server DELETE first (fire-and-forget with .catch),
then calls unsubscribeFromPush(). If the browser unsubscribe fails, the server record
is already deleted — the browser still has an active subscription but the server will
never send to it. The push service will eventually 410 the endpoint and prune it,
but until then the technician receives notifications they cannot dismiss from the app.
Fix: Unsubscribe from the browser first, then delete from server.

---

## INFO

### [INFO-1] VAPID public key endpoint is intentionally unauthenticated — correct by design
File: src/app/api/technician/push/public-key/route.ts
Note: The comment correctly explains why this is safe. No action needed.

### [INFO-2] urlBase64ToUint8Array is duplicated in SW and push.ts
File: public/technician-sw.js:180-188, src/lib/push.ts:31-43
Note: Duplication is intentional — SW cannot import app modules. Consider a comment
cross-referencing both copies so they stay in sync if the algorithm changes.

### [INFO-3] authenticateTechnician makes 3 sequential Supabase round-trips per request
File: src/app/api/technician/helpers.ts:18-72
Note: getUser -> user_management role check -> technicians lookup = 3 DB calls on every
authenticated endpoint. For a mobile app with frequent polling this adds latency.
Consider caching the technician_id in a short-lived server-side cache keyed by JWT sub.

### [INFO-4] No rate limiting on push subscribe endpoint
File: src/app/api/technician/push/subscribe/route.ts
Note: An authenticated technician can call this endpoint in a tight loop to fill the
push_subscriptions table. The upsert on (user_id, endpoint) prevents exact duplicates
but different endpoints (e.g. from repeated browser subscribe calls) each create a row.
Consider adding a max-subscriptions-per-user guard (e.g. 10).

---

## Test Scenario Coverage Matrix

| Scenario | Result | Finding |
|----------|--------|---------|
| Non-TECHNICIAN -> /api/technician/* | PASS — 403 returned | helpers.ts:53 |
| Logged-out -> 401 | PASS — 401 returned | helpers.ts:41 |
| Cookie missing / Bearer missing | PASS — 401 returned | helpers.ts:41 |
| Token expired | PASS — Supabase getUser returns null -> 401 | helpers.ts:41 |
| Technician with no jobs today | PASS — returns [] | today/route.ts:35-37 |
| Multiple jobs same day | PASS — IN clause covers all | today/route.ts:75 |
| Helper role only (not lead) | FAIL — today jobs filters lead only; helper sees nothing | HIGH-2 |
| Jobs across timezones | FAIL — server UTC date used | HIGH-1 |
| EN_ROUTE/IN_PROGRESS included in today | PASS — status IN clause includes both | today/route.ts:78 |
| order_id wrong format | PASS — Supabase returns error -> 500 via handleApiError | jobs/[id]/route.ts |
| Order assigned to different technician | PASS — 404 returned | jobs/[id]/route.ts:32 |
| Order with no order_items | PASS — empty array returned, UI shows dash | job-detail-content.tsx:92 |
| Invalid transition (ASSIGNED->PAID) | PASS — 422 returned | transition/route.ts:67 |
| Transition by helper | PASS — 403 (not lead) | transition/route.ts:48 |
| Already terminal status | PASS — canTransition returns false -> 422 | order-status.ts:132 |
| Race condition two transitions | PARTIAL — no DB lock; last write wins | MEDIUM-9 |
| Empty photos arrays | PASS — Zod .min(1) rejects | report/route.ts:17-18 |
| Materials JSON invalid | PASS — Zod validation rejects | report/route.ts:52 |
| actual_total_price negative | PASS — .min(0) rejects negative | report/route.ts:20 |
| actual_total_price = 0 | FAIL — accepted by API | HIGH-4 |
| Signature URL not in signatures bucket | FAIL — no bucket validation | (no check) |
| Submit twice (duplicate) | FAIL — race condition window | CRITICAL-1 |
| next_service_date in past | FAIL — only format validated | HIGH-5 |
| next_service_date triggers ac_units update | PASS — propagation implemented | report/route.ts:132 |
| order_items.ac_unit_id null | PASS — filtered with Boolean(id) | report/route.ts:143 |
| History pagination cursor edge | FAIL — page-number not cursor | MEDIUM-4 |
| History filter by status | PASS — comma-separated filter works | history/route.ts:72 |
| Empty history | PASS — returns [] with count=0 | history/route.ts:35 |
| Subscribe twice (idempotent) | PASS — upsert on (user_id,endpoint) | subscribe/route.ts:46 |
| Endpoint duplicate detection | PASS — upsert handles it | subscribe/route.ts:46 |
| Auth user mismatch on subscribe | PASS — auth.userId used, not body | subscribe/route.ts:50 |
| public-key without VAPID env | FAIL — returns empty string 200 | MEDIUM-5 |
| 404/410 cleanup logic | PASS — prune implemented | push-sender.ts:127 |
| Multiple subscriptions per user | PASS — fan-out to all subs | push-sender.ts:93 |
| Notification payload size | INFO — no size guard; web-push lib handles | push-sender.ts:91 |
| Concurrent sends | PASS — Promise.allSettled used | push-sender.ts:93 |
| SignaturePad clear works | PASS — pad.clear() + onChange(null) | signature-pad.tsx:98 |
| SignaturePad re-init on disabled change | FAIL — value lost on re-init | MEDIUM-2 |
| PhotoUpload 10MB limit enforced | PASS — checked before compress | photo-upload.tsx:128 |
| PhotoUpload quality compression | PASS — JPEG 0.7, max 1200px | photo-upload.tsx:31 |
| MaterialInput total calc bad input | PASS — Math.max guards NaN | material-input.tsx:54 |
| Auto-save draft localStorage quota | LOW — silent fail on quota | complete-job-form.tsx:53 |
| Multi-tab draft race | FAIL — no locking; last write wins | complete-job-form.tsx:49 |
| SW registration error handling | PASS — push.ts throws on missing support | push.ts:94 |
| pushsubscriptionchange refresh | FAIL — no auth credentials sent | CRITICAL-3 |
| Manifest icons valid | UNVERIFIED — /icons/tech-icon-192.png not audited | technician-sw.js:83 |
