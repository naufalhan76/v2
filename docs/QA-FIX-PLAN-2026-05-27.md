# MSN ERP V2 — QA Fix Plan

> Source: 12 QA reports, ~337 findings.

## Summary

| Phase | Goal | Tasks | Effort | Prod blocker? |
|-------|------|-------|--------|---------------|
| 6 | Security + crashes | 14 | 1-2d | YES |
| 7 | Data integrity + RLS | 12 | 2-3d | YES |
| 8 | Feature correctness | 14 | 3-4d | Recommended |
| 9 | UX polish | 8 | 2-3d | No |

MUST FIX: 26 tasks (Phase 6+7). SHOULD FIX: 14 tasks (Phase 8). NICE/SKIP: ~185 findings.

---

## Phase 6 — Critical Security & Runtime Crashes (PROD BLOCKER)

### Task 6.1: Delete unauthenticated cleanup-orphaned-users endpoint
- **Source:** QA-API-2026-05-27
- **File:** src/app/api/cleanup-orphaned-users/route.ts
- **Issue:** Endpoint is live with zero auth. Any anonymous caller triggers mass auth-user deletion.
- **Fix:** Delete the file entirely.
- **Verify:** Route returns 404 after deletion.


### Task 6.2: Fix fake API key verification — always returns SUPERADMIN
- **Source:** QA-API-2026-05-27, QA-AUTH-2026-05-27
- **File:** src/app/api/auth/api-key/route.ts, src/lib/api-key.ts
- **Issue:** /api/auth/api-key accepts any sk_+64char string and returns role:SUPERADMIN unconditionally. No real verification.
- **Fix:** Disable the endpoint (return 501) until a real api_keys table + HMAC lookup is implemented. Remove hardcoded fallback secret in api-key.ts.
- **Verify:** POST with a fake sk_ key returns 501 or 401, not SUPERADMIN.


### Task 6.3: Add auth to DELETE and PUT /api/customers/[id]
- **Source:** QA-API-2026-05-27, QA-MASTER-DATA-2026-05-27
- **File:** src/app/api/customers/[id]/route.ts
- **Issue:** DELETE and PUT handlers have no requireAuth call. Any unauthenticated request can delete or overwrite any customer record.
- **Fix:** Add requireAuth(request) at top of both handlers; return 401 if null. Add ADMIN/SUPERADMIN role gate. Replace hard delete with soft delete (deleted_at). Validate PUT body with UpdateCustomerSchema.
- **Verify:** Unauthenticated DELETE returns 401. TECHNICIAN DELETE returns 403.


### Task 6.4: Remove open self-registration from login page
- **Source:** QA-AUTH-2026-05-27
- **File:** src/app/(auth)/login/page.tsx:156-247
- **Issue:** Register tab calls supabase.auth.signUp() with no server-side gate. Toast says "ADMIN role by default" — any visitor can self-register as ADMIN.
- **Fix:** Remove the Register tab entirely. User provisioning exists in SUPERADMIN UI.
- **Verify:** /login has no Register tab. Direct signUp call returns error.


### Task 6.5: Fix runtime crash — createOrder inserts legacy status NEW
- **Source:** QA-ORDERS-2026-05-27, QA-CODE-AUDIT-2026-05-27
- **File:** src/lib/actions/orders.ts:201, src/lib/actions/create-order.ts:260
- **Issue:** createOrder() sets status:"NEW" and createOrderWithItems() sets status:"ACCEPTED" — both are invalid enum values. Every order creation crashes with DB enum error.
- **Fix:** Change orders.ts:201 to status:"PENDING". Change create-order.ts:260 to "PENDING" (no tech) or "ASSIGNED" (with tech). Remove "ACCEPTED" entirely.
- **Verify:** Create order succeeds without DB error. Order appears with PENDING status.


### Task 6.6: Fix runtime crash — dashboard KPI queries use invalid enum values
- **Source:** QA-ORDERS-2026-05-27, QA-CODE-AUDIT-2026-05-27
- **File:** src/lib/actions/dashboard.ts:64,72,126,133
- **Issue:** KPI queries filter on NEW, ACCEPTED, EN ROUTE, ARRIVED, CLOSED — none exist in order_status enum. Supabase errors or returns wrong counts.
- **Fix:** pendingOrders: IN (PENDING,ASSIGNED,EN_ROUTE,IN_PROGRESS). completedOrders: IN (COMPLETED,INVOICED,PAID).
- **Verify:** Dashboard KPI counts are non-zero and correct after fix.


