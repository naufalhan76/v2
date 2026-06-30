# Bug Fix Report

Generated from `bug-findings.txt` (998 lines, 64 bugs total).

## Summary

| Status | Count |
|--------|-------|
| FIXED | 3 |
| NOT-FIXED-ENV | 1 |
| OPEN | 60 |
| ALREADY-FIXED | 0 |
| OUT-OF-SCOPE | 0 |
| **Total** | **64** |

FIXED bugs were addressed in Tasks 5, 9, and 24. NOT-FIXED-ENV is an environment-level Supabase FK race with no code-level fix. All other findings remain OPEN.

No test evidence files (`.omo/evidence/task-*`) were present at generation time. Test evidence column is populated only where the task context provides it.

---

## Code Review Findings (Static Analysis)

### rbac.ts

| # | Severity | Location | Description | Fix | Test Evidence | Status |
|---|----------|----------|-------------|-----|---------------|--------|
| 1 | LOW | `src/lib/rbac.ts` | `isFinance()` returns true only for `FINANCE`, not `SUPERADMIN`. Inconsistent with `isAdmin()` which includes `SUPERADMIN`. | Add `\|\| role === 'SUPERADMIN'` if SUPERADMIN should access finance features. | N/A | OPEN |
| 2 | LOW | `src/lib/rbac.ts` | `canAccessInvoice` / `canAccessCustomer` accept resource args but void them. Purely role-based, no multi-tenant ownership check. | Implement resource-level ownership check for multi-tenant deployments. | N/A | OPEN |

### auth-guards.ts

| # | Severity | Location | Description | Fix | Test Evidence | Status |
|---|----------|----------|-------------|-----|---------------|--------|
| 3 | MED | `src/lib/auth-guards.ts` | `getCurrentUserProfile()` calls `redirect('/sign-out')` for inactive users. `NEXT_REDIRECT` propagates through `requireUserProfile()` instead of `AuthError`. | Return null for inactive users; let `requireUserProfile()` throw `AuthError`. | N/A | OPEN |

### orders-auto-revert.ts

| # | Severity | Location | Description | Fix | Test Evidence | Status |
|---|----------|----------|-------------|-----|---------------|--------|
| 4 | MED | `src/lib/actions/orders-auto-revert.ts:22` | UTC midnight boundary: `new Date().toISOString().slice(0,10)` computes "today" in UTC. Server in WIB (UTC+7) between 00:00-06:59 local gets wrong date. | Use `new Date(Date.now() + 7*3600_000).toISOString().slice(0,10)` or store as `timestamptz`. | N/A | OPEN |
| 5 | LOW | `src/lib/actions/orders-auto-revert.ts:109-114` | `void Promise.allSettled` swallows notification failures. No retry for transient push failures. | Add background queue (BullMQ) if notification reliability becomes critical. | N/A | OPEN |

### orders-mutations-status.ts (cancelOrder)

| # | Severity | Location | Description | Fix | Test Evidence | Status |
|---|----------|----------|-------------|-----|---------------|--------|
| 6 | LOW | `src/lib/actions/orders-mutations-status.ts:154-165` | AC unit deactivation only targets `status='ACTIVE'`. Non-ACTIVE states (MAINTENANCE, future SERVICING) won't be reset on cancel. | Widen filter or use `.neq('status', 'INACTIVE')`. | N/A | OPEN |
| 7 | LOW | `src/lib/actions/orders-mutations-status.ts:169-174` | FINAL invoice query `.neq('status', 'CANCELLED')` includes VOID invoices. Cascade tries to cancel VOID (harmless no-op). | Add `.not('status', 'in', ['CANCELLED', 'VOID'])`. | N/A | OPEN |

### orders-mutations-status.ts (updateOrderStatus + acceptOrder)

| # | Severity | Location | Description | Fix | Test Evidence | Status |
|---|----------|----------|-------------|-----|---------------|--------|
| 8 | MED | `src/lib/actions/orders-mutations-status.ts:92-98` | `updateOrderStatus`: transition insert error silently ignored. Function returns `{ success: true }` even if audit trail insert fails. | Destructure `{ error: insertError }` and throw/log on failure. Wrap in transaction. | N/A | OPEN |
| 9 | HIGH | `src/lib/actions/orders-mutations-status.ts:298-321` | `acceptOrder`: no auth check, no role validation, no transition validation. Writes legacy `ACCEPTED` instead of canonical `PENDING`. | Add `auth()` + role guard. Use `updateOrderStatus('PENDING')` through state machine. | N/A | OPEN |

