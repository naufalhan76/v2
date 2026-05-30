# QA E2E Gap Specs — Coverage Map

## Legend
- ✅ Covered by new gap spec
- ⚠️ Partially covered
- 🔗 Linked to existing spec
- 🪲 Known-bug annotation (test.fail)

## Staging Run Status (2026-05-31)

| G-Spec | Tests | Pass | Fail | Skip | Blocker |
|--------|-------|------|------|------|---------|
| G01 | 3 | 0 | 1 | 2 | Selector: accordion sections hidden on staging |
| G02 | 2 | 0 | 1 | 1 | Infra: login page timeout (network) |
| G03 | 4 | 0 | 1 | 3 | Toast text mismatch on staging |
| G04 | 2 | 0 | 1 | 1 | Fixture bug: seedOrderToState ASSIGNED → 400 |
| G05 | 4 | 0 | 2 | 2 | Fixture bug + KNOWN-BUG (test.fail passes) |
| G06 | 2 | 0 | 1 | 1 | Fixture bug: seedOrderToState |
| G07 | 2 | 0 | 1 | 1 | Fixture bug: seedOrderToState |
| G08 | 6 | 5 | 0 | 1 | SUPERADMIN not bootstrapped (expected skip) |
| G09 | 2 | 0 | 1 | 1 | Page content hidden behind dashboard shell |
| G10 | 2 | 0 | 1 | 1 | Dialog not closing; may need CRON_SECRET skip |
| G11 | 2 | 2 | 0 | 0 | None — all pass |
| G12 | 3 | 0 | 1 | 2 | Fixture bug + KNOWN-BUG (test.fail passes) |
| G13 | 4 | 0 | 1 | 3 | Board headings hidden on staging |
| **Total** | **38** | **7** | **12** | **19** | |

**Root cause clusters**:
1. **`seedOrderToState` fixture bug** (gap-helpers.ts:78) — sends ASSIGNED via tech transition; API rejects. Blocks G04/G05/G06/G07/G12 (5 specs). Fix: remove 'ASSIGNED' from transitions array.
2. **Staging UI rendering** — page elements hidden behind skeleton loaders. Affects G01/G09/G13 (3 specs). Fix: adjust selectors to staging layout.
3. **Toast text mismatch** — staging uses different toast wording. Affects G03/G10 (2 specs).
4. **Login timeout** — staging network issue. Affects G02 (1 spec).

## Gap Coverage Table

