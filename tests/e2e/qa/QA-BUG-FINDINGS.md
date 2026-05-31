# QA E2E Business-Process Gap-Fill — Bug & Error Findings Log

> Documented during the G1–G13 gap spec creation and staging verification (Wave 0–3).
> Every entry includes: **file + line**, **root cause**, **impact**, and **concrete to-do** so a fixer can resolve it without re-exploring the codebase.

---

## Table of Contents

1. [Critical Production Bugs (2)](#1-critical-production-bugs)
2. [Known Staging/Test Infrastructure Gaps (4)](#2-known-stagingtest-infrastructure-gaps)
3. [Spec-Level Selector/Assertion Issues (5)](#3-spec-level-selectorassertion-issues)
4. [Fixture/Code Quality Fixes Already Applied (4)](#4-fixturecode-quality-fixes-already-applied)
5. [Staging Environment Issues (3)](#5-staging-environment-issues)

---

## 1. Critical Production Bugs

These are **real application bugs** discovered by the gap specs. They are documented via `qaTest.fail()` in the test suite. **Do NOT remove the `qaTest.fail()` annotation until the application code is fixed and the test starts turning red.**

---

### BUG-001: Payment Allowed on DRAFT Invoice

| Field | Detail |
|-------|--------|
| **Severity** | 🔴 High |
| **Test** | `tests/e2e/qa/G05-payment-modal.spec.ts` — `qaTest.fail()` at line 443 |
| **App Code** | `src/lib/actions/invoices.ts` — `recordPayment()` lines 1371–1410 |
| **Description** | The `recordPayment` server action accepts a payment for an invoice whose `status === 'DRAFT'`. A DRAFT invoice should never accept payments — it hasn't been sent to the customer yet. |
| **Root Cause** | `recordPayment()` fetches the invoice row (line 1389–1398) but does NOT check `invoice.status !== 'DRAFT'` before inserting the `payment_records` row. It only validates amount > 0 and that `paid_amount + amount ≤ total_amount`. |
| **Impact** | Finance users can accidentally record payments on draft invoices, corrupting the order lifecycle (DRAFT → PAID skip) and making the invoice uneditable. |
| **To-Do (Concrete)** | In `src/lib/actions/invoices.ts` inside `recordPayment()`, after fetching the invoice (around line 1398), add: ```typescript if (invoice.status === 'DRAFT') {   throw new Error('Invoice masih dalam status DRAFT. Kirim invoice terlebih dahulu sebelum mencatat pembayaran.') } ``` |
| **Verification** | After fix, run `npx playwright test --project=qa --workers=1 tests/e2e/qa/G05-payment-modal.spec.ts --grep "KNOWN-BUG"`. The test should turn **red** (unexpected pass). Then remove the `qaTest.fail()` annotation and the `// KNOWN-BUG` comments from `G05-payment-modal.spec.ts`. |

---

### BUG-002: PAID Invoice Can Be Arbitrarily Set to CANCELLED

| Field | Detail |
|-------|--------|
| **Severity** | 🔴 High |
| **Test** | `tests/e2e/qa/G12-invoice-cancel-void.spec.ts` — `qaTest.fail()` at line 363 |
| **App Code** | `src/lib/actions/invoices.ts` — `updateInvoiceStatus()` lines 1472–1509 |
| **Description** | `updateInvoiceStatus()` accepts `'CANCELLED'` for an invoice in **any** status, including `'PAID'`. A PAID invoice should NOT be cancellable — it has already been settled. The function does sync the order back to `'COMPLETED'` on cancel, but it should reject the transition entirely for PAID. |
| **Root Cause** | The function's signature accepts any of `'DRAFT' | 'SENT' | 'PARTIAL_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED'` (line 1474) with zero state-machine validation. There is no guard like: "if current status is PAID, reject CANCELLED". |
| **Impact** | Post-payment cancellation corrupts revenue tracking, refunds are not modelled, and the order reverts to COMPLETED while money was already taken. |
| **To-Do (Concrete)** | In `src/lib/actions/invoices.ts` inside `updateInvoiceStatus()`, after fetching the existing invoice (before line 1483), add a state-machine guard: ```typescript const allowedFrom: Record<string, string[]> = {   DRAFT: ['SENT', 'CANCELLED'],   SENT: ['PARTIAL_PAID', 'PAID', 'OVERDUE', 'CANCELLED'],   PARTIAL_PAID: ['PAID', 'OVERDUE', 'CANCELLED'],   PAID: [], // terminal — no outbound transitions   OVERDUE: ['PAID', 'CANCELLED'],   CANCELLED: [], // terminal } if (!allowedFrom[invoice.status]?.includes(status)) {   throw new Error(`Transisi dari ${invoice.status} ke ${status} tidak diizinkan`) } ``` |
| **Verification** | After fix, run `npx playwright test --project=qa --workers=1 tests/e2e/qa/G12-invoice-cancel-void.spec.ts --grep "KNOWN-BUG"`. The test turns **red** (unexpected pass). Then remove `qaTest.fail()` + `// KNOWN-BUG` comments from the spec. |

---

## 2. Known Staging/Test Infrastructure Gaps

These are **pre-existing gaps** in the staging environment or test infrastructure. They are NOT application bugs, but they block some specs from running cleanly on staging.

---

### INFRA-001: `technician_submit_report_v2` RPC Missing on Staging

| Field | Detail |
|-------|--------|
| **Severity** | 🟡 Medium (mitigated) |
| **Test Impact** | Any spec that uses `seedOrderToState()` with target `'COMPLETED'` or `'INVOICED'` |
| **Affected Specs** | G04, G05, G06, G07, G12 (before fix), existing R-01, R-07, R-09, R-10, R-13, R-16 |
| **Description** | The `technicianSubmitReport()` helper calls `/api/technician/jobs/{id}/report` which relies on a `technician_submit_report_v2` RPC. This RPC exists in local dev but **does not exist on the staging Supabase project**. The API returns 500 / "function not found". |
| **Root Cause** | The RPC was deployed to local/dev but never pushed to the staging Supabase project. |
| **Impact** | Without the fallback in `gap-helpers.ts`, all specs using `seedOrderToState()` would crash on staging. |
| **Mitigation Applied** | `tests/e2e/qa/fixtures/gap-helpers.ts` lines 118–212: `seedOrderToState()` wraps `technicianSubmitReport()` in `try/catch`. On RPC-not-found error, it falls back to **direct DB insert** via admin client (`getSupabaseAdmin()`): inserts `service_reports` row + `order_status_transitions` row. This is marked with `[seedOrderToState-fallback]` in notes so it can be identified and cleaned. |
| **To-Do (Concrete)** | 1. Deploy `technician_submit_report_v2` SQL function to staging Supabase (migration file: look for `CREATE OR REPLACE FUNCTION technician_submit_report_v2(...)` in `/migrations` or `supabase/migrations`). 2. Once deployed, remove the `try/catch` fallback block from `gap-helpers.ts` lines 157–212 to keep the fixture honest (it should call the real API). 3. Verify by running `npx playwright test --project=qa --workers=1 tests/e2e/qa/R01-happy-path.spec.ts` on staging — it should pass without hitting the fallback. |

---

### INFRA-002: `batchgenerateproforma` RPC Missing on Staging

| Field | Detail |
|-------|--------|
| **Severity** | 🟡 Medium |
| **Test Impact** | Existing baseline spec R-02 (Cancel at PENDING) |
| **Description** | The R-02 baseline test references `batchgenerateproforma` RPC which doesn't exist on staging. This causes a 500 when the test tries to trigger proforma generation. |
| **Root Cause** | Same as INFRA-001 — RPC not deployed to staging. |
| **To-Do (Concrete)** | Deploy the `batchgenerateproforma` SQL function to staging, or document that R-02 is expected to skip on staging until the RPC is available. |

---

### INFRA-003: `seedOrderToState` Transition Loop Included `'ASSIGNED'`

| Field | Detail |
|-------|--------|
| **Severity** | 🟡 Medium (fixed) |
| **File** | `tests/e2e/qa/fixtures/gap-helpers.ts` line 78–83 |
| **Also Affected** | `tests/e2e/qa/G04-invoice-from-order.spec.ts` line 118–139 (spec-local duplicate) |
| **Description** | `seedOrderToState()` advanced the order through `['ASSIGNED', 'EN_ROUTE', 'IN_PROGRESS', 'COMPLETED']` via `technicianTransition()`. However, `assignLeadTechnician()` (called just before) already sets the order to `'ASSIGNED'` via admin client. Calling `technicianTransition()` with `'ASSIGNED'` caused the staging API to return 400: "Invalid enum value. Expected 'EN_ROUTE' | 'IN_PROGRESS' | 'COMPLETED', received 'ASSIGNED'". |
| **Root Cause** | The technician transition endpoint is designed for field technicians to move orders forward (EN_ROUTE onwards), not for the initial ASSIGNED state which is set by the admin assignment action. |
| **Impact** | Blocked 5 gap specs (G04–G07, G12) and potentially existing specs that used `seedOrderToState()`. |
| **Fix Applied** | Removed `'ASSIGNED'` from the transition array in both `gap-helpers.ts` (line 79) and `G04-invoice-from-order.spec.ts` (line 120). Loop now correctly goes `EN_ROUTE → IN_PROGRESS → COMPLETED`. |
| **To-Do (Concrete)** | Nothing — already fixed. Verify by running any spec that uses `seedOrderToState()` on staging. |

---

### INFRA-004: G04 Spec Had Local Duplicate Transition Loop

| Field | Detail |
|-------|--------|
| **Severity** | 🟡 Low (fixed) |
| **File** | `tests/e2e/qa/G04-invoice-from-order.spec.ts` lines 118–139 |
| **Description** | G04 implemented its own `noReportTransition()` loop that also included `'ASSIGNED'`, duplicating the bug in `gap-helpers.ts`. This was missed when the fixture was fixed because it was spec-local code, not in the shared fixture. |
| **Fix Applied** | Removed `'ASSIGNED'` from the local loop (line 120). |
| **To-Do (Concrete)** | Nothing — already fixed. |

---

## 3. Spec-Level Selector / Assertion Issues

These are **test code issues** (not app bugs) that cause specs to fail on staging due to selector brittleness, timing, or mismatch with the actual staging UI. They require updates to the spec files themselves.

---

### SPEC-001: G04 — Order Row Hidden on List View (Strict Mode Violation → Visibility)

| Field | Detail |
|-------|--------|
| **Severity** | 🟡 Medium |
| **File** | `tests/e2e/qa/G04-invoice-from-order.spec.ts` line 173–174 |
| **Description** | The test navigates to `/dashboard/orders?view=list`, then asserts `adminPage.locator('tr', { hasText: happyOrderId }).toBeVisible()`. Two problems: (1) the `locator('tr', { hasText: ... })` resolved to **4 rows** (strict mode violation) because both the "with-report" and "no-report" orders share the same prefix in their IDs. (2) After adding `.first()` to fix strict mode, the row was reported as **hidden** — likely the table is behind a loading skeleton or the list view hasn't fully hydrated. |
| **Root Cause** | The orders list table uses dynamic rendering. Rows may exist in the DOM but be hidden until the TanStack Table data is loaded and rendered. The test doesn't wait for the table to be fully visible. |
| **Impact** | G04 cannot reliably click the order row to open the detail panel, blocking the invoice creation flow test. |
| **To-Do (Concrete)** | In `G04-invoice-from-order.spec.ts` line 173–174, replace: ```typescript const orderRow = adminPage.locator('tr', { hasText: happyOrderId }).first() await expect(orderRow).toBeVisible({ timeout: 15_000 }) ``` with: ```typescript // Wait for table to be fully rendered (not in skeleton state) const table = adminPage.locator('[data-testid="orders-table"], table') await expect(table).toBeVisible({ timeout: 15_000 }) // Then find the specific row const orderRow = adminPage.getByRole('row', { name: new RegExp(happyOrderId) }).first() await expect(orderRow).toBeVisible({ timeout: 10_000 }) ``` Also ensure the order IDs are fully distinct so `hasText` doesn't match multiple rows. Consider using `data-testid="order-row-${orderId}"` if available, or adding it to the row component. |

---

### SPEC-002: G05 — Invoice Detail Page Shows "Invoice tidak ditemukan"

| Field | Detail |
|-------|--------|
| **Severity** | 🟡 Medium |
| **File** | `tests/e2e/qa/G05-payment-modal.spec.ts` — affects the full-payment and partial-balance tests |
| **Description** | The test seeds an invoice via `seedInvoice()` (admin client, service role), then navigates to `/dashboard/keuangan/invoices/{invoiceId}` as a logged-in finance user. The page renders "Invoice tidak ditemukan" instead of the invoice detail. The "Record Payment" button is never found because the invoice content isn't rendered. |
| **Root Cause** | **Hypothesis 1 (RLS):** The finance user's Supabase session respects RLS. The invoice was inserted with admin client (bypasses RLS), but when the finance user's browser fetches it via `getInvoiceById()` (which uses `createClient()` = regular client with RLS), the row might be invisible if RLS policies require certain conditions (e.g., the invoice must be linked to a location accessible by the user). **Hypothesis 2 (Missing Required Field):** The seeded invoice might be missing a column that `getInvoiceById()` requires in its `.select()` join, causing the query to silently return null. **Hypothesis 3 (UUID vs Text):** The `invoice_id` column in the migration is `UUID`, but the app code treats it as `string`. The seed function uses `crypto.randomUUID()` which generates a valid UUID, so this is likely NOT the cause. |
| **Impact** | G05 can only run the first test (full-payment) when the invoice IS found; the partial-balance test times out on page.goto. This blocks payment modal validation. |
| **To-Do (Concrete)** | **Step 1 — Debug:** Run this diagnostic on staging: ```bash cd /home/ubuntu/projectpenting/webpanel && PLAYWRIGHT_BASE_URL=https://v2.nufnh.my.id PLAYWRIGHT_SKIP_WEBSERVER=1 npx playwright test --project=qa --workers=1 tests/e2e/qa/G05-payment-modal.spec.ts --grep "full" 2>&1 ``` Check if the first test passes (invoice found) and the second fails (different invoice ID). **Step 2 — Check RLS:** Log into Supabase Dashboard (staging project), go to Table Editor → `invoices` → RLS policies. Check if any policy restricts rows based on `location_id` or user role. If so, ensure the seeded invoice has the required `location_id` linked to the finance user's accessible locations. **Step 3 — Fix Seed:** In `G05-payment-modal.spec.ts` `seedInvoice()` function (line 55), add: ```typescript location_id: opts.locationId, // pass from scenario.locationId ``` And when calling `seedInvoice()`, pass `scenario.locationId`. **Step 4 — Alternative:** If RLS is not the issue, the invoice detail page might require `invoice_items` rows to exist. Check if `getInvoiceById()` joins `invoice_items` and fails when none exist. If so, also seed an `invoice_items` row in `seedInvoice()`. |

---

### SPEC-003: G06 / G07 — No FINAL Invoice After `seedOrderToState(..., 'INVOICED')`

| Field | Detail |
|-------|--------|
| **Severity** | 🟡 Medium |
| **Files** | `tests/e2e/qa/G06-pdf-export.spec.ts` line 66–68, `tests/e2e/qa/G07-email-send.spec.ts` line 50–52 |
| **Description** | Both specs call `seedOrderToState(scenario, 'INVOICED', ...)` and then immediately do `snapshot.invoices.find((i) => i.invoiceType === 'FINAL')`. This returns `undefined` because `seedOrderToState()` only patches the order status to `'INVOICED'` — it does NOT create a `FINAL` invoice. The test then throws `'No FINAL invoice found after seedOrderToState'`. |
| **Root Cause** | `seedOrderToState()` does not auto-create an invoice. In the real app, a FINAL invoice is created by the `createInvoiceFromOrder` server action (triggered from the UI when admin clicks "Buat Invoice" on a COMPLETED order). The fixture bypasses the UI and just sets the status. |
| **Impact** | G06 and G07 cannot proceed past the `beforeAll` / test setup phase. |
| **To-Do (Concrete)** | In both `G06-pdf-export.spec.ts` and `G07-email-send.spec.ts`, after the `seedOrderToState()` call, add a fallback that creates a FINAL invoice via admin client if `snapshot.invoices` is empty. Example code to insert after `seedOrderToState()`: ```typescript const SUPABASE = getSupabaseAdmin() let finalInv = snapshot.invoices.find((i) => i.invoiceType === 'FINAL') if (!finalInv) {   const invId = crypto.randomUUID()   await SUPABASE.from('invoices').insert({     invoice_id: invId,     invoice_number: `QA-G06-${Date.now()}`,     invoice_type: 'FINAL',     order_id: orderId,     customer_id: scenario.customerId,     invoice_date: new Date().toISOString().slice(0, 10),     due_date: new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10),     service_type: 'CLEANING',     service_name: 'AC Cleaning',     base_service_quantity: 1,     base_service_price: 300_000,     base_service_total: 300_000,     addons_subtotal: 0,     subtotal: 300_000,     discount_amount: 0,     discount_percentage: 0,     tax_percentage: 0,     tax_amount: 0,     total_amount: 300_000,     status: 'SENT',     payment_status: 'UNPAID',     paid_amount: 0,   })   // Also update order status to INVOICED if not already   await SUPABASE.from('orders')     .update({ status: 'INVOICED', updated_at: new Date().toISOString() })     .eq('order_id', orderId)   finalInv = { invoiceId: invId, invoiceType: 'FINAL', status: 'SENT', paymentStatus: 'UNPAID', totalAmount: 300_000, paidAmount: 0 } } ``` |

---

### SPEC-004: G05 — Partial-Balance Test `page.goto` Timeout

| Field | Detail |
|-------|--------|
| **Severity** | 🟡 Low |
| **File** | `tests/e2e/qa/G05-payment-modal.spec.ts` — second test (partial then balance) |
| **Description** | The partial-balance test calls `financePage.goto('/dashboard/keuangan/invoices/${partialInvoiceId}')` and times out after 30s. The page never loads. This is the same invoice-not-found symptom as SPEC-002. |
| **Root Cause** | The `partialInvoiceId` is created by `seedOrderDirectly()` + `seedInvoice()`. The seeded invoice might suffer from the same RLS/missing-field issue as the full-payment invoice. |
| **To-Do (Concrete)** | Same as SPEC-002 — debug why seeded invoices aren't visible to the finance user, then apply the fix to all `seedInvoice()` calls in G05. Alternatively, the timeout might be caused by the staging server being slow. Try increasing the goto timeout: `await financePage.goto(url, { waitUntil: 'networkidle', timeout: 60_000 })`. |

---

### SPEC-005: G01, G03, G09, G10, G13 — UI Elements Hidden / Toast Text Mismatch

| Field | Detail |
|-------|--------|
| **Severity** | 🟡 Low–Medium (per spec) |
| **Files** | `G01-order-create-ui.spec.ts`, `G03-master-data-crud.spec.ts`, `G09-service-catalog-crud.spec.ts`, `G10-reminder-rules.spec.ts`, `G13-board-list-views.spec.ts` |
| **Description** | Multiple specs fail because Playwright selectors resolve to **hidden** elements. The dashboard shell uses skeleton loaders, conditional rendering, or tabs that hide content until JS hydrates. Additionally, some toast success messages use different Indonesian text than the specs expect. |
| **Root Cause** | The staging app renders UI in phases: (1) server HTML with loading state, (2) React hydration, (3) data fetch, (4) final render. Playwright's `locator()` finds elements in the initial DOM but they are `visibility: hidden` or `display: none` until step 4. Also, some toasts use abbreviated text on staging vs. what the spec expects. |
| **Impact** | These specs cannot reliably assert UI state on staging. They may pass locally (faster hydration) but fail on staging (slower). |
| **To-Do (Concrete)** | **Generic fix pattern for hidden elements:** Replace `await expect(locator).toBeVisible()` with: ```typescript // Wait for the element to be both in DOM and visible await locator.waitFor({ state: 'visible', timeout: 15_000 }) ``` Or add an explicit wait for a stable marker: ```typescript // Wait for loading to finish await page.waitForSelector('[data-testid="dashboard-loaded"]', { timeout: 15_000 }) ``` **Specific fixes per spec:** - **G01 (line ~90):** Customer search `cmdk-item` not visible. Try `page.getByRole('option', { name: /.../ })` after filling the search input and waiting for the dropdown to open. - **G03 (line ~150):** Toast text "Customer berhasil ditambahkan" not found. Check actual toast text on staging (use browser DevTools or add a screenshot assertion). Likely text is "Data berhasil disimpan" or similar generic message. - **G09 (line ~120):** `text=Service Catalog` resolves to hidden element. The heading might be inside a layout that starts hidden. Use `await page.getByRole('heading', { name: /service catalog/i }).waitFor({ state: 'visible' })`. - **G10 (line ~180):** Strict mode violation on toast — 2 elements match. Add `.first()`. - **G13 (line ~250):** `h3` headings hidden on board view. Use `await page.locator('h3').first().waitFor({ state: 'visible' })` or wait for the board container `data-testid`. |

---

## 4. Fixture / Code Quality Fixes Already Applied

These were discovered and fixed during the QA effort. They are documented here for completeness.

---

### FIX-001: `seedOrderToState` Transition Loop — `'ASSIGNED'` Removed

| Field | Detail |
|-------|--------|
| **File** | `tests/e2e/qa/fixtures/gap-helpers.ts` line 78–83 |
| **Before** | `const transitions = ['ASSIGNED', 'EN_ROUTE', 'IN_PROGRESS', 'COMPLETED']` |
| **After** | `const transitions = ['EN_ROUTE', 'IN_PROGRESS', 'COMPLETED']` |
| **Reason** | `assignLeadTechnician()` already sets `'ASSIGNED'` via admin client. The technician transition endpoint only accepts EN_ROUTE/IN_PROGRESS/COMPLETED. |
| **Commit** | `16d70e2` (Wave 1+2) |

---

### FIX-002: G04 Local Duplicate `'ASSIGNED'` Transition Removed

| Field | Detail |
|-------|--------|
| **File** | `tests/e2e/qa/G04-invoice-from-order.spec.ts` line 118–139 |
| **Before** | `for (const s of ['ASSIGNED', 'EN_ROUTE', 'IN_PROGRESS', 'COMPLETED'])` |
| **After** | `for (const s of ['EN_ROUTE', 'IN_PROGRESS', 'COMPLETED'])` |
| **Reason** | Same as FIX-001 — duplicate of the fixture bug in spec-local code. |
| **Commit** | `16d70e2` (Wave 1+2) |

---

### FIX-003: G04 Strict Mode — `.first()` Added to Order Row Selector

| Field | Detail |
|-------|--------|
| **File** | `tests/e2e/qa/G04-invoice-from-order.spec.ts` line 173 |
| **Before** | `adminPage.locator('tr', { hasText: happyOrderId })` |
| **After** | `adminPage.locator('tr', { hasText: happyOrderId }).first()` |
| **Reason** | Both the "with-report" and "no-report" orders had overlapping ID prefixes, causing 4 row matches. |
| **Commit** | `16d70e2` (Wave 1+2) |

---

### FIX-004: KNOWN-BUG `test.fail()` Semantics Inverted — G05 + G12

| Field | Detail |
|-------|--------|
| **Files** | `tests/e2e/qa/G05-payment-modal.spec.ts` line 462–473, `tests/e2e/qa/G12-invoice-cancel-void.spec.ts` line 366–379 |
| **Before** | Tests asserted **bug behavior** (e.g., `expect(inv?.paymentStatus).toBe('PARTIAL')` when bug allows payment on DRAFT). With `test.fail()`, this caused "Expected to fail, but passed" = **red** in Playwright. |
| **After** | Tests now assert **desired post-fix behavior** (e.g., `expect(inv?.paymentStatus).toBe('UNPAID')`). With bug present, assertion fails → `test.fail()` turns it **green**. When bug is fixed, assertion passes → **red** (signal to remove annotation). |
| **Commit** | `35fc890` (post-Wave fix) |

---

## 5. Staging Environment Issues

These are **environmental / infrastructure** problems not related to code quality or application logic.

---

### ENV-001: Login Page Timeout (>30s)

| Field | Detail |
|-------|--------|
| **Severity** | 🟡 Medium |
| **Affected** | G02-proforma-create.spec.ts, baseline R-01 (intermittent) |
| **Description** | `page.goto('/login')` exceeds the default 30s timeout on staging. The staging server at `v2.nufnh.my.id` (Docker on local machine) is under load or has slow cold-start response. |
| **To-Do (Concrete)** | Either: (a) Increase `page.goto` timeout for login navigation to 60s: `await page.goto('/login', { waitUntil: 'networkidle', timeout: 60_000 })`, or (b) Investigate Docker container resource limits (CPU/memory) on the staging host. |

---

### ENV-002: Model Router Instability (Subagent Execution)

| Field | Detail |
|-------|--------|
| **Severity** | 🟡 Low (development overhead) |
| **Description** | Multiple background subagents failed with "Model not found" (`9router/kr/claude-opus-4.8-thinking`), "Quota exceeded" (`agentrouter/deepseek-v4-pro`), or "Sensitive words detected". All eventually fell back to `opencode-go/deepseek-v4-pro` and completed. |
| **Impact** | Delayed execution by 10–40 minutes per task due to retry cycles. Some tasks (F1–F4) expired before results could be retrieved. |
| **To-Do (Concrete)** | No code fix needed. Recommend using `opencode-go/deepseek-v4-pro` as the primary model for subagents to avoid the retry overhead. |

---

## Quick Reference — Files to Edit per Bug

| Bug ID | File to Edit | Lines | Change |
|--------|-------------|-------|--------|
| BUG-001 | `src/lib/actions/invoices.ts` | ~1398 | Add `if (invoice.status === 'DRAFT') throw` |
| BUG-002 | `src/lib/actions/invoices.ts` | ~1483 | Add state-machine guard in `updateInvoiceStatus()` |
| INFRA-001 | `supabase/migrations/` or SQL | — | Deploy `technician_submit_report_v2` RPC to staging |
| INFRA-002 | `supabase/migrations/` or SQL | — | Deploy `batchgenerateproforma` RPC to staging |
| SPEC-001 | `tests/e2e/qa/G04-invoice-from-order.spec.ts` | ~173 | Add wait for table visibility, use distinct IDs |
| SPEC-002 | `tests/e2e/qa/G05-payment-modal.spec.ts` | ~55 | Pass `location_id` to `seedInvoice()`, debug RLS |
| SPEC-003 | `tests/e2e/qa/G06-pdf-export.spec.ts` | ~66 | Add invoice creation fallback after `seedOrderToState()` |
| SPEC-003 | `tests/e2e/qa/G07-email-send.spec.ts` | ~50 | Same as G06 |
| SPEC-004 | `tests/e2e/qa/G05-payment-modal.spec.ts` | ~329 | Increase `page.goto` timeout or fix RLS |
| SPEC-005 | Multiple G-specs | Various | Add `.waitFor({ state: 'visible' })` before assertions |
| ENV-001 | `tests/e2e/qa/G02-proforma-create.spec.ts` | ~40 | Increase login `goto` timeout to 60s |

---

## Verification Checklist (Post-Fix)

After fixing any of the above, run this command to verify:

```bash
cd /home/ubuntu/projectpenting/webpanel

# 1. Type-check
npm run type-check

# 2. Run the specific spec on staging
PLAYWRIGHT_BASE_URL=https://v2.nufnh.my.id \
  PLAYWRIGHT_SKIP_WEBSERVER=1 \
  npx playwright test --project=qa --workers=1 \
  tests/e2e/qa/G<XX>-<name>.spec.ts

# 3. Cleanup
npm run test:qa:cleanup

# 4. For KNOWN-BUG specs, remove qaTest.fail() only AFTER they turn red
```

---

*Last updated: 2026-05-31*
*Author: atlas (QA E2E Gap-Fill Agent)*