### Task 6.7: Fix runtime crash — cancelOrder uses invalid ac_status PENDING
- **Source:** QA-ORDERS-2026-05-27
- **File:** src/lib/actions/orders.ts:517
- **Issue:** cancelOrder() filters .eq("status","PENDING") on ac_units — PENDING is not in ac_status enum (ACTIVE,INACTIVE,RETIRED). Throws runtime error on cancel.
- **Fix:** Remove the .eq("status","PENDING") guard or replace with a valid status value.
- **Verify:** Cancel order completes without DB enum error.


### Task 6.8: Fix createInvoice rejects COMPLETED orders — invoice creation broken
- **Source:** QA-INVOICES-2026-05-27, QA-INTEGRATION-2026-05-27, QA-CODE-AUDIT-2026-05-27
- **File:** src/lib/actions/invoices.ts:754, invoices.ts:833,1353,1486
- **Issue:** createInvoice() checks order.status !== "DONE" but canonical status is "COMPLETED". Invoice creation always fails for completed orders. Also: deleteInvoice and sync use legacy "DONE".
- **Fix:** Change line 754 to: if (!["DONE","COMPLETED"].includes(order.status)). Replace all "DONE" references in sync logic with "COMPLETED".
- **Verify:** Create invoice for COMPLETED order succeeds.


### Task 6.9: Fix RLS split-brain — FINANCE can DELETE technicians and service_records
- **Source:** QA-DB-2026-05-27
- **File:** supabase/migrations/01_v2_rls.sql
- **Issue:** technicians_admin_all and service_records_admin_all ALL policies include FINANCE in qual (SELECT/DELETE) but not with_check (INSERT/UPDATE). FINANCE can DELETE technician and service_record rows.
- **Fix:** Split into separate SELECT and ALL policies. FINANCE gets SELECT only.
- **Verify:** FINANCE role DELETE on technicians returns 42501 RLS violation.


### Task 6.10: Fix updateOrderStatus — no state machine enforcement
- **Source:** QA-ORDERS-2026-05-27, QA-INTEGRATION-2026-05-27
- **File:** src/lib/actions/orders.ts:225-299
- **Issue:** updateOrderStatus() accepts any status string and writes it without calling canTransition(). PAID->PENDING, CANCELLED->ASSIGNED all succeed silently.
- **Fix:** Add canTransition(currentStatus, newStatus, callerRole) check at top of updateOrderStatus(). Return error if invalid.
- **Verify:** Attempt PAID->PENDING returns error. Valid transition ASSIGNED->EN_ROUTE succeeds.


### Task 6.11: Fix deleteOrder hard delete — violates soft-delete convention
- **Source:** QA-ORDERS-2026-05-27, QA-INTEGRATION-2026-05-27
- **File:** src/lib/actions/orders.ts:566-590
- **Issue:** deleteOrder() issues hard DELETE permanently removing order + cascade-deleted items, technicians, transitions. Violates CLAUDE.md soft-delete convention.
- **Fix:** Replace with UPDATE orders SET deleted_at=now(). Add deleted_at IS NULL filter to all getOrders queries.
- **Verify:** Deleted order not visible in list but exists in DB with deleted_at set.


### Task 6.12: Fix DISPATCHER/STAFF invalid roles in user create form
- **Source:** QA-MASTER-DATA-2026-05-27
- **File:** src/app/dashboard/manajemen/user/page.tsx:83,327
- **Issue:** Default role is "STAFF" and dropdown offers "DISPATCHER" — neither exist in V2 RBAC. Users created with these roles are locked out of everything.
- **Fix:** Remove DISPATCHER and STAFF from role dropdown. Change default to "TECHNICIAN" or "FINANCE".
- **Verify:** Role dropdown only shows SUPERADMIN, ADMIN, TECHNICIAN, FINANCE.


### Task 6.13: Fix WORKSHOP AC status missing from API schema enum
- **Source:** QA-MASTER-DATA-2026-05-27
- **File:** src/app/api/schemas/index.ts:177
- **Issue:** CreateAcUnitSchema validates status as enum([ACTIVE,INACTIVE,MAINTENANCE]) but UI offers WORKSHOP. Submitting WORKSHOP via API fails validation.
- **Fix:** Add WORKSHOP to CreateAcUnitSchema enum, or remove it from the UI form.
- **Verify:** Create AC unit with status WORKSHOP succeeds via API.


### Task 6.14: Fix specialization column queried but does not exist in V2 schema
- **Source:** QA-MASTER-DATA-2026-05-27, QA-CODE-AUDIT-2026-05-27
- **File:** src/lib/actions/technicians.ts:30-31,207,210,232
- **Issue:** getTechnicians() filters on specialization column and getTechnicianAvailability() selects name,phone,specialization — all V1 columns. Throws runtime Postgres error when filter is used.
- **Fix:** Remove specialization filter from getTechnicians(). Fix getTechnicianAvailability() to use V2 column names: technician_name, contact_number. Remove service_records!inner join.
- **Verify:** getTechnicians() with any filter returns results without DB error.