| G-Spec | Scenario | Gap Closed | Existing Specs (NOT duplicated) | Status |
|--------|----------|------------|-------------------------------|--------|
| G01 | Order create UI — happy path, catalog price autofill, redirect + DB PENDING | UI form-driven order creation (customer→location→AC→service→schedule→submit) | R-01 (API-only PENDING→PAID happy path), Q00 (smoke) | ✅ |
| G01 | No AC selected — toast "Belum ada AC yang dipilih" | Client-side validation: missing AC blocks submit | — | ✅ |
| G01 | No service type — toast "Pilih jenis service untuk semua AC" | Client-side validation: missing service type blocks submit | — | ✅ |
| G02 | Proforma invoice created at order-create time (checkbox checked) | PROFORMA/DRAFT/UNPAID invoice auto-created; order stays PENDING | — | ✅ |
| G02 | Second proforma allowed (KNOW-BUG) | Missing duplicate-proforma guard documented | — | 🪲 |
| G03 | Customer create + edit + soft-delete via UI | Full CRUD UI lifecycle for customer entity | — | ✅ |
| G03 | Location create + edit + delete under customer | Full CRUD UI lifecycle for location entity | — | ✅ |
| G03 | AC unit create + edit + delete under location | Full CRUD UI lifecycle for AC unit entity | — | ✅ |
| G03 | AC-add blocked when customer has zero locations | UI guides user to add location first; button disabled | — | ✅ |
| G04 | Invoice from COMPLETED order WITH report | FINAL/DRAFT invoice created; order→INVOICED; redirect ?prefilled=service-report | R-01 (API-only INVOICED transition) | ✅ |
| G04 | Missing-report fallback — amber card with buttons | Graceful fallback when order has no service report | — | ✅ |
| G05 | Full payment — amount=total → invoice PAID, order PAID, trigger hidden | Payment modal full lifecycle via FINANCE UI | R-08 (API-only partial payment), R-01 (API PAID) | ✅ |
| G05 | Partial then balance — PARTIAL_PAID → PAID | Two-installment payment through UI | R-08 (API-only partial payment) | ✅ |
| G05 | Negative — overpay/zero blocked via Zod | Client-side Zod validation on amount field | — | ✅ |
| G05 | Payment on DRAFT invoice (KNOWN-BUG) | Missing DRAFT guard documented | — | 🪲 |
| G06 | Export FINAL invoice PDF — download fires, correct filename, size > 0 | Browser download verification for FINAL invoices | — | ✅ |
| G06 | Export PROFORMA invoice PDF — download fires, filename correct, size > 0 | Browser download verification for PROFORMA invoices | — | ✅ |
| G07 | Email send fails gracefully when RESEND_API_KEY absent | API 500 + toast "Gagal Kirim Email"; invoice stays DRAFT | — | ✅ |
| G07 | Send button disabled when customer has no email | UI guard: button disabled for customer without email | — | ✅ |
| G08 | TECH → /dashboard/keuangan/invoices redirects to /technician | Middleware enforces technician-to-dashboard redirect | — | ✅ |
| G08 | FINANCE PATCH /api/orders/{id} assign → 403 | API-level role enforcement for order transitions | api-orders-patch.spec.ts (TECH/ADMIN cases) | ✅ |
| G08 | ADMIN → /dashboard/manajemen/user redirects to /dashboard | SUPERADMIN-only route guard | — | ✅ |
| G08 | SUPERADMIN → /dashboard/manajemen/user renders | SUPERADMIN positive path for user management | — | ✅ |
| G08 | Unauthenticated → /login?redirectTo=<path> | Auth middleware redirect with original path preserved | — | ✅ |
| G08 | Non-TECH → /technician redirects to /dashboard | Technician-only namespace enforcement | — | ✅ |
| G09 | Create catalog entry + verify DB + price feed to order form | 4-dimensional catalog entry creation; autofill link to order form | — | ✅ |
| G09 | Toggle active + edit base_price | Catalog entry state management via UI | — | ✅ |
| G10 | Rule CRUD via settings UI (create+edit+soft-delete) | Reminder rule lifecycle; DB verified at each step | R-14 (API-only reminder generation) | ✅ |
| G10 | Generate reminders via cron + mark-as-sent status flip | Cron trigger → PENDING rows → UI "Kirim" button → SENT | R-14 (API-only cron trigger) | ✅ |
| G11 | Push subscribe lifecycle — POST subscribe → 201 → DB row → DELETE unsubscribe → 200 | Full push subscription API contract (subscribe + unsubscribe) | — | ✅ |
| G11 | Malformed subscribe body → 400 | Zod validation on subscribe endpoint | — | ✅ |
| G12 | Void-revert — cancel FINAL SENT invoice → CANCELLED, order→COMPLETED | Invoice cancellation flow with order status revert | — | ✅ |
| G12 | Delete-guard — SENT invoice delete blocked | Status guard: non-DRAFT invoices cannot be deleted | — | ✅ |
| G12 | PAID→CANCELLED allowed without guard (KNOWN-BUG) | Missing state-machine guard documented | — | 🪲 |
| G13 | Drag PENDING→ASSIGNED opens Assign modal; completing sets ASSIGNED | Kanban dnd-kit drag opens Assign modal (not silent transition) | R-01 (API-only ASSIGNED transition) | ✅ |
| G13 | Drag ASSIGNED→PENDING opens Reschedule modal | Kanban drag opens Reschedule modal | R-03 (API-only reschedule) | ✅ |
| G13 | Illegal drag PENDING→PAID shows toast "Transisi tidak diizinkan" | Invalid drag blocked with toast; no DB change | — | ✅ |
| G13 | List view toggle, row click opens detail panel, cancel-from-list sets CANCELLED | List view rendering + inline cancel via dropdown | R-02 (API-only cancel) | ✅ |