### invoices-order.ts

| # | Severity | Location | Description | Fix | Test Evidence | Status |
|---|----------|----------|-------------|-----|---------------|--------|
| 10 | MED | `src/lib/actions/invoices-order.ts:16-114` | `createProformaInvoice`: no duplicate protection. Calling twice creates two PROFORMA invoices. | Pre-check for existing PROFORMA on the order. Return existing or throw. | N/A | OPEN |
| 11 | MED | `src/lib/actions/invoices-order.ts:26-28` | `createProformaInvoice`: no order status gate. Creating proforma for COMPLETED/DONE orders is meaningless. | Guard: reject if order status is COMPLETED, DONE, INVOICED, or PAID. | N/A | OPEN |
| 12 | LOW | `src/lib/actions/invoices-order.ts:199-232` | `finalizeInvoiceFromOrder`: misleading name. Creates DRAFT FINAL invoice, never transitions to SENT. | After `createInvoiceFromOrder`, update status to SENT. | N/A | OPEN |

### orders-mutations-assign.ts

| # | Severity | Location | Description | Fix | Test Evidence | Status |
|---|----------|----------|-------------|-----|---------------|--------|
| 13 | HIGH | `src/lib/actions/orders-mutations-assign.ts:98-149` | `addHelperTechnician` / `removeHelperTechnician`: no auth guard. Any authenticated session can add/remove helpers on any order. | Add `auth()` + role guard (ADMIN/SUPERADMIN only). | N/A | OPEN |
| 14 | MED | `src/lib/actions/orders-mutations-assign.ts:11-96` | `assignOrdersToTechnician`: no past-date validation. Admin could assign orders to past dates. | Add `if (new Date(data.scheduledDate) < today) throw` before RPC. | N/A | OPEN |
| 15 | MED | `src/lib/actions/orders-mutations-assign.ts:44-48` | `assignOrdersToTechnician`: no deduplication of `orderIds`. Duplicates inflate capacity check and may double-assign. | Deduplicate: `data.orderIds = [...new Set(data.orderIds)]`. | N/A | OPEN |
| 16 | LOW | `src/lib/actions/orders-mutations-assign.ts:59` | `assignOrdersToTechnician`: helper=lead not validated. Technician can be assigned as their own helper. | Filter helper IDs to exclude lead: `.filter(id => id !== data.technicianId)`. | N/A | OPEN |
| 17 | LOW | `src/lib/actions/orders-mutations-assign.ts:130-135` | `removeHelperTechnician`: no row-existence verification. Returns `{ success: true }` even when 0 rows deleted. | Use `.select()` first or check delete return count. | N/A | OPEN |

### invoices-create.ts

| # | Severity | Location | Description | Fix | Test Evidence | Status |
|---|----------|----------|-------------|-----|---------------|--------|
| 18 | MED | `src/lib/actions/invoices-create.ts:48` | `tax_percentage \|\| 11` silently overrides 0% tax to 11%. `0` is falsy, replaced by default. | Use nullish coalescing: `input.tax_percentage ?? 11`. | N/A | OPEN |
| 19 | LOW | `src/lib/actions/invoices-create.ts:61,85` | Non-null assertion `userId!` bypasses null-safety. If Clerk auth fails silently, `requireFinanceRole(null)` is called. | Replace with explicit `if (!userId) throw new AuthError(...)`. | N/A | OPEN |
| 20 | LOW | `src/lib/actions/invoices-create.ts:107-112` | Redundant order re-fetch for INVOICED status update. Order already validated earlier. | Remove inner status check or wrap in transaction. | N/A | OPEN |

### invoices-payments.ts