---

## Phase 7 — Data Integrity & Permissions (PROD BLOCKER)

### Task 7.1: Add recordPayment guards — zero/negative amount and overpayment
- **Source:** QA-INVOICES-2026-05-27
- **File:** src/lib/actions/invoices.ts:1363,1393
- **Issue:** recordPayment() accepts amount=0, negative, and amounts exceeding remaining balance. Zero/negative payments corrupt paid_amount. Overpayment sets paid_amount > total_amount.
- **Fix:** Add guard: if (payment.amount <= 0) throw error. Add guard: if (payment.amount > remaining) throw error. Add DB CHECK constraint: payment_records.amount > 0.
- **Verify:** amount=0 rejected. amount > remaining rejected. Valid partial payment succeeds.

### Task 7.2: Add duplicate reminder dedup DB constraint + fix createManualReminder idempotency
- **Source:** QA-REMINDERS-2026-05-27
- **File:** src/lib/actions/reminders.ts:549-561,961-976
- **Issue:** generateRemindersFromAcUnits deduplicates in memory only — concurrent runs create duplicate rows. createManualReminder does blind insert with no dedup check.
- **Fix:** Add UNIQUE(ac_unit_id, rule_id, due_date) constraint to customer_reminders. Use ON CONFLICT DO NOTHING in both insert paths.
- **Verify:** Concurrent generation runs produce no duplicate rows.

### Task 7.3: Fix generate_invoice_number RPC missing from DB
- **Source:** QA-INVOICES-2026-05-27
- **File:** src/lib/actions/invoices.ts:470
- **Issue:** generate_invoice_number RPC does not exist in DB. Fallback uses Math.random() 4-digit suffix — collision risk under concurrent load.
- **Fix:** Create the RPC in a migration using a sequence-backed function that reads invoice_prefix from invoice_configuration.
- **Verify:** createInvoice() generates sequential invoice numbers without random suffix.

### Task 7.4: Fix order_technicians missing UNIQUE constraint — duplicate lead assignments
- **Source:** QA-ORDERS-2026-05-27
- **File:** src/lib/actions/orders.ts:420-450
- **Issue:** No UNIQUE constraint on (order_id, technician_id, role). Multiple lead rows per order possible. removeHelperTechnician() over-deletes when duplicates exist.
- **Fix:** ALTER TABLE order_technicians ADD CONSTRAINT uq_order_tech_role UNIQUE (order_id, technician_id, role).
- **Verify:** Inserting duplicate (order_id, technician_id, role) returns unique constraint error.

### Task 7.5: Fix cancelOrder allows cancelling PAID orders
- **Source:** QA-ORDERS-2026-05-27
- **File:** src/lib/actions/orders.ts:482-564
- **Issue:** cancelOrder() fetches current status but never checks it. PAID->CANCELLED transition succeeds silently.
- **Fix:** After fetching currentOrder, add: if (currentOrder.status === "PAID") return { success: false, error: "Cannot cancel a paid order" }.
- **Verify:** Cancel on PAID order returns error. Cancel on ASSIGNED order succeeds.

### Task 7.6: Fix toggleUserStatus — deactivated user session not invalidated
- **Source:** QA-MASTER-DATA-2026-05-27
- **File:** src/lib/actions/users.ts:144
- **Issue:** Setting is_active=false only updates user_management table. Active JWT remains valid up to 1 hour. Deactivated user can still make authenticated API calls.
- **Fix:** Call supabaseAdmin.auth.admin.signOut(auth_user_id) after setting is_active=false.
- **Verify:** Deactivated user JWT returns 401 on next API call.

### Task 7.7: Fix deleteUser non-atomic — DB record deleted before auth user
- **Source:** QA-MASTER-DATA-2026-05-27
- **File:** src/lib/actions/users.ts:185,190,201
- **Issue:** deleteUser() deletes user_management first, then auth.users. If auth delete fails, orphaned auth user remains. Also passes null to deleteUser when auth_user_id is null.
- **Fix:** Check auth_user_id is not null before proceeding. Reverse order: delete auth user first, then DB record. Or wrap in try/catch that restores DB record on auth failure.
- **Verify:** Delete user with null auth_user_id returns error without deleting DB record.