## Existing Spec Coverage (NOT duplicated)

| ID | Title | Covers |
|----|-------|--------|
| Q00 | Smoke — fixtures + login | infrastructure sanity |
| R-01 | Happy path | full lifecycle PENDING → PAID + realtime + cron |
| R-02 | Cancel at PENDING | proforma cascade behaviour documented |
| R-03 | Reschedule from EN_ROUTE | reset to PENDING, clear assignment |
| R-04 | Reassign lead technician | swap lead, helper visibility |
| R-05 | Add helper technician | helper sees order, only lead transitions |
| R-06 | Cancel during work | offline conflict surfaces on reconnect |
| R-07 | Idempotent retry | report POST 3× → single DB row |
| R-08 | Partial payment | DP 50% then balance, status transitions |
| R-09 | Skip AC unit | per-AC skipped + reason propagation |
| R-10 | New AC discovered on-site | non-auto-create path documented |
| R-11 | GPS denied / timeout | transition not blocked, gps_error recorded |
| R-12 | Token expiry mid-offline | refresh runs before sync |
| R-13 | API idempotency | server-side unique constraint dedupe |
| R-14 | Reminder generation | cron creates customer_reminders rows |
| R-15 | Concurrent admin race | TOCTOU optimistic-lock 409 |
| R-16 | 5-AC load | submit time < 5s, all ac_units stored |
| R-17 | Storage quota guard | enqueuePhoto throws on near-full IDB |
| R-18 | iOS Safari path | online-event drain without Background Sync |
| R-cross | Invariants audit | global DB integrity across all QA-E2E-* orders |
| api-orders-patch | API orders patch | TECH/ADMIN order transition via PATCH |

## Evidence Map

| G-Spec | Evidence Dir | Screenshots | JSON Snapshots |
|--------|-------------|-------------|----------------|
| G01 | .omo/evidence/qa/G01/ | happy.png, negative-no-ac.png, negative-no-service-type.png | happy.json, negative-no-ac.json, negative-no-service-type.json |
| G02 | .omo/evidence/qa/g02/ | happy-pre-submit.png, happy-post-redirect.png | happy.json, duplicate-proforma.json |
| G03 | .omo/evidence/qa/G03/ | customer-create.png, customer-edit.png, customer-delete.png, location-*.png, ac-*.png, ac-needs-location.png | customer-crud.json, location-crud.json, ac-crud.json, ac-needs-location.json |
| G04 | .omo/evidence/qa/G04/ | happy.png, missing-report.png | happy.json, missing-report.json |
| G05 | .omo/evidence/qa/G05/ | full-payment.png, partial-balance.png, overpay-zero.png, payment-on-draft.png | full-payment.json, partial-balance.json, overpay-zero.json, payment-on-draft.json |
| G06 | .omo/evidence/qa/G06/ | — | final-pdf.json, proforma-pdf.json |
| G07 | .omo/evidence/qa/G07/ | send-fail.png, no-email-disabled.png | send-fail.json, no-email-disabled.json |
| G08 | .omo/evidence/qa/G08/ | tech-blocked.png, admin-user-mgmt-blocked.png, superadmin-user-mgmt.png | summary.json, tech-blocked.json, finance-403.json, user-mgmt-guard.json |
| G09 | .omo/evidence/qa/G09/ | catalog-create-feed.png, catalog-toggle-edit.png | catalog-create-feed.json, catalog-toggle-edit.json |
| G10 | .omo/evidence/qa/G10/ | rule-crud.png, generate-marksent.png | rule-crud.json, generate-marksent.json |
| G11 | .omo/evidence/qa/G11/ | — | subscribe-lifecycle.json, malformed-400.json |
| G12 | .omo/evidence/qa/G12/ | void-revert.png, delete-guard.png | void-revert.json, delete-guard.json, paid-to-cancelled.json |
| G13 | .omo/evidence/qa/G13/ | drag-assign-modal.png, drag-reschedule-modal.png, illegal-drag.png, list-cancel.png | drag-assign-modal.json, drag-reschedule-modal.json, illegal-drag.json, list-cancel.json |