| # | Severity | Location | Description | Fix | Test Evidence | Status |
|---|----------|----------|-------------|-----|---------------|--------|
| 21 | MED | `src/lib/actions/invoices-payments.ts:68-72` | `deleteInvoice`: `payment_records` query error silently ignored. Failed check allows deletion of invoice with payments. | Destructure `error` and throw if present. | N/A | OPEN |
| 22 | MED | `src/lib/actions/invoices-payments.ts:74-81` | `deleteInvoice`: `invoice_communications` query error silently ignored. Failed check allows deleting sent invoice. | Destructure `error` and throw if present. | N/A | OPEN |
| 23 | LOW | `src/lib/actions/invoices-payments.ts:89-92` | `deleteInvoice`: orders update error silently ignored (FINAL revert). Invoice deleted but order stays INVOICED. | Check error and log/warn or re-throw. | N/A | OPEN |
| 24 | LOW | `src/lib/actions/invoices-payments.ts:147-149` | `updateInvoiceStatus`: orders update error silently ignored (CANCELLED revert). Order status becomes stale. | Capture and handle the error. | N/A | OPEN |
| 25 | HIGH | `src/lib/actions/orders-mutations-schedule.ts:56-112` | `rescheduleOrder`: no status guard. COMPLETED, PAID, CANCELLED orders can be rescheduled, reversing terminal status. | Guard: reject if status is COMPLETED, PAID, or CANCELLED. | N/A | OPEN |
| 26 | MED | `src/lib/actions/orders-mutations-schedule.ts:48` | `rescheduleOrder`: no auth check. Unauthenticated caller can reschedule orders. | Add `auth()` + userId check at top of function. | N/A | OPEN |
| 27 | LOW | `src/lib/actions/orders-mutations-schedule.ts:113-118` | `rescheduleOrder`: `error.message` lost when catch receives non-Error object. Supabase may return plain objects. | Duck-type: `(error as any)?.message ?? 'Failed to reschedule order'`. | N/A | OPEN |
| 28 | LOW | `src/lib/actions/create-order-mutations.ts:71,203,255` | `instanceof Error` swallows Supabase error messages. PostgrestError is a plain object, not Error instance. | Duck-type: `(error as Record<string, unknown>)?.message`. | N/A | OPEN |

### invoices-revision.ts

| # | Severity | Location | Description | Fix | Test Evidence | Status |
|---|----------|----------|-------------|-----|---------------|--------|
| 29 | LOW | `src/lib/actions/invoices-revision.ts` | `reviseInvoice`: redundant auth + RBAC. 3 auth lookups and 3 RBAC checks per call. | Remove auth/RBAC from `reviseInvoice` or extract shared helper. | N/A | OPEN |
| 30 | LOW | `src/lib/actions/invoices-revision.ts:269` | Silent rollback failure in `reviseInvoiceItems` error recovery. Restore update result not checked. | Check restore result and log on failure. | N/A | OPEN |

### invoices-listing.ts

| # | Severity | Location | Description | Fix | Test Evidence | Status |
|---|----------|----------|-------------|-----|---------------|--------|
| 31 | MED | `src/lib/actions/invoices-listing.ts:79-81` | OVERDUE status filter is post-query. Pagination and total count are broken. | Move OVERDUE filter to DB layer or compute count from filtered result. | N/A | OPEN |
| 32 | LOW | `src/lib/actions/invoices-listing.ts:104` | `getInvoiceStats`: `unpaidAmount` can be NaN if `paid_amount` is undefined (not null). | Use `?? 0` fallback. | N/A | OPEN |

### orders-queries.ts

| # | Severity | Location | Description | Fix | Test Evidence | Status |
|---|----------|----------|-------------|-----|---------------|--------|
| 33 | LOW | `src/lib/actions/orders-queries.ts:92` | `getOrders`: `pagination.total` is 0 when `withCount` not requested. Breaks pagination UI. | Default to `withCount: true` or return `total: null` for "unknown". | N/A | OPEN |

### reminders-rules.ts & reminders-queue.ts

| # | Severity | Location | Description | Fix | Test Evidence | Status |
|---|----------|----------|-------------|-----|---------------|--------|
| 34 | MED | `src/lib/actions/reminders-rules.ts:108` | `updateReminderRule`: no empty-name validation after trim. Whitespace-only name accepted. | Add empty-string check after trim. | N/A | OPEN |
| 35 | LOW | `src/lib/actions/reminders-rules.ts:121-123` | `updateReminderRule`: no empty `message_template` validation. Template can be set to "". | Mirror `createReminderRule` validation. | N/A | OPEN |
| 36 | LOW | `src/lib/actions/reminders-queue.ts:211` | `createManualReminder`: fallback to today's date when no `next_service_due_date`. Tells customer "due TODAY". | Require `next_service_due_date` or use placeholder text. | N/A | OPEN |
| 37 | LOW | `src/lib/actions/reminders-queue.ts:149` | `generateRemindersFromAcUnits`: UTC midnight boundary. Same pattern as orders-auto-revert.ts. | Use timezone-aware date or store as `timestamptz`. | N/A | OPEN |

### dashboard-stats.ts & dashboard-charts.ts