### Task 7.8: Fix invoices.status/payment_status/invoice_type — unconstrained TEXT
- **Source:** QA-DB-2026-05-27
- **File:** supabase/migrations/00_v2_schema.sql
- **Issue:** invoices.status, payment_status, invoice_type are TEXT with no CHECK constraint. Any string can be inserted, bypassing the state machine.
- **Fix:** Add CHECK constraints: status IN (DRAFT,SENT,PARTIAL_PAID,PAID,CANCELLED,OVERDUE), payment_status IN (UNPAID,PARTIAL,PAID,FAILED,REFUNDED), invoice_type IN (PROFORMA,FINAL).
- **Verify:** INSERT with invalid status value returns constraint violation.

### Task 7.9: Fix missing DB indexes on hot FK columns
- **Source:** QA-DB-2026-05-27
- **File:** supabase/migrations/00_v2_schema.sql
- **Issue:** Missing indexes on locations.customer_id, invoice_items.invoice_id, invoice_communications.invoice_id, service_records.order_id, service_records.technician_id, order_items.ac_unit_id. Full table scans on every page load.
- **Fix:** Add indexes: CREATE INDEX idx_locations_customer ON locations(customer_id); CREATE INDEX idx_invoice_items_invoice ON invoice_items(invoice_id); CREATE INDEX idx_invoice_comms_invoice ON invoice_communications(invoice_id); CREATE INDEX idx_service_records_order ON service_records(order_id); CREATE INDEX idx_service_records_tech ON service_records(technician_id); CREATE INDEX idx_order_items_ac_unit ON order_items(ac_unit_id).
- **Verify:** EXPLAIN on customer location query shows index scan.

### Task 7.10: Fix order_technicians.role has no CHECK constraint
- **Source:** QA-DB-2026-05-27
- **File:** supabase/migrations/00_v2_schema.sql
- **Issue:** order_technicians.role is VARCHAR with no constraint. A typo ("Lead" vs "lead") silently breaks the RLS policy orders_tech_update_own which checks role = "lead".
- **Fix:** ALTER TABLE order_technicians ADD CONSTRAINT order_technicians_role_check CHECK (role IN ('lead', 'support'));
- **Verify:** INSERT with role="Lead" returns constraint violation.

### Task 7.11: Fix SECURITY DEFINER functions missing SET search_path
- **Source:** QA-DB-2026-05-27, QA-AUTH-2026-05-27
- **File:** supabase/migrations/01_v2_rls.sql:7-16
- **Issue:** current_user_role() and current_technician_id() are SECURITY DEFINER without SET search_path. A malicious user who can create objects in a schema earlier in the search path could shadow public.user_management and return an arbitrary role.
- **Fix:** Add SET search_path = public, pg_temp to both functions.
- **Verify:** Functions execute correctly after search_path fix.

### Task 7.12: Fix service_report duplicate submission race condition
- **Source:** QA-TECHNICIAN-2026-05-27
- **File:** src/app/api/technician/jobs/[id]/report/route.ts:92-103
- **Issue:** Duplicate-report check is SELECT then INSERT with no transaction or unique constraint. Two concurrent POST requests both pass the check and insert two service_reports rows for the same order+technician, corrupting billing.
- **Fix:** Add UNIQUE constraint on (order_id, technician_id) in service_reports (filtered on deleted_at IS NULL). Use ON CONFLICT DO NOTHING or wrap in RPC.
- **Verify:** Two concurrent report submissions produce only one row.


---

## Phase 8 — Feature Correctness (Strongly Recommended)

### Task 8.1: Fix /api/customers GET allows unauthenticated access
- **Source:** QA-API-2026-05-27
- **File:** src/app/api/customers/route.ts:27-29
- **Issue:** requireAuth is called but result never checked. Null user proceeds normally, exposing all customer PII to anonymous callers.
- **Fix:** Add: if (!user) return jsonError("Unauthorized", 401) after requireAuth call.
- **Verify:** GET /api/customers without token returns 401.

### Task 8.2: Fix signature URL stored as expiring signed URL
- **Source:** QA-TECHNICIAN-2026-05-27
- **File:** src/components/technician/complete-job-form.tsx:214-218
- **Issue:** createSignedUrl(..., 60*60*24*365) produces a URL expiring in 1 year stored permanently in service_reports.customer_signature_url. After expiry the signature is inaccessible — legal/audit risk.
- **Fix:** Store the storage path instead of the signed URL. Generate signed URLs on demand at read time.
- **Verify:** Signature URL in DB is a storage path, not a signed URL.