| # | Severity | Location | Description | Fix | Test Evidence | Status |
|---|----------|----------|-------------|-----|---------------|--------|
| 38 | MED | `src/lib/actions/dashboard-charts.ts:50` | `getChartData`: timezone bug in date iteration. Uses local-time `setDate()/getDate()` then `toISOString()`. Skips/duplicates dates around midnight in WIB. | Mirror `getStatusByDay` UTC approach. | N/A | OPEN |
| 39 | MED | `src/lib/actions/dashboard-charts.ts:60` | `getChartData`: `toLocaleDateString` on UTC-parsed date shifts display in negative-UTC timezones. | Use noon UTC: `new Date(\`\${dateStr}T12:00:00.000Z\`)`. | N/A | OPEN |
| 40 | HIGH | `src/lib/actions/dashboard-stats.ts:263` | `instanceof Error` silently drops Supabase error messages. PostgrestError is plain object, always shows generic message. | Use `(error as { message?: string })?.message \|\| 'Failed to fetch dashboard data'`. | N/A | OPEN |
| 41 | LOW | `src/lib/actions/dashboard-stats.ts`, `dashboard-charts.ts` | No input validation on `startDate`/`endDate`. Invalid strings produce NaN and empty data with `success: true`. | Validate date strings early, return error on invalid input. | N/A | OPEN |

### API Routes: ac-units + customers

| # | Severity | Location | Description | Fix | Test Evidence | Status |
|---|----------|----------|-------------|-----|---------------|--------|
| 42 | MED | `src/app/api/ac-units/route.ts:121` | POST `/api/ac-units`: `request.json()` lacks error guard. Invalid JSON throws 500 instead of 400. | Use `request.json().catch(() => ({}))`. | N/A | OPEN |
| 43 | LOW | `src/app/api/ac-units/[id]/route.ts:77` | PUT `/api/ac-units/[id]`: `request.json()` called BEFORE auth check. Unauthenticated malformed requests get 500 instead of 401. | Move body parsing after `requireApiRole` guard. | N/A | OPEN |
| 44 | LOW | `src/app/api/ac-units/[id]/route.ts:86-94` | PUT `/api/ac-units/[id]`: no Zod validation on update body. Arbitrary types reach update action. | Add `UpdateAcUnitSchema` with optional fields + coercion. | N/A | OPEN |
| 45 | LOW | `src/app/api/ac-units/route.ts:123` | POST `/api/ac-units`: raw body logged before validation. Unexpected keys appear in logs. | Log after validation or log `validation.data`. | N/A | OPEN |

### API Routes: orders

| # | Severity | Location | Description | Fix | Test Evidence | Status |
|---|----------|----------|-------------|-----|---------------|--------|
| 46 | MED | `src/app/api/orders/route.ts` | GET `/api/orders`: `requireApiRole` uses `auth()` while `[id]` route uses `getAuth(request)`. Inconsistent Clerk patterns across orders domain. | Consolidate on one auth pattern. | N/A | OPEN |
| 47 | LOW | `src/app/api/orders/[id]/route.ts:62-72` | PATCH `/api/orders/[id]`: duplicates role lookup inline instead of using `requireApiRole`. | Replace inline check with `requireApiRole`. | N/A | OPEN |

### API Routes: photos/signed-upload-url

| # | Severity | Location | Description | Fix | Test Evidence | Status |
|---|----------|----------|-------------|-----|---------------|--------|
| 48 | HIGH | `src/app/api/photos/signed-upload-url/route.ts:19-22` | No bucket/path allowlist with service-role client. Any Clerk user can upload to ANY bucket, overwrite files, or path-traverse. | Whitelist allowed buckets. Validate path structure with regex. | N/A | OPEN |
| 49 | MED | `src/app/api/photos/signed-upload-url/route.ts:6` | No role check. Any Clerk user (including FINANCE, customers) can generate signed upload URLs. | Add role gate: TECHNICIAN, ADMIN, SUPERADMIN only. | N/A | OPEN |
| 50 | LOW | `src/app/api/photos/signed-upload-url/route.ts` | No server-side logging. Storage failures not logged. No audit trail for signed URL generation. | Add logger import and log at entry + on error. | N/A | OPEN |
| 51 | LOW | `src/app/api/photos/signed-upload-url/route.ts:28-32` | Inconsistent response shape. Returns `{ signedUrl, token, path }` directly instead of wrapping in `jsonSuccess()`. | Use `jsonSuccess()`/`jsonError()` from `@/app/api/utils`. | N/A | OPEN |

### API Routes: invoices + send-email