### Task 8.3: Fix pushsubscriptionchange sends no auth credentials
- **Source:** QA-TECHNICIAN-2026-05-27, QA-INTEGRATION-2026-05-27
- **File:** public/technician-sw.js:164-168
- **Issue:** SW pushsubscriptionchange handler POSTs to /api/technician/push/subscribe with no Authorization header. Subscribe endpoint requires auth. Every key rotation silently fails — push stops working.
- **Fix:** Store Supabase session token in IndexedDB from the app. Read it in the SW and include as Bearer token. Or use credentials:include if cookie forwarding is supported.
- **Verify:** After browser key rotation, technician still receives push notifications.

### Task 8.4: Fix next.config.js — missing security headers and public dashboard cache
- **Source:** QA-INTEGRATION-2026-05-27
- **File:** next.config.js:29-44
- **Issue:** No CSP, HSTS, X-Frame-Options, X-Content-Type-Options headers. Dashboard Cache-Control is "public, s-maxage=60" — CDN can serve one user's financial data to another.
- **Fix:** Add X-Frame-Options:DENY, X-Content-Type-Options:nosniff, Referrer-Policy:strict-origin-when-cross-origin, HSTS to headers(). Change dashboard Cache-Control to "private, no-store".
- **Verify:** curl -I shows security headers. Dashboard response has private,no-store.

### Task 8.5: Fix next.config.js — images.domains deprecated in Next.js 15
- **Source:** QA-INTEGRATION-2026-05-27
- **File:** next.config.js:23-27
- **Issue:** images.domains is deprecated/removed in Next.js 15. May silently break next/image optimization for Supabase storage assets.
- **Fix:** Replace with remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }].
- **Verify:** next/image renders Supabase storage images without error.

### Task 8.6: Fix order-notifications.tsx — Supabase client created every 10 seconds
- **Source:** QA-INTEGRATION-2026-05-27
- **File:** src/components/order-notifications.tsx:57,114,146-150
- **Issue:** fetchNotifications creates a new Supabase client on every 10-second poll tick (~2880 instances per 8-hour session). localStorage readNotifications array grows unboundedly.
- **Fix:** Hoist Supabase client creation to useRef or module scope. Prune localStorage array to only IDs within the 7-day window on each write.
- **Verify:** After 1 hour of polling, only 1 Supabase client instance exists.

### Task 8.7: Fix markReminderSent/Failed/Dismissed use wrong role check + no status guard
- **Source:** QA-REMINDERS-2026-05-27
- **File:** src/lib/actions/reminders.ts:314,309-343
- **Issue:** markReminderSent/Failed/Dismissed check READ_ROLES (includes FINANCE) instead of WRITE_ROLES. markReminderSent has no status pre-check — re-sending overwrites original sent_at timestamp.
- **Fix:** Change auth check to WRITE_ROLES. Add .eq("status","PENDING") to markReminderSent update filter.
- **Verify:** FINANCE cannot call markReminderSent. Re-sending already-SENT reminder returns error.

### Task 8.8: Fix getInvoiceStats full table scan — use DB aggregates
- **Source:** QA-INTEGRATION-2026-05-27, QA-INVOICES-2026-05-27
- **File:** src/lib/actions/invoices.ts:1510-1562
- **Issue:** getInvoiceStats fetches all invoice rows to Node.js for JS-side aggregation. Full table scan on every dashboard load. Also: OVERDUE filter pagination count is wrong (returns full table count).
- **Fix:** Replace JS reduce with DB-side SUM aggregates using .select("sum(total_amount)"). Fix OVERDUE filter to return correct filtered count.
- **Verify:** Dashboard KPI loads in <200ms with 10k invoices.

### Task 8.9: Fix assign-order page uses invalid status filter ACCEPTED/RESCHEDULE
- **Source:** QA-CODE-AUDIT-2026-05-27
- **File:** src/app/dashboard/operasional/assign-order/page.tsx:63
- **Issue:** Page queries statusIn:"ACCEPTED,RESCHEDULE" — neither are valid V2 statuses. Page always shows no orders.
- **Fix:** Change to statusIn:"PENDING" (and optionally "ASSIGNED" for reassignment).
- **Verify:** Assign-order page shows PENDING orders.

### Task 8.10: Fix /api/orders/create items array silently dropped
- **Source:** QA-API-2026-05-27
- **File:** src/app/api/orders/create/route.ts:56-65
- **Issue:** items is validated in CreateOrderSchema and destructured but never passed to createOrder(). Order items are silently dropped on API order creation.
- **Fix:** Pass items to createOrder() call, or remove from schema if intentionally unused.
- **Verify:** POST /api/orders/create with items array creates order with items.

### Task 8.11: Fix /api/service-records/[id]/complete stub — always returns fake success
- **Source:** QA-API-2026-05-27
- **File:** src/app/api/service-records/[id]/complete/route.ts:56-65
- **Issue:** Handler has TODO comment and returns hardcoded success without touching DB. Any POST returns 200 with fake data.
- **Fix:** Implement actual DB update or remove the endpoint and return 501 until ready.
- **Verify:** POST to endpoint either updates DB correctly or returns 501.

### Task 8.12: Fix calculateInvoiceTotals — addons_subtotal always equals subtotal
- **Source:** QA-INVOICES-2026-05-27
- **File:** src/lib/actions/invoices.ts:302
- **Issue:** addons_subtotal is set to safeSubtotal (full subtotal) instead of ADDON items only. Field is always wrong for mixed-type invoices.
- **Fix:** Compute addons_subtotal as items.filter(i => i.item_type === "ADDON").reduce((s,i) => s + i.total_price, 0) before calling calculateInvoiceTotals().
- **Verify:** Invoice with BASE_SERVICE + ADDON items shows correct addons_subtotal.

### Task 8.13: Fix Realtime WebSocket leak — new client per subscription
- **Source:** QA-INTEGRATION-2026-05-27
- **File:** src/lib/realtime.ts:5-36
- **Issue:** Each subscribe* call creates a new Supabase client with its own WebSocket. No deduplication guard. Under React StrictMode, connections accumulate indefinitely.
- **Fix:** Share a single module-level Supabase realtime client. Track active channels in a Map keyed by channel name; return existing subscription if already active.
- **Verify:** Multiple subscribeOrders() calls result in only one WS connection.

### Task 8.14: Fix today jobs query uses server UTC date — wrong for WIB technicians
- **Source:** QA-TECHNICIAN-2026-05-27, QA-API-2026-05-27
- **File:** src/app/api/technician/jobs/today/route.ts:21-24
- **Issue:** startOfDay/endOfDay computed from server UTC. Technician in UTC+7 at 23:00 local sees tomorrow jobs as today. scheduled_visit_date is a DATE column.
- **Fix:** Accept optional ?date=YYYY-MM-DD query param from client. Compare scheduled_visit_date directly as DATE string without ISO timestamp conversion.
- **Verify:** Technician in UTC+7 at 23:00 local sees correct today jobs.


---

## Phase 9 — UX Polish (No prod blocker)

### Task 9.1: Fix technician layout userScalable:false — WCAG 1.4.4 violation
- **Source:** QA-UI-2026-05-27
- **File:** src/app/technician/layout.tsx:20
- **Issue:** userScalable:false in viewport meta prevents zoom. WCAG 1.4.4 Level AA violation. Technicians with low vision cannot zoom the mobile app.
- **Fix:** Remove userScalable:false from viewport config.
- **Verify:** Technician app can be pinch-zoomed on mobile.

### Task 9.2: Fix dashboard layout fixed inset-0 overflow-hidden traps scroll on iOS
- **Source:** QA-UI-2026-05-27
- **File:** src/app/dashboard/layout.tsx:19
- **Issue:** Root wrapper fixed inset-0 overflow-hidden traps scroll context. On iOS Safari, virtual keyboard causes content clipping.
- **Fix:** Replace with flex-column layout that does not trap scroll context.
- **Verify:** Dashboard usable on iOS Safari with virtual keyboard open.

### Task 9.3: Add aria-label to all icon-only buttons
- **Source:** QA-UI-2026-05-27
- **File:** src/app/dashboard/manajemen/customer/page.tsx:534, manajemen/teknisi/page.tsx:357, settings/reminder-rules/page.tsx:572, keuangan/invoices/[id]/page.tsx:673
- **Issue:** Edit/Delete icon buttons across 4+ pages have no aria-label. Screen readers announce "button" with no context.
- **Fix:** Add aria-label="Edit [item]" and aria-label="Delete [item]" to all icon-only buttons.
- **Verify:** Screen reader announces button purpose correctly.

### Task 9.4: Fix orders page Suspense fallback is null
- **Source:** QA-UI-2026-05-27
- **File:** src/app/dashboard/orders/page.tsx:6
- **Issue:** Suspense fallback={null} — primary workflow page shows nothing while loading.
- **Fix:** Add fallback={<OrdersPageSkeleton />} to Suspense boundary.
- **Verify:** Orders page shows skeleton while loading.

### Task 9.5: Fix dashboard quick action links point to legacy operasional routes
- **Source:** QA-UI-2026-05-27
- **File:** src/app/dashboard/page.tsx:355,369
- **Issue:** Quick action links point to /dashboard/operasional/create-order and /dashboard/operasional/assign-order. Recent orders "View All" links to /dashboard/operasional/monitoring-ongoing. All are legacy routes.
- **Fix:** Update to /dashboard/orders/new, /dashboard/orders?view=board, /dashboard/orders.
- **Verify:** Quick action links navigate to correct V2 routes.