| # | Severity | Location | Description | Fix | Test Evidence | Status |
|---|----------|----------|-------------|-----|---------------|--------|
| 52 | MED | `src/app/api/invoices/route.ts:34-37` | GET `/api/invoices`: no pagination. Fetches all invoices at once. Slow for large datasets. | Accept limit/offset query params. | N/A | OPEN |
| 53 | LOW | `src/app/api/invoices/route.ts:20-21` | GET `/api/invoices?orderId=...` returns narrower schema than default path. Silent breakage if consumer assumes full schema. | Use `select('*')` for both paths or document partial schema. | N/A | OPEN |
| 54 | LOW | `src/app/api/invoices/send-email/route.ts:25` | POST send-email: no rate limit on Resend calls. Duplicate emails, quota exhaustion. | Track recent emails per invoice, reject duplicates within N minutes. | N/A | OPEN |

---

## E2E / QA Staging Bugs

| # | Bug ID | Severity | Description | Fix | Test Evidence | Status |
|---|--------|----------|-------------|-----|---------------|--------|
| 55 | G04 | HIGH | `/dashboard/orders` crashes with client-side error when `q` param is set. Orders list page fails to parse/render with search parameter. | Guard search/filter initialization. Show empty/all results for invalid `q` instead of crashing. | N/A | OPEN |
| 56 | G12 | HIGH | `updateInvoiceStatus` (SENT to CANCELLED) throws on staging. "Gagal mengupdate status invoice" error toast. | Fix: use valid `payment_status` value instead of CANCELLED for status transition. Handled in Task 24/9. | G12 void-revert test | FIXED |
| 57 | G05 | MED | `record_payment_v2` RPC failure on staging. Payment modal shows error toast instead of success. | Fix: UUID cast issue in `record_payment_v2` RPC. Documented and resolved. | G05 full-payment test | FIXED |
| 58 | FK-race | LOW | Supabase PostgREST FK race in rapid seeded inserts. `ac_unit_id_fkey` violates FK constraint transiently. | Retry loop (3 attempts, 500ms backoff) added in seed helpers. Root cause is PostgREST connection pool timing. | Seed scenario tests | NOT-FIXED-ENV |
| 59 | G01 | HIGH | Order form "Buat Order" submit button never becomes visible. Review section accordion does not open or content is clipped. | Investigate `SchedulingStep` state propagation to `form.isScheduleFilled`. Check Radix Calendar onChange. | G01 order creation test | OPEN |
| 60 | G09 | HIGH | Service Catalog search input permanently hidden on re-navigation. Search form exists in DOM but Playwright resolves as "hidden" 60+ times. | Inspect catalog page CSS transitions or animation classes stuck on parent container. Likely hydration/cache issue on second visit. | G09 catalog test | OPEN |
| 61 | G13 | HIGH | Kanban board column headings never render on staging. `BoardSkeleton` persists indefinitely. `/api/orders` query may hang. | Add `AbortController` timeout to fetch. Check staging logs for hanging requests. | G13 kanban test | OPEN |
| 62 | G21 | LOW | Order count missing in header. Expected "Riwayat Order (N)" but got "Riwayat Order" without count. | Fix header component to include order count from query data. | G21 test | OPEN |
| 63 | G17 | MED | Reminder generator not producing reminders for seeded AC units. Cron endpoint returns 200 but generates 0 `customer_reminders` rows. | Fix: reminders-queue date filtering logic. Seeded AC units with `due_date=today` not picked up by generator. Handled in Task 5. | G17 reminder dispatch test | FIXED |

### G18: Dashboard KPI Mismatch with DB

| # | Bug ID | Severity | Description | Fix | Test Evidence | Status |
|---|--------|----------|-------------|-----|---------------|--------|
| 64 | G18 | HIGH | Dashboard KPI cards do not match DB counts. Observed across 11 test runs with varying mismatches. Total Orders, Pending Orders, and Completed Orders all show incorrect values. UI shows 0 when DB has data, or inflated counts. | Investigate `dashboard-stats.ts` query logic. Likely RLS filtering, caching, or query scope mismatch between dashboard and DB. | G18 KPI test (11 observations) | OPEN |

---

## Notes

- **G14** (User Management CRUD): Test file created with 4 test cases. Tests auto-skipped due to missing QA credentials. No bugs found.
- **INFO findings** (not counted as bugs): `order-history.ts` clean implementation, `technician/push` routes clean implementation, `api/invoices` clean auth/security.
- **No sensitive data** (API keys, credentials, tokens) is included in this report.
- **Test evidence** is marked N/A for static analysis findings that lack corresponding automated tests. E2E bugs reference their test spec IDs where applicable.