### Task 9.6: Fix hardcoded dark-mode-incompatible colors
- **Source:** QA-UI-2026-05-27
- **File:** src/app/dashboard/operasional/create-order/page.tsx:886, keuangan/invoices/[id]/page.tsx:802
- **Issue:** bg-blue-50, text-blue-900, text-gray-700/600/800 are hardcoded light-mode colors. Invisible or broken in dark mode.
- **Fix:** Replace with CSS variable equivalents: bg-blue-50->bg-primary/10, text-blue-900->text-primary, text-gray-*->text-muted-foreground.
- **Verify:** Pages render correctly in dark mode.

### Task 9.7: Fix invoice detail back button uses router.back() with no fallback
- **Source:** QA-UI-2026-05-27
- **File:** src/app/dashboard/keuangan/invoices/[id]/page.tsx:673
- **Issue:** Back button uses router.back() — if user navigated directly to invoice URL (e.g. from email link), router.back() goes outside the app.
- **Fix:** Use router.back() with fallback: if no history, navigate to /dashboard/keuangan/invoices.
- **Verify:** Direct URL access to invoice detail — back button goes to invoice list.

### Task 9.8: Fix customer detail "Buat Order" links to deprecated route
- **Source:** QA-MASTER-DATA-2026-05-27, QA-UI-2026-05-27
- **File:** src/app/dashboard/manajemen/customer/[id]/page.tsx:1464
- **Issue:** Empty state action uses window.location.href to /dashboard/operasional/create-order — deprecated route, causes full page reload, loses React state.
- **Fix:** Use router.push("/dashboard/orders/new?customerId=${customerId}") instead.
- **Verify:** Buat Order button navigates to V2 order creation page without full reload.

### Task 9.9: Fix location popover renders stale V1 fields
- **Source:** QA-MASTER-DATA-2026-05-27
- **File:** src/app/dashboard/manajemen/customer/page.tsx:494
- **Issue:** Location popover renders V1 fields (building_name, floor, room_number) that no longer exist in V2. Always shows empty values.
- **Fix:** Replace with V2 fields: full_address, house_number, city, landmarks.
- **Verify:** Location popover shows actual address data.

### Task 9.10: Fix date picker calendar has no locale prop — displays English
- **Source:** QA-UI-2026-05-27
- **File:** src/app/dashboard/orders/new/page.tsx:1025
- **Issue:** Date picker calendar has no locale prop — month/day names display in English (en-US) while rest of app uses Indonesian.
- **Fix:** Add locale={id} from date-fns/locale to all Calendar components.
- **Verify:** Date picker shows Indonesian month/day names.


---

## Skipped Findings

| Source | Finding | Reason |
|--------|---------|--------|
| QA-REMINDERS | F-002 days_before_due no upper bound | LOW risk, UI already caps at 90 |
| QA-REMINDERS | F-003 updateReminderRule silent on missing ID | UX only, not data corruption |
| QA-REMINDERS | F-004 deleteReminderRule silent success | UX only |
| QA-REMINDERS | F-005 revalidatePath wrong route | Dead code, no user impact |
| QA-REMINDERS | F-006 auto_send flag not implemented | Feature gap, not a bug |
| QA-REMINDERS | F-007/F-008 template rendering edge cases | INFO only |
| QA-REMINDERS | F-010 message length not truncated | LOW, DB will error if exceeded |
| QA-REMINDERS | F-012 overdue units excluded from generation | Policy decision, not a bug |
| QA-REMINDERS | F-013 dedup excludes DISMISSED/FAILED | Acceptable behavior |
| QA-REMINDERS | F-023/F-029/F-042 pagination limits | Performance, not correctness |
| QA-REMINDERS | F-034 CRON_SECRET not set | Deployment config, not code |
| QA-REMINDERS | F-036/F-037 HTTP 403 vs 401, missing rulesScanned | LOW, non-breaking |
| QA-INTEGRATION | Realtime optimistic mutation race | Acceptable UX artifact |
| QA-INTEGRATION | No reconnect handler | Supabase auto-reconnects |
| QA-INTEGRATION | queryKey collision risk | Low impact with current usage |
| QA-INTEGRATION | No gcTime configured | Default 5min is fine |
| QA-INTEGRATION | iOS Safari push quirks | Out of scope for staging |
| QA-INTEGRATION | Push payload PII exposure | LOW, internal order IDs only |
| QA-INTEGRATION | Resend idempotency tokens | Nice-to-have |
| QA-INTEGRATION | jsPDF large invoice OOM | Edge case, not common |
| QA-INTEGRATION | Date locale inconsistency | Covered in Phase 9 |
| QA-INTEGRATION | No healthcheck endpoint | Out of scope for staging |
| QA-INTEGRATION | Docker log rotation | Infrastructure, not code |
| QA-INTEGRATION | No DB connection pooling docs | Documentation only |
| QA-INVOICES | F-003 updateReminderRule raw error message | UX only |
| QA-INVOICES | createInvoice no duplicate FINAL guard | MEDIUM, add in next sprint |
| QA-INVOICES | proforma tax calculation discount | MEDIUM, add in next sprint |
| QA-INVOICES | PDF multi-page footer hardcoded | LOW, cosmetic |
| QA-INVOICES | PDF negative balance due | LOW, cosmetic |
| QA-INVOICES | date-fns TypeScript errors | Build warning only |
| QA-MASTER-DATA | No phone uniqueness at action layer | DB constraint handles it |
| QA-MASTER-DATA | No email format validation in action | API schema validates |
| QA-MASTER-DATA | No input trimming | LOW, cosmetic |
| QA-MASTER-DATA | Search pagination count mismatch | MEDIUM, next sprint |
| QA-MASTER-DATA | Soft delete not implemented for customers | Tracked separately |
| QA-MASTER-DATA | deleteTechnician no order guard | MEDIUM, next sprint |
| QA-MASTER-DATA | AC unit fetch limit:1000 client-side filter | Performance, next sprint |
| QA-TECHNICIAN | HIGH-2 helper role sees full order detail | Policy decision |
| QA-TECHNICIAN | HIGH-3 legacy status transition edge cases | Needs test coverage |
| QA-TECHNICIAN | HIGH-6 history N+1 query | Performance, next sprint |
| QA-TECHNICIAN | HIGH-7 photo not deleted from storage | Storage cost, not correctness |
| QA-TECHNICIAN | MEDIUM-1 auto-price stale closure | Edge case |
| QA-TECHNICIAN | MEDIUM-3 work timer resets | UX only |
| QA-TECHNICIAN | MEDIUM-4 page-number pagination | Nice-to-have |
| QA-CATALOG | CRITICAL-1 toggleCatalogActive stale ID | Race condition, very low probability |
| QA-CATALOG | HIGH-3 bulkUpdateStock no transaction | MEDIUM risk, next sprint |
| QA-CATALOG | HIGH-4 service_pricing vs service_catalog precedence | Legacy coexistence, documented |
| QA-CATALOG | MEDIUM-7 dual edit surfaces | Tech debt, next sprint |
| QA-API | F-04 no RBAC beyond auth on several routes | MEDIUM, next sprint |
| QA-API | F-13 no pagination on invoice list | MEDIUM, next sprint |
| QA-API | F-20 timingSafeEqual length leak | LOW, theoretical |
| QA-API | F-26/F-27 no CORS, no rate limiting | Out of scope for staging |
| QA-AUTH | H1 middleware cache no logout invalidation | 30s window, acceptable |
| QA-AUTH | H2 getUserRole uses .single() | LOW impact |
| QA-AUTH | H3 FINANCE middleware route gap | RLS provides secondary gate |
| QA-AUTH | M1 duplicate createClient | Tech debt |
| QA-AUTH | M2 no TanStack cache clear on logout | UX edge case |
| QA-AUTH | M3 hasAccess() FINANCE/TECHNICIAN equal weight | Low blast radius |
| QA-DB | Missing CASCADE on service_reports/records | Soft-delete convention prevents hard deletes |
| QA-DB | payments table legacy/dead | No data, no impact |
| QA-DB | orders.order_date DATE not TIMESTAMPTZ | created_at TIMESTAMPTZ exists |
| QA-CODE-AUDIT | Suspense boundary missing useSearchParams | MEDIUM, next sprint |
| QA-CODE-AUDIT | Inconsistent query key patterns | Tech debt |
| QA-CODE-AUDIT | Duplicate getTechnicians function | Tech debt |
| QA-UI | R-02 through R-10 responsive issues | Polish, next sprint |
| QA-UI | LOC-01 through LOC-08 localization | Polish, next sprint |
| QA-UI | LS-03 through LS-07 loading states | Polish, next sprint |
| QA-UI | E-01 through E-04 empty states | Polish, next sprint |
| QA-UI | ER-01 through ER-05 error states | Polish, next sprint |
| QA-UI | T-01 through T-06 toast feedback | Polish, next sprint |
| QA-UI | F-01 through F-08 form issues | Polish, next sprint |
| QA-UI | P-01 through P-05 performance | Next sprint |
