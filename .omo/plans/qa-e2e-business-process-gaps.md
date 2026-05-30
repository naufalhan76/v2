# QA E2E Business-Process Gap-Fill Plan — MSN ERP V2

## TL;DR

> **Quick Summary**: Extend the existing 34-spec Playwright suite with new `tests/e2e/qa/` specs that cover the untested business-process gaps (order-create UI, proforma, master-data CRUD, invoice-from-order, payment modal, PDF, email, RBAC, catalog/reminder CRUD, board/list views), reusing existing fixtures and running against staging.
>
> **Deliverables**:
> - Pre-flight validation + staging baseline (config, accounts, env guards)
> - New gap specs G1–G13 in `tests/e2e/qa/` (one concern per file)
> - Reused fixtures only; existing specs untouched
> - Evidence under `.omo/evidence/qa/{scenarioId}/`
>
> **Estimated Effort**: Large
> **Parallel Execution**: YES — 4 waves
> **Critical Path**: Wave0 pre-flight → fixture extension → gap specs → final review

---

## Context

### Original Request
"Learn this codebase, read V2_CODEBASE.md as supplementary info, then plan QA tests for the end-to-end business process with various scenarios."

### Interview Summary
**Key Decisions**:
- Tool: **Playwright browser E2E** (already installed `@playwright/test ^1.60.0`)
- Target env: **staging `https://v2.nufnh.my.id`** — free to seed/cleanup (all dummy data)
- Test data: existing **seed + cleanup** scripts, `QA-E2E-{scenarioId}-{ts}-{rand}` prefix
- Known-bug handling: **assert CURRENT behavior via `test.fail()` + `// KNOWN-BUG:` comment** (suite stays green; flips to pass when bug fixed)
- UI-vs-API depth: **setup-vs-SUT rule** — seed preconditions via admin client, drive the thing-under-test through real UI where the gap is a UI surface, real API where the gap is API/contract

**Critical Discovery**: A **mature Playwright suite already exists** — 34 specs (12 in `tests/e2e/`, 22 in `tests/e2e/qa/`: Q00 smoke, R-01 happy path PENDING→PAID, R-02..R-18 field/edge, R-19 state-machine negatives, R-cross invariants, api-orders-patch). Rich fixtures exist. **Scope therefore = FILL GAPS, reuse fixtures, do NOT duplicate or modify existing specs.**

**Research Findings (validated, file:line)**:
- `playwright.config.ts`: `baseURL = PLAYWRIGHT_BASE_URL ?? http://localhost:3000` (defaults LOCAL). `webServer` runs `npm run dev`. `qa` project = chromium 1280×800, `testDir ./tests/e2e/qa`. `fullyParallel:true`, `workers: CI?1:10`. → Staging runs MUST set `PLAYWRIGHT_BASE_URL=https://v2.nufnh.my.id` and `PLAYWRIGHT_SKIP_WEBSERVER=1`.
- QA accounts via `npm run qa:seed`: `qa-admin@msn-erp.local/QaAdmin!2026`, `qa-finance@msn-erp.local/QaFinance!2026`, `qa-tech1@msn-erp.local/QaTech1!2026`, `qa-tech2@msn-erp.local/QaTech2!2026`. **SUPERADMIN NOT seeded by qa:seed** — only via `bootstrap-staging.mjs` (`superadmin@test.com/Test1234!`).
- **Kanban drag does NOT transition status** (`kanban-board.tsx` handleDragEnd:93) — opens Assign/Reschedule modals or fires create-invoice/record-payment callbacks; else toast "Transisi tidak diizinkan".
- **Reminder SEND is a stub** (`reminders.ts` markReminderSent:309) — only flips DB status PENDING→SENT; toast admits delivery "ditambahkan kemudian". No Resend/WhatsApp for reminders.
- Payment modal Zod (`record-payment-modal.tsx`:66-80): amount `.positive().max(remaining)` → overpay/zero/negative blocked client-side. Methods: CASH, TRANSFER, CHECK, CREDIT_CARD, DEBIT_CARD, QRIS, OTHER.
- Email send: empty `RESEND_API_KEY` → API 500 `{error:"Email service is not configured"}`; button enabled-and-fails (not hidden); toast "Gagal Kirim Email".

### Metis Review (gaps addressed in this plan)
- Staging-only safety guard + no-prod assertion → Wave 0 + guardrails.
- Baseline run of existing 22 specs before writing new ones → Task 1.
- SUPERADMIN existence + RESEND-key + cron-active runtime guards → Task 2, baked into specs via `test.skip`.
- Shared-staging race / auth-rate-limit → `PLAYWRIGHT_WORKERS=1` for mutating specs + per-role `storageState` reuse.
- Per-gap scope-creep locks (G3/G4/G5/G6/G8/G11) → encoded in each task's "Must NOT do".
- Validated risky assumptions (kanban, reminder-send, invoice-from-order surface) before committing assertions → done; G13 reframed (modal/list, not drag-transition) and reminder real-delivery dropped (mark-as-sent only).

---

## Work Objectives

### Core Objective
Add new Playwright E2E specs under `tests/e2e/qa/` that cover the business-process areas the existing 34-spec suite leaves untested, reusing the existing fixture stack and running green against staging.

### Concrete Deliverables
- `tests/e2e/qa/G01-order-create-ui.spec.ts` … `G13-board-list-views.spec.ts` (new gap specs, one concern each)
- Optional fixture extension in `tests/e2e/qa/fixtures/` (helpers to seed orders to terminal states + admin/finance UI helpers) — additive only
- A short `tests/e2e/qa/GAPS.md` mapping each new spec to the gap it closes (markdown doc; allowed)
- Evidence per spec under `.omo/evidence/qa/{scenarioId}/`

### Definition of Done
- [ ] `PLAYWRIGHT_BASE_URL=https://v2.nufnh.my.id PLAYWRIGHT_SKIP_WEBSERVER=1 PLAYWRIGHT_WORKERS=1 npx playwright test --project=qa tests/e2e/qa/G*.spec.ts` → all PASS or cleanly SKIP (never hard-fail), with known-bug specs marked `test.fail()`
- [ ] Existing 22 QA specs + 12 general specs unchanged and still green (baseline preserved)
- [ ] Each new spec seeds with full scenario prefix and purges in `afterAll`

### Must Have
- New specs ONLY in `tests/e2e/qa/`; reuse `roles.ts`/`seeders.ts`/`cleanup.ts`/`db-asserts.ts`/`api-helpers.ts`/`synth.ts`/`env.ts`
- Each gap spec: ≥1 happy + ≥1 negative/edge scenario
- Setup via admin client; thing-under-test via real UI (UI-surface gaps) or real API (contract gaps)
- Staging-safety: assert target host is staging before any seed/cleanup
- Known-bug areas use `test.fail()` + `// KNOWN-BUG:` annotation

### Must NOT Have (Guardrails)
- Do NOT modify or delete any existing spec (12 general + 22 QA) or any fixture's existing exports (extend only, additively)
- Do NOT write any non-test source code or "fix" the flagged bugs (this is a TEST plan)
- Do NOT run seed/cleanup against production; never call `purgeByPrefix('QA-E2E-')` with the bare root prefix
- Do NOT commit `.env.test.local` or hardcode credentials in specs
- Do NOT test Kanban drag-as-status-transition (it doesn't transition) — test the modal/callback flows instead
- Do NOT test real reminder delivery (unimplemented) — test mark-as-sent status flip only
- Do NOT assert PDF text/layout — content-type + non-zero bytes + filename only
- Do NOT build a full role×route matrix for RBAC — one negative per role for the most sensitive boundary + one SUPERADMIN positive
- Do NOT attempt real web-push delivery — subscribe endpoint 200 + `push_subscriptions` row only

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — all verification is agent-executed (Playwright + DB asserts). No "user manually confirms" criteria.

### Test Decision
- **Infrastructure exists**: YES — Playwright `@playwright/test ^1.60.0`, `tsx`, full QA fixture stack
- **Automated tests**: YES — these ARE the tests being authored. Each is an E2E spec.
- **Framework**: Playwright (`--project=qa`, chromium desktop 1280×800)
- **Pattern per spec**: seed precondition (admin client) → drive SUT (real UI/API) → assert via `getFullOrderSnapshot`/DB + UI state → write evidence → `afterAll` purge

### Run Command (staging)
```bash
PLAYWRIGHT_BASE_URL=https://v2.nufnh.my.id \
PLAYWRIGHT_SKIP_WEBSERVER=1 \
PLAYWRIGHT_WORKERS=1 \
npx playwright test --project=qa tests/e2e/qa/G*.spec.ts --reporter=list
```

### QA Policy (how each NEW spec self-verifies — the spec IS the QA)
Every gap spec must, when executed by the implementing agent against staging:
1. SKIP cleanly (not fail) if its preconditions are absent (missing account, missing RESEND state mismatch, cron-active).
2. Produce evidence in `.omo/evidence/qa/{scenarioId}/` (JSON snapshot + screenshot at the asserted UI state).
3. Pass on happy path, pass on negative path, and (for bug areas) be marked `test.fail()` so a future fix surfaces loudly.

- **Order/Invoice/Master-data UI gaps**: Playwright drives the real browser (forms, modals, buttons), asserts DOM text + DB snapshot.
- **RBAC/redirect/contract gaps**: Playwright `request` / navigation asserts exact status codes + redirect URLs.
- **PDF**: assert download event fires, `suggestedFilename()` matches `Invoice_<number>.pdf`, saved file size > 0 bytes. No content parsing.
- **Email**: assert API 500 + toast text when key absent; `test.skip` if `RESEND_API_KEY` present at runtime.

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 0 (Pre-flight — MUST complete first, sequential-ish foundation):
├── Task 1: Staging baseline + config harness (run existing 22 QA specs green)  [deep]
└── Task 2: Test-env guards + fixture extension (terminal-state seeding, staging-safety, skip-guards)  [deep]

Wave 1 (HIGH-priority gap specs — MAX PARALLEL after Wave 0):
├── Task 3: G1 Order-create UI spec               [visual-engineering]
├── Task 4: G2 Proforma-at-create spec            [unspecified-high]
├── Task 5: G3 Master-data CRUD UI spec           [visual-engineering]
├── Task 6: G4 Invoice-from-order spec            [unspecified-high]
├── Task 7: G5 Payment-modal spec                 [unspecified-high]
├── Task 8: G6 PDF-export spec                    [unspecified-high]
├── Task 9: G7 Email-send graceful-fail spec      [unspecified-high]
└── Task 10: G8 RBAC negatives + redirects spec   [deep]

Wave 2 (MEDIUM-priority gap specs — parallel after Wave 0; independent of Wave 1):
├── Task 11: G9 Service-catalog CRUD UI spec      [visual-engineering]
├── Task 12: G10 Reminder-rules CRUD UI spec      [visual-engineering]
├── Task 13: G11 Push-subscribe endpoint spec     [unspecified-high]
├── Task 14: G12 Invoice cancel/void UI spec      [unspecified-high]
└── Task 15: G13 Board-modal + list-view spec     [visual-engineering]

Wave 3 (Consolidation):
└── Task 16: GAPS.md coverage map + full staging run + flake triage  [deep]

Wave FINAL (after ALL — 4 parallel reviews, then user okay):
├── F1: Plan compliance audit (oracle)
├── F2: Spec quality review (unspecified-high)
├── F3: Real staging execution QA (unspecified-high)
└── F4: Scope fidelity check (deep)
→ Present results → explicit user okay

Critical Path: Task 1 → Task 2 → (Wave 1 ∥ Wave 2) → Task 16 → F1–F4 → user okay
Max Concurrent: 8 (Wave 1)
```

### Dependency Matrix
- **Task 1**: blockedBy none → blocks 2
- **Task 2**: blockedBy 1 → blocks 3–15
- **Tasks 3–10 (Wave 1)**: blockedBy 2 → block 16
- **Tasks 11–15 (Wave 2)**: blockedBy 2 → block 16
- **Task 16**: blockedBy 3–15 → blocks F1–F4
- **F1–F4**: blockedBy 16 → block user-okay

### Agent Dispatch Summary
- **Wave 0**: Task 1 `deep`, Task 2 `deep`
- **Wave 1**: T3 `visual-engineering`, T4 `unspecified-high`, T5 `visual-engineering`, T6 `unspecified-high`, T7 `unspecified-high`, T8 `unspecified-high`, T9 `unspecified-high`, T10 `deep`
- **Wave 2**: T11 `visual-engineering`, T12 `visual-engineering`, T13 `unspecified-high`, T14 `unspecified-high`, T15 `visual-engineering`
- **Wave 3**: T16 `deep`
- **FINAL**: F1 `oracle`, F2 `unspecified-high`, F3 `unspecified-high`, F4 `deep`

All implementing agents load `load_skills=["playwright"]` where they drive the browser (T3–T15), since QA scenarios use the playwright skill for browser automation.

---

## TODOs

- [x] 1. Staging baseline + config harness

  **What to do**:
  - Confirm `playwright.config.ts` staging override: document that staging runs require `PLAYWRIGHT_BASE_URL=https://v2.nufnh.my.id` + `PLAYWRIGHT_SKIP_WEBSERVER=1`.
  - Run the EXISTING 22 QA specs against staging to establish a green baseline: `PLAYWRIGHT_BASE_URL=https://v2.nufnh.my.id PLAYWRIGHT_SKIP_WEBSERVER=1 npm run test:qa`. Record pass/skip/fail per spec.
  - If any existing spec is RED on staging, triage and document in `.omo/evidence/qa/baseline/baseline-report.md` (do NOT fix app code — just record, so "don't break the suite" has a real baseline).
  - Confirm QA accounts exist on staging (`npm run qa:seed` already run; `grep ^QA_ .env.test.local`). Confirm whether SUPERADMIN (`superadmin@test.com`) exists; if not, document the `node scripts/bootstrap-staging.mjs` step.
  - Verify `.gitignore` contains `.env.test.local`.

  **Must NOT do**: Modify any existing spec or app source. Do not point seed/cleanup at production.

  **Recommended Agent Profile**:
  - **Category**: `deep` — autonomous environment setup + triage reasoning.
  - **Skills**: [`playwright`] — needs to run/interpret Playwright runs.

  **Parallelization**: Can Run In Parallel: NO | Wave 0 | Blocks: 2 | Blocked By: None

  **References**:
  - `playwright.config.ts:3-4,73-82` — baseURL + webServer logic (staging override).
  - `tests/e2e/qa/README.md:18-58` — prerequisites + run commands.
  - `scripts/seed-qa-accounts.ts` — account creation; `scripts/bootstrap-staging.mjs` — SUPERADMIN.
  - `.env.staging` / `.env.test.local` — env var sources.

  **Acceptance Criteria**:
  - [ ] `.omo/evidence/qa/baseline/baseline-report.md` lists every existing QA spec with pass/skip/fail status from a real staging run.
  - [ ] Documented confirmation: QA_* creds present; SUPERADMIN existence YES/NO + remediation command.
  - [ ] `.gitignore` confirmed to contain `.env.test.local`.

  **QA Scenarios**:
  ```
  Scenario: Existing suite runs green against staging
    Tool: Bash (npx playwright)
    Preconditions: .env.test.local has QA_* creds; staging reachable
    Steps:
      1. Run: PLAYWRIGHT_BASE_URL=https://v2.nufnh.my.id PLAYWRIGHT_SKIP_WEBSERVER=1 npm run test:qa
      2. Capture reporter output to .omo/evidence/qa/baseline/run.log
      3. Assert: exit code 0 (or only expected skips), zero unexpected failures
    Expected Result: All existing specs pass or cleanly skip; report written
    Failure Indicators: Any unexpected spec failure not attributable to a pre-existing documented issue
    Evidence: .omo/evidence/qa/baseline/run.log + baseline-report.md

  Scenario: Production-target guard works
    Tool: Bash
    Preconditions: none
    Steps:
      1. Inspect that run command requires explicit staging host env var
      2. Confirm no script auto-targets a prod URL
    Expected Result: Staging host is explicit; no prod default
    Evidence: .omo/evidence/qa/baseline/safety-note.md
  ```

  **Commit**: YES (groups with Wave 0) — `test(qa): add staging baseline harness + fixture extensions for gap specs` — Pre-commit: `npm run type-check`

---

- [x] 2. Test-env guards + fixture extension

  **What to do**:
  - Add additive helpers to `tests/e2e/qa/fixtures/` (new file `gap-helpers.ts`, re-exported via `index.ts` — do NOT alter existing exports):
    - `seedOrderToState(scenario, state)`: seed an order then drive it (via existing `api-helpers` `technicianTransition` + `technicianSubmitReport`, or admin client) to a target canonical state (COMPLETED, INVOICED) — needed by G4/G5/G12.
    - `assertStagingHost(baseURL)`: throw if host is not `v2.nufnh.my.id` (and not localhost) — staging-safety guard reusable in specs' `beforeAll`.
    - `superAdminAccountOrSkip()`: attempt SUPERADMIN login; return creds or signal `test.skip` — needed by G8.
    - `resendKeyAbsentOrSkip()`: read runtime env / probe send-email behavior; signal skip if key present — needed by G7.
    - `scenarioPrefix(id)`: thin wrapper over existing `makePrefix` enforcing ≥8-hex-char random suffix.
  - Confirm storage buckets (`service-photos`, `signatures`) exist on staging (probe via admin client); document.

  **Must NOT do**: Change signatures/behavior of existing fixture exports. Do not weaken existing cleanup. Do not introduce a bare-root purge.

  **Recommended Agent Profile**:
  - **Category**: `deep` — fixture design touching seeding/auth/state machine.
  - **Skills**: [`playwright`] — fixtures run in Playwright context.

  **Parallelization**: Can Run In Parallel: NO | Wave 0 | Blocks: 3–15 | Blocked By: 1

  **References**:
  - `tests/e2e/qa/fixtures/seeders.ts` — `seedFullScenario`, `seedOrder`, `assignLeadTechnician`.
  - `tests/e2e/qa/fixtures/api-helpers.ts` — `technicianTransition`, `technicianSubmitReport`, `adminAssignOrder`, `adminCancelOrder`.
  - `tests/e2e/qa/fixtures/env.ts` — `getSupabaseAdmin`, `loadQaAccounts`, `makePrefix`, `evidenceDir`.
  - `tests/e2e/qa/fixtures/roles.ts` — `qaTest`, `loginAs`.
  - `tests/e2e/qa/fixtures/db-asserts.ts` — `getFullOrderSnapshot`, `getOrderStatus`.

  **Acceptance Criteria**:
  - [ ] `tests/e2e/qa/fixtures/gap-helpers.ts` created; exported via `index.ts` barrel additively.
  - [ ] `npm run type-check` passes with new helpers.
  - [ ] `seedOrderToState` can produce a COMPLETED order with a service report (verified by `getFullOrderSnapshot`).
  - [ ] `assertStagingHost` throws on a non-staging/non-localhost URL (unit-style assertion in a tiny spec or inline).

  **QA Scenarios**:
  ```
  Scenario: seedOrderToState reaches COMPLETED with report
    Tool: Bash (npx playwright, single throwaway spec or node tsx)
    Preconditions: staging reachable, QA creds present
    Steps:
      1. Call seedOrderToState(scenario, 'COMPLETED')
      2. getFullOrderSnapshot(orderId)
      3. Assert snapshot.order.status === 'COMPLETED' AND a service_report row exists
    Expected Result: Order at COMPLETED with report; cleanup purges by scenario prefix
    Failure Indicators: status not COMPLETED, or no report row, or leftover rows after purge
    Evidence: .omo/evidence/qa/fixtures/seed-to-state.json

  Scenario: Staging-safety guard rejects prod host
    Tool: Bash
    Preconditions: none
    Steps:
      1. Call assertStagingHost('https://prod.example.com')
      2. Assert it throws
      3. Call assertStagingHost('https://v2.nufnh.my.id') → no throw
    Expected Result: Guard throws on non-staging, passes on staging
    Evidence: .omo/evidence/qa/fixtures/safety-guard.json
  ```

  **Commit**: YES (Wave 0) — same commit as Task 1 — Pre-commit: `npm run type-check`

---

- [ ] 3. G1 — Order-create UI spec (`tests/e2e/qa/G01-order-create-ui.spec.ts`)

  **What to do**:
  - Drive the real Create Order form at `/dashboard/orders/new` as ADMIN: search/select an existing seeded customer, expand sections, select location + AC unit(s), pick a service type (assert catalog price autofill), set schedule, submit WITHOUT proforma.
  - Assert success redirect to `/dashboard/orders` and the order row exists in DB at PENDING (via `getOrderStatus`).
  - Negative: attempt submit with no AC selected → assert toast "Belum ada AC yang dipilih"; and with AC but no service_type → assert toast "Pilih jenis service untuk semua AC" and submit blocked.
  - Setup (customer/location/AC) via admin client `seedFullScenario`; the order creation itself is the SUT via UI.

  **Must NOT do**: Do not seed the order itself (UI creates it). Do not assert proforma here (that's G2). Keep to one happy + the two validation negatives.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering` — real browser form interaction across a 5-section accordion.
  - **Skills**: [`playwright`].

  **Parallelization**: Can Run In Parallel: YES | Wave 1 | Blocks: 16 | Blocked By: 2

  **References**:
  - `src/app/dashboard/orders/new/page.tsx:1218` (submit text), `:632` (redirect), `:558/:563` (validation toasts), `:490-533` (catalog price autofill), `:545` (isServicesFilled).
  - `tests/e2e/qa/fixtures/seeders.ts` `seedFullScenario`; `roles.ts` `loginAs(context,'admin')`; `db-asserts.ts` `getOrderStatus`.

  **Acceptance Criteria**:
  - [ ] Happy: order created via UI → redirect `/dashboard/orders` → DB order status PENDING.
  - [ ] Catalog price autofills the estimated-price field for a catalog-matched (unit_type+capacity+service_type) line.
  - [ ] Negative (no AC) → toast "Belum ada AC yang dipilih", no order created.
  - [ ] Negative (no service_type) → toast "Pilih jenis service untuk semua AC", submit blocked.
  - [ ] `afterAll` purges by scenario prefix; zero residual rows.

  **QA Scenarios**:
  ```
  Scenario: Create order via UI happy path
    Tool: Playwright
    Preconditions: loginAs admin; seedFullScenario(prefix) with 1 location + 1 AC + a service_catalog entry matching that unit
    Steps:
      1. goto /dashboard/orders/new
      2. Search customer by seeded name, select it
      3. Expand Locations&AC, toggle the seeded AC unit
      4. In Service Items, select service type; assert estimasi-harga input value === catalog base_price
      5. Pick scheduled date (today+1), leave assignment skipped
      6. Click button text "Buat Order"
      7. await URL == **/dashboard/orders
      8. DB: getOrderStatus(newOrderId) === 'PENDING'
    Expected Result: Redirect to /dashboard/orders; one PENDING order in DB with the seeded customer
    Failure Indicators: stays on /new, price not autofilled, no DB row
    Evidence: .omo/evidence/qa/G01/happy.json + screenshot.png

  Scenario: Submit blocked without service type
    Tool: Playwright
    Preconditions: same; AC selected but no service type chosen
    Steps:
      1. Reach Service Items with AC selected, do NOT pick service type
      2. Attempt submit
      3. Assert toast text "Pilih jenis service untuk semua AC"
      4. DB: no new order for this scenario prefix
    Expected Result: Graceful client-side block + toast; no DB write
    Evidence: .omo/evidence/qa/G01/negative-no-service-type.json + screenshot.png
  ```

  **Commit**: YES (Wave 1) — `test(qa): cover high-priority business-process gaps (order/proforma/master-data/invoice/payment/pdf/email/rbac)` — Pre-commit: `npm run type-check`

---

- [ ] 4. G2 — Proforma-at-create spec (`tests/e2e/qa/G02-proforma-create.spec.ts`)

  **What to do**:
  - As ADMIN, create an order via UI with the "Buat Proforma Invoice otomatis" checkbox CHECKED. Assert submit button reads "Buat Order + Proforma", success toast "Order dan Proforma berhasil dibuat", and redirect to `/dashboard/keuangan/invoices/{id}?proforma=true`.
  - DB assert: a `invoices` row with `invoice_type='PROFORMA'`, `status='DRAFT'`, `payment_status='UNPAID'`, `paid_amount=0`, plus `invoice_items` derived from the order's estimated prices; order itself stays `PENDING`.
  - Negative/edge (`test.fail` candidate): create a SECOND proforma for the same order (no duplicate guard exists) — assert current behavior allows it, mark `test.fail()` with `// KNOWN-BUG: no duplicate-invoice guard`.

  **Must NOT do**: Do not re-test plain order creation (G1). Do not assert tax-on-discount correctness (separate known bug — out of this spec's scope). Keep to proforma create + duplicate edge.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high` — UI action + DB-shape assertions + known-bug annotation.
  - **Skills**: [`playwright`].

  **Parallelization**: Can Run In Parallel: YES | Wave 1 | Blocks: 16 | Blocked By: 2

  **References**:
  - `src/app/dashboard/orders/new/page.tsx:1186-1201` (checkbox), `:1218` (button text), `:611-618` (createProformaInvoice + redirect), `:613-616` (success toast).
  - `src/lib/actions/invoices.ts:1594-1776` (createProformaInvoice: type/status/items).
  - `tests/e2e/qa/fixtures` `seedFullScenario`, `getFullOrderSnapshot`, `loginAs`.

  **Acceptance Criteria**:
  - [ ] Happy: checkbox checked → button "Buat Order + Proforma" → toast + redirect with `?proforma=true`.
  - [ ] DB: PROFORMA/DRAFT/UNPAID invoice with items from estimated prices; order remains PENDING.
  - [ ] Duplicate-proforma edge marked `test.fail()` + `// KNOWN-BUG:` annotation.
  - [ ] `afterAll` purge; zero residual rows.

  **QA Scenarios**:
  ```
  Scenario: Order + proforma created from UI
    Tool: Playwright
    Preconditions: loginAs admin; seedFullScenario with priced catalog
    Steps:
      1. Create order via UI (as in G1) but check "Buat Proforma Invoice otomatis"
      2. Assert submit button text === "Buat Order + Proforma"
      3. Submit; assert toast "Order dan Proforma berhasil dibuat"
      4. await URL matches /dashboard/keuangan/invoices/*?proforma=true
      5. DB via getFullOrderSnapshot: invoice invoice_type=PROFORMA status=DRAFT, order status PENDING
    Expected Result: Proforma DRAFT invoice exists; order still PENDING
    Failure Indicators: no invoice row, wrong type/status, order status changed
    Evidence: .omo/evidence/qa/G02/happy.json + screenshot.png

  Scenario: Second proforma allowed (KNOWN-BUG)
    Tool: Playwright (test.fail)
    Preconditions: an order that already has a PROFORMA
    Steps:
      1. Trigger proforma creation again for same order (via create flow / action)
      2. Assert a second PROFORMA row is created (current buggy behavior)
    Expected Result: test.fail — documents missing duplicate guard; flips to pass when fixed
    Evidence: .omo/evidence/qa/G02/duplicate-proforma.json
  ```

  **Commit**: YES (Wave 1)

---

- [ ] 5. G3 — Master-data CRUD UI spec (`tests/e2e/qa/G03-master-data-crud.spec.ts`)

  **What to do**:
  - As ADMIN, exercise the dashboard CRUD UI for the three master-data entities, one happy create+edit+soft-delete per entity (scope lock — NOT exhaustive field validation):
    - Customer: create via `/dashboard/manajemen/customer` sheet → edit name → soft-delete.
    - Location: on customer detail "Lokasi" tab → add location → (edit if UI allows).
    - AC unit: on "AC Units" tab → add AC unit (requires existing location) → verify it appears.
  - Assert DB rows created/updated and that soft-delete sets the soft-delete flag (record not hard-deleted).
  - Negative/edge: attempt to add an AC unit when the customer has NO location → assert the UI blocks/guides (button disabled or prompt to add location first, per `[id]/page.tsx:1116`).

  **Must NOT do**: No exhaustive field-level validation matrix. Do not test duplicate-phone or orphan-location edge unless trivially surfaced. One create+edit+soft-delete per entity only.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering` — multiple form/sheet/tab interactions.
  - **Skills**: [`playwright`].

  **Parallelization**: Can Run In Parallel: YES | Wave 1 | Blocks: 16 | Blocked By: 2

  **References**:
  - `src/app/dashboard/manajemen/customer/page.tsx:128-178` (create customer + POST /api/customers).
  - `src/app/dashboard/manajemen/customer/[id]/page.tsx:823-852` (add location), `:1116` (AC needs location), `:1242-1393` (AC unit form fields).
  - `src/lib/actions/customers.ts:131` (createCustomer), `src/lib/actions/ac-units.ts:186` (createAcUnit), `:8` (WRITE_ROLES SUPERADMIN/ADMIN).
  - `tests/e2e/qa/fixtures` `loginAs('admin')`, `getSupabaseAdmin` for DB asserts, `scenarioPrefix`.

  **Acceptance Criteria**:
  - [ ] Customer create → DB row; edit → name updated; soft-delete → soft-delete flag set, row still present.
  - [ ] Location added under customer → DB row linked to customer.
  - [ ] AC unit added under a location → DB row; appears in AC Units tab.
  - [ ] Negative: AC-add blocked when no location exists.
  - [ ] `afterAll` purge by scenario prefix; zero residual rows.

  **QA Scenarios**:
  ```
  Scenario: Customer create + edit + soft-delete via UI
    Tool: Playwright
    Preconditions: loginAs admin
    Steps:
      1. goto /dashboard/manajemen/customer; open "Tambah Customer" sheet
      2. Fill required fields with QA-E2E-prefixed name; save
      3. DB: customer row exists with that name
      4. Edit customer → change name → save → DB reflects new name
      5. Soft-delete customer → DB: soft-delete flag set, row NOT hard-deleted
    Expected Result: Full CRUD lifecycle reflected in DB; soft-delete preserves row
    Failure Indicators: hard delete, missing row, edit not persisted
    Evidence: .omo/evidence/qa/G03/customer-crud.json + screenshots

  Scenario: AC-add blocked without location
    Tool: Playwright
    Preconditions: a freshly created customer with zero locations
    Steps:
      1. Open customer detail → AC Units tab → "Tambah AC"
      2. Assert the location Select is empty/disabled OR a prompt instructs to add a location first
    Expected Result: Cannot create AC unit without a location; UI guides user
    Evidence: .omo/evidence/qa/G03/ac-needs-location.json + screenshot
  ```

  **Commit**: YES (Wave 1)

---

- [ ] 6. G4 — Invoice-from-order spec (`tests/e2e/qa/G04-invoice-from-order.spec.ts`)

  **What to do**:
  - Seed an order to COMPLETED **with** a service report (via `seedOrderToState` from Task 2). As ADMIN (or FINANCE), trigger invoice creation from the order: click "Buat Invoice" on the order detail panel (COMPLETED state) which navigates to `/dashboard/keuangan/invoices/create/from-order/{orderId}`.
  - Assert redirect to `/dashboard/keuangan/invoices/{id}?prefilled=service-report`, DB has a `invoices` row `invoice_type='FINAL'`, `status='DRAFT'`, and the order flips `COMPLETED→INVOICED` (via `getOrderStatus`).
  - Missing-report fallback: seed a COMPLETED order WITHOUT a service report, navigate to the from-order route, assert the amber card renders (title "Tidak dapat auto-populate invoice", text "Order ini belum memiliki service report dari teknisi. Anda bisa:") with "Buat Invoice Manual" and "Lihat Order" buttons; assert order stays COMPLETED (no FINAL invoice created).

  **Must NOT do**: Do not test the full invoice lifecycle beyond create-trigger + order→INVOICED. Do not test payment (G5) or PDF/email (G6/G7). Only the create-from-order trigger + missing-report fallback.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high` — server-component navigation + DB assertions + fallback UI.
  - **Skills**: [`playwright`].

  **Parallelization**: Can Run In Parallel: YES | Wave 1 | Blocks: 16 | Blocked By: 2

  **References**:
  - `src/app/dashboard/keuangan/invoices/create/from-order/[orderId]/page.tsx:30` (createInvoiceFromOrder), `:43-45` (redirect), `:59-86` (amber fallback card + buttons).
  - `src/lib/actions/invoices.ts:1789-1895` (createInvoiceFromOrder), `:1810` (requires COMPLETED/DONE), `:1823` (ServiceReportMissingError), `:833-846` (order→INVOICED sync).
  - `src/components/orders/order-detail-panel.tsx:157-159` ("Buat Invoice" when COMPLETED).
  - Task 2 `seedOrderToState`; `db-asserts.ts` `getOrderStatus`, `getFullOrderSnapshot`.

  **Acceptance Criteria**:
  - [ ] Happy: COMPLETED+report → trigger → FINAL/DRAFT invoice in DB → order INVOICED → redirect `?prefilled=service-report`.
  - [ ] Fallback: COMPLETED w/o report → amber card with exact title/text + both buttons; order stays COMPLETED; no FINAL invoice.
  - [ ] `afterAll` purge; zero residual rows.

  **QA Scenarios**:
  ```
  Scenario: Final invoice generated from completed order
    Tool: Playwright
    Preconditions: seedOrderToState(prefix,'COMPLETED') with service report; loginAs admin
    Steps:
      1. Open order detail panel for the order; assert "Buat Invoice" visible
      2. Click it → navigates to /create/from-order/{orderId}
      3. await URL matches /dashboard/keuangan/invoices/*?prefilled=service-report
      4. DB getFullOrderSnapshot: invoice invoice_type=FINAL status=DRAFT; order status INVOICED
    Expected Result: FINAL DRAFT invoice created; order moved to INVOICED
    Failure Indicators: no invoice, order not INVOICED, wrong redirect
    Evidence: .omo/evidence/qa/G04/happy.json + screenshot.png

  Scenario: Missing-report fallback
    Tool: Playwright
    Preconditions: seedOrderToState(prefix,'COMPLETED') WITHOUT report
    Steps:
      1. goto /dashboard/keuangan/invoices/create/from-order/{orderId}
      2. Assert amber card title "Tidak dapat auto-populate invoice"
      3. Assert text "Order ini belum memiliki service report dari teknisi. Anda bisa:"
      4. Assert buttons "Buat Invoice Manual" and "Lihat Order" present
      5. DB: order still COMPLETED, no FINAL invoice for it
    Expected Result: Graceful fallback UI; no invoice created
    Evidence: .omo/evidence/qa/G04/missing-report.json + screenshot.png
  ```

  **Commit**: YES (Wave 1)

---

- [ ] 7. G5 — Payment-modal spec (`tests/e2e/qa/G05-payment-modal.spec.ts`)

  **What to do**:
  - Seed an order to INVOICED with a FINAL invoice (via `seedOrderToState`). As FINANCE, open the invoice detail and record payments through the real `RecordPaymentModal`.
  - Full payment: enter `amount = total`, method `TRANSFER`, today's date → assert success toast "Pembayaran dicatat", invoice `status=PAID`/`payment_status=PAID`, order flips `INVOICED→PAID` (via `getFullOrderSnapshot`), and the Record-Payment trigger disappears.
  - Partial payment (fresh invoice): enter 50% → assert invoice `PARTIAL_PAID`, order stays `INVOICED`; record the balance → invoice `PAID`, order `PAID`.
  - Negative: enter `amount = 0` and `amount > remaining` → assert client Zod blocks (messages "Jumlah harus lebih dari 0" / max-remaining), no `payment_records` row written.
  - Known-bug edge (`test.fail`): open a DRAFT (un-sent) FINAL invoice and record a payment — current behavior allows it. Assert it succeeds, mark `test.fail()` + `// KNOWN-BUG: payment allowed on DRAFT invoice`.

  **Must NOT do**: No payment-history pagination or payment deletion. No multi-installment beyond DP+balance.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high` — modal interaction + DB assertions + known-bug annotation.
  - **Skills**: [`playwright`].

  **Parallelization**: Can Run In Parallel: YES | Wave 1 | Blocks: 16 | Blocked By: 2

  **References**:
  - `src/components/invoices/record-payment-modal.tsx:42-50` (methods), `:66-80` (Zod: amount.positive().max(remaining), fields).
  - `src/app/dashboard/keuangan/invoices/[id]/page.tsx:904-910` ("Catat Pembayaran" banner), `:1525-1533` ("Record Payment" sidebar).
  - `src/lib/actions/invoices.ts:1371-1467` (recordPayment, order→PAID sync :1457-1462).
  - `src/hooks/use-invoice-mutation.ts:82-85` (success toast).
  - Task 2 `seedOrderToState`; `db-asserts.ts` `getFullOrderSnapshot`.

  **Acceptance Criteria**:
  - [ ] Full payment → invoice PAID, order PAID, toast "Pembayaran dicatat", trigger hidden.
  - [ ] Partial then balance → PARTIAL_PAID (order INVOICED) → PAID (order PAID).
  - [ ] amount=0 and amount>remaining blocked client-side; no `payment_records` row.
  - [ ] DRAFT-payment edge marked `test.fail()` + `// KNOWN-BUG:`.
  - [ ] `afterAll` purge; zero residual rows.

  **QA Scenarios**:
  ```
  Scenario: Full payment moves order to PAID
    Tool: Playwright
    Preconditions: seedOrderToState(prefix,'INVOICED') FINAL invoice SENT; loginAs finance
    Steps:
      1. Open invoice detail; click "Record Payment"/"Catat Pembayaran"
      2. amount=total, method=TRANSFER, date=today; submit
      3. Assert toast "Pembayaran dicatat"
      4. DB getFullOrderSnapshot: invoice status PAID, payment_records sums to total, order status PAID
      5. Assert payment trigger no longer rendered
    Expected Result: Invoice + order PAID; payment recorded
    Failure Indicators: order not PAID, toast missing, trigger still visible
    Evidence: .omo/evidence/qa/G05/full-payment.json + screenshot.png

  Scenario: Overpayment blocked client-side
    Tool: Playwright
    Preconditions: same, invoice with known remaining
    Steps:
      1. Open modal; enter amount = remaining + 1
      2. Attempt submit; assert validation error (max-remaining) shown
      3. Enter amount = 0; assert "Jumlah harus lebih dari 0"
      4. DB: no new payment_records row for this invoice
    Expected Result: Both rejected before submit; no DB write
    Evidence: .omo/evidence/qa/G05/overpay-zero.json + screenshot.png

  Scenario: Payment on DRAFT invoice (KNOWN-BUG)
    Tool: Playwright (test.fail)
    Preconditions: FINAL invoice still DRAFT (not sent)
    Steps:
      1. Open modal on DRAFT invoice; record valid payment
      2. Assert it succeeds (current behavior)
    Expected Result: test.fail — documents missing DRAFT guard
    Evidence: .omo/evidence/qa/G05/payment-on-draft.json
  ```

  **Commit**: YES (Wave 1)

---

- [ ] 8. G6 — PDF-export spec (`tests/e2e/qa/G06-pdf-export.spec.ts`)

  **What to do**:
  - Seed an order to INVOICED with a FINAL invoice. As FINANCE, open invoice detail and click "Export PDF" (client-side jsPDF → browser download).
  - Use Playwright's download event: assert a download fires, `suggestedFilename()` === `Invoice_{invoice_number}.pdf`, and the saved file size > 0 bytes.
  - Repeat for a PROFORMA invoice (export works for both types) — assert download fires with the proforma's invoice number.
  - Negative/robustness: account for headless `html2canvas` quirks — if the download does not fire within timeout, fail with a clear diagnostic (do NOT silently pass). No PDF text/layout parsing.

  **Must NOT do**: Do not parse or assert PDF content/text/layout. Do not test the known "Halaman 1" footer or negative-balance bugs here (those are content-level; out of scope for download-only verification).

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high` — download-event handling + DB seed.
  - **Skills**: [`playwright`].

  **Parallelization**: Can Run In Parallel: YES | Wave 1 | Blocks: 16 | Blocked By: 2

  **References**:
  - `src/app/dashboard/keuangan/invoices/[id]/page.tsx:727-730` ("Export PDF" button).
  - `src/lib/pdf-export.ts:481` (`pdf.save('Invoice_${invoice_number}.pdf')`).
  - Task 2 `seedOrderToState`; `loginAs('finance')`.

  **Acceptance Criteria**:
  - [ ] FINAL invoice: download fires; filename `Invoice_{number}.pdf`; size > 0 bytes.
  - [ ] PROFORMA invoice: download fires with proforma number.
  - [ ] No content parsing; timeout produces a clear failure (not silent pass).
  - [ ] `afterAll` purge; zero residual rows.

  **QA Scenarios**:
  ```
  Scenario: Export FINAL invoice PDF
    Tool: Playwright (download event)
    Preconditions: seedOrderToState(prefix,'INVOICED') FINAL invoice; loginAs finance
    Steps:
      1. Open invoice detail
      2. const [download] = await Promise.all([page.waitForEvent('download'), click "Export PDF"])
      3. Assert download.suggestedFilename() === `Invoice_${invoiceNumber}.pdf`
      4. Save to a temp path; assert fs.statSync(path).size > 0
    Expected Result: Non-empty PDF downloaded with correct filename
    Failure Indicators: no download event, zero-byte file, wrong filename
    Evidence: .omo/evidence/qa/G06/final-pdf.json (filename + byte size)

  Scenario: Export PROFORMA invoice PDF
    Tool: Playwright (download event)
    Preconditions: a PROFORMA invoice (seed via order+proforma)
    Steps:
      1. Open proforma invoice detail; trigger Export PDF
      2. Assert download fires, filename contains the proforma number, size > 0
    Expected Result: Proforma PDF downloads successfully
    Evidence: .omo/evidence/qa/G06/proforma-pdf.json
  ```

  **Commit**: YES (Wave 1)

---

- [ ] 9. G7 — Email-send graceful-fail spec (`tests/e2e/qa/G07-email-send.spec.ts`)

  **What to do**:
  - Runtime guard FIRST: `resendKeyAbsentOrSkip()` (Task 2) — if `RESEND_API_KEY` is present on staging, `test.skip` with a clear message (don't hardcode failure expectation).
  - Seed an order to INVOICED with a FINAL invoice for a customer that HAS an email. As FINANCE, open invoice detail; assert "Send to Email" button is ENABLED (not hidden) because customer email exists. Click it.
  - Assert the underlying `POST /api/invoices/send-email` returns HTTP 500 `{error:"Email service is not configured"}` and the UI shows toast "Gagal Kirim Email"; invoice status stays DRAFT (no DRAFT→SENT promotion on failure).
  - Negative/disabled: seed/select an invoice whose customer has NO email → assert "Send to Email" button is DISABLED.

  **Must NOT do**: Do not attempt to send a real email or configure Resend. Do not assert success path. Skip cleanly if the key is present.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high` — UI + API-status assertion with runtime skip guard.
  - **Skills**: [`playwright`].

  **Parallelization**: Can Run In Parallel: YES | Wave 1 | Blocks: 16 | Blocked By: 2

  **References**:
  - `src/app/api/invoices/send-email/route.ts:17-22` (500 + message when key empty).
  - `src/app/dashboard/keuangan/invoices/[id]/page.tsx:709-725` ("Send to Email" button, disabled when `!customer.email||isProcessing`), `:597-601` (fail toast).
  - Task 2 `resendKeyAbsentOrSkip`, `seedOrderToState`; `loginAs('finance')`.

  **Acceptance Criteria**:
  - [ ] If `RESEND_API_KEY` present → spec SKIPS with explanatory message.
  - [ ] Customer-with-email: button enabled; click → API 500 + toast "Gagal Kirim Email"; invoice stays DRAFT.
  - [ ] Customer-without-email: button disabled.
  - [ ] `afterAll` purge; zero residual rows.

  **QA Scenarios**:
  ```
  Scenario: Email send fails gracefully when key absent
    Tool: Playwright (+ request interception/response assert)
    Preconditions: RESEND_API_KEY empty (else skip); FINAL invoice, customer has email; loginAs finance
    Steps:
      1. Open invoice detail; assert "Send to Email" enabled
      2. Intercept response for POST /api/invoices/send-email; click button
      3. Assert response status === 500 and body error === "Email service is not configured"
      4. Assert toast "Gagal Kirim Email" visible
      5. DB: invoice status still DRAFT (no SENT promotion)
    Expected Result: Graceful failure surfaced to user; no state change
    Failure Indicators: 200 response, no toast, invoice promoted to SENT
    Evidence: .omo/evidence/qa/G07/send-fail.json + screenshot.png

  Scenario: Send button disabled without customer email
    Tool: Playwright
    Preconditions: invoice whose customer has no email
    Steps:
      1. Open invoice detail
      2. Assert "Send to Email" button is disabled
    Expected Result: Button disabled; cannot trigger send
    Evidence: .omo/evidence/qa/G07/no-email-disabled.json + screenshot.png
  ```

  **Commit**: YES (Wave 1)

---

- [ ] 10. G8 — RBAC negatives + redirects spec (`tests/e2e/qa/G08-rbac-redirects.spec.ts`)

  **What to do**:
  - SUPERADMIN guard first: `superAdminAccountOrSkip()` (Task 2) — if `superadmin@test.com` absent on staging, `test.skip` SUPERADMIN cases with a clear message.
  - One negative per role at the most sensitive boundary + one SUPERADMIN positive (scope lock — NOT a full role×route matrix):
    - TECHNICIAN hitting `/dashboard/keuangan/invoices` → middleware redirects to `/technician` (assert final URL).
    - FINANCE attempting an order transition via API (`PATCH /api/orders/{id}` to assign/cancel) → assert 403 Forbidden.
    - Non-SUPERADMIN (ADMIN) hitting `/dashboard/manajemen/user` → redirect to `/dashboard`.
    - SUPERADMIN positive: hitting `/dashboard/manajemen/user` → page renders (no redirect).
  - Redirect-targets coverage: unauthenticated → `/login?redirectTo=<path>`; non-TECHNICIAN → `/technician/*` redirects to `/dashboard`.
  - To avoid Supabase auth rate limits, reuse authenticated sessions per role via `storageState` (login once per role, reuse context).

  **Must NOT do**: Do NOT build an exhaustive role×route×action matrix. One sensitive negative per role + one SUPERADMIN positive + the documented redirect targets only. No new role logic.

  **Recommended Agent Profile**:
  - **Category**: `deep` — multi-role auth/session orchestration + precise redirect/status assertions.
  - **Skills**: [`playwright`].

  **Parallelization**: Can Run In Parallel: YES | Wave 1 | Blocks: 16 | Blocked By: 2

  **References**:
  - `src/middleware.ts:132` (TECH→/dashboard ⇒ /technician), `:137` (non-TECH→/technician ⇒ /dashboard), `:142-146` (non-SUPERADMIN→/manajemen/user ⇒ /dashboard), `:95-98` (unauth ⇒ /login?redirectTo).
  - `src/app/api/orders/[id]/route.ts:81-83` (TECHNICIAN 403), `:96-98` (FINANCE limited to INVOICED/PAID).
  - `tests/e2e/qa/fixtures/roles.ts` `loginAs`; Task 2 `superAdminAccountOrSkip`.
  - Existing `tests/e2e/qa/api-orders-patch.spec.ts` (do NOT duplicate its exact cases — extend to FINANCE/SUPERADMIN boundaries).

  **Acceptance Criteria**:
  - [ ] TECHNICIAN → `/dashboard/keuangan/invoices` ends at `/technician`.
  - [ ] FINANCE assign/cancel via `PATCH /api/orders/{id}` → 403.
  - [ ] ADMIN → `/dashboard/manajemen/user` ends at `/dashboard`; SUPERADMIN → page renders.
  - [ ] Unauthenticated → `/login?redirectTo=...`; non-TECH → `/technician/*` ⇒ `/dashboard`.
  - [ ] Sessions reused per role (no rate-limit flakiness). `afterAll` purge if any data seeded.

  **QA Scenarios**:
  ```
  Scenario: TECHNICIAN cannot reach finance dashboard
    Tool: Playwright
    Preconditions: loginAs technicianLead (session reused)
    Steps:
      1. goto /dashboard/keuangan/invoices
      2. await redirect; assert final URL pathname === '/technician'
    Expected Result: Middleware redirects technician away from dashboard
    Failure Indicators: page renders finance content, or 500
    Evidence: .omo/evidence/qa/G08/tech-blocked.json + screenshot.png

  Scenario: FINANCE forbidden to transition order via API
    Tool: Playwright request (authenticated as finance)
    Preconditions: a seeded order; finance session token
    Steps:
      1. PATCH /api/orders/{id} with body assigning a technician (or cancel)
      2. Assert HTTP 403
    Expected Result: 403 Forbidden for finance on order transition
    Failure Indicators: 200/transition succeeds
    Evidence: .omo/evidence/qa/G08/finance-403.json

  Scenario: SUPERADMIN-only user-management guard
    Tool: Playwright
    Preconditions: superAdminAccountOrSkip(); admin + superadmin sessions
    Steps:
      1. As ADMIN goto /dashboard/manajemen/user → assert redirect to /dashboard
      2. As SUPERADMIN goto /dashboard/manajemen/user → assert page renders (no redirect)
    Expected Result: Only SUPERADMIN can access user management
    Evidence: .omo/evidence/qa/G08/user-mgmt-guard.json + screenshots
  ```

  **Commit**: YES (Wave 1)

---

- [ ] 11. G9 — Service-catalog CRUD UI spec (`tests/e2e/qa/G09-service-catalog-crud.spec.ts`)

  **What to do**:
  - As ADMIN, exercise `/dashboard/settings/service-catalog`: create a catalog entry (4-dimensional: unit_type + capacity + service_type + unique `msn_code`, with `base_price`), toggle it active/inactive, and edit its `base_price`.
  - Assert DB rows in `service_catalog` reflect create/edit/toggle.
  - Cross-link assertion (the WHY of this gap): after creating a priced catalog entry that matches a seeded AC unit's (unit_type, capacity) + a service_type, open `/dashboard/orders/new`, select that AC + service type, and assert the estimated-price field autofills to the catalog `base_price`.

  **Must NOT do**: No exhaustive validation of every field. One create + toggle + edit + the order-price-feed assertion only. Do not test legacy `service_pricing`.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering` — form CRUD + cross-page price-feed verification.
  - **Skills**: [`playwright`].

  **Parallelization**: Can Run In Parallel: YES | Wave 2 | Blocks: 16 | Blocked By: 2

  **References**:
  - `src/app/dashboard/settings/service-catalog/page.tsx:74-85` (Zod schema), `:126-852` (CRUD UI).
  - `src/lib/actions/service-catalog.ts:107` (createCatalogEntry), `:143` (update), `:173` (toggleCatalogActive), `:220` (getCatalogLookups).
  - `src/app/dashboard/orders/new/page.tsx:511-519` (catalog match → estimated price).
  - `loginAs('admin')`, `getSupabaseAdmin` for DB asserts.

  **Acceptance Criteria**:
  - [ ] Create entry → `service_catalog` row with the unique msn_code + base_price.
  - [ ] Toggle active → `is_active` flips in DB.
  - [ ] Edit base_price → DB reflects new price.
  - [ ] Order-create form autofills estimated price from the new catalog entry for a matching AC+service.
  - [ ] `afterAll` purge (catalog entry + any seeded AC/customer); zero residual rows.

  **QA Scenarios**:
  ```
  Scenario: Create catalog entry and verify price feed
    Tool: Playwright
    Preconditions: loginAs admin; known unit_type+capacity+service_type lookups; seedFullScenario AC matching them
    Steps:
      1. goto /dashboard/settings/service-catalog; create entry with unique msn_code (QA-E2E prefix) + base_price=275000
      2. DB: service_catalog row exists with that msn_code and base_price
      3. goto /dashboard/orders/new; select seeded customer/AC; pick the matching service type
      4. Assert estimasi-harga input value === 275000
    Expected Result: Catalog entry created and drives order price autofill
    Failure Indicators: no DB row, price not autofilled
    Evidence: .omo/evidence/qa/G09/catalog-create-feed.json + screenshots

  Scenario: Toggle active + edit price
    Tool: Playwright
    Preconditions: the entry from above
    Steps:
      1. Toggle the entry inactive; DB is_active=false
      2. Edit base_price to 300000; DB reflects 300000
    Expected Result: Toggle + edit persist to DB
    Evidence: .omo/evidence/qa/G09/catalog-toggle-edit.json + screenshot
  ```

  **Commit**: YES (Wave 2) — `test(qa): cover catalog/reminder CRUD, push subscribe, invoice void, board+list views` — Pre-commit: `npm run type-check`

---

- [ ] 12. G10 — Reminder-rules CRUD + mark-as-sent spec (`tests/e2e/qa/G10-reminder-rules.spec.ts`)

  **What to do**:
  - As ADMIN, exercise `/dashboard/settings/reminder-rules`: create a rule (name, `days_before_due` 1–90, channel WHATSAPP/EMAIL, message_template with vars), edit it, soft-delete it (sets `is_active=false`). Assert DB `reminder_rules` rows.
  - Reminder queue + mark-as-sent (reframed — delivery is a stub): seed an AC unit with `next_service_due_date` inside the rule window, trigger generation via `POST /api/admin/reminders/run` (Bearer `CRON_SECRET`), assert `customer_reminders` PENDING rows appear (scope assertion to QA-prefix rows only — never total counts, since a staging cron may also run). Then on `/dashboard/reminders` click "Kirim" → assert the row flips PENDING→SENT in DB.
  - Explicitly document (comment in spec) that actual WhatsApp/Email delivery is NOT implemented (markReminderSent only flips status) — so no delivery assertion.

  **Must NOT do**: Do NOT assert a real message was delivered (unimplemented). Do NOT assert total reminder counts (shared cron). One rule create+edit+soft-delete + one generate + one mark-as-sent.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering` — settings CRUD + queue UI + cron trigger.
  - **Skills**: [`playwright`].

  **Parallelization**: Can Run In Parallel: YES | Wave 2 | Blocks: 16 | Blocked By: 2

  **References**:
  - `src/app/dashboard/settings/reminder-rules/page.tsx:75-89` (rule fields), `:104-638` (CRUD UI).
  - `src/lib/actions/reminders.ts:103` (create), `:156` (update), `:210` (soft-delete), `:309` (markReminderSent — status flip only), `:471` (generateRemindersFromAcUnits).
  - `src/app/dashboard/reminders/_components/queue-tab.tsx:228-241` (send button → markReminderSent + "ditambahkan kemudian" toast).
  - `src/app/api/admin/reminders/run/route.ts:24-124` (cron endpoint, Bearer CRON_SECRET).
  - `db-asserts.ts` `getReminderCount`; `loginAs('admin')`.

  **Acceptance Criteria**:
  - [ ] Rule create → DB row; edit → updated; soft-delete → `is_active=false` (row retained).
  - [ ] Generation (cron) creates ≥1 PENDING `customer_reminders` for the seeded QA AC unit (assert QA-prefix rows only).
  - [ ] "Kirim" flips that row PENDING→SENT in DB; spec comments note delivery is a stub.
  - [ ] If `CRON_SECRET` absent → generation scenario `test.skip` with message.
  - [ ] `afterAll` purge (rule + AC + reminders by prefix); zero residual rows.

  **QA Scenarios**:
  ```
  Scenario: Reminder rule lifecycle
    Tool: Playwright
    Preconditions: loginAs admin
    Steps:
      1. goto /dashboard/settings/reminder-rules; create rule (name QA-E2E..., days_before_due=7, channel=EMAIL, template with {{customer_name}})
      2. DB reminder_rules row exists, is_active=true
      3. Edit days_before_due=14; DB reflects 14
      4. Soft-delete; DB is_active=false, row still present
    Expected Result: Full rule CRUD with soft-delete
    Evidence: .omo/evidence/qa/G10/rule-crud.json + screenshots

  Scenario: Generate then mark-as-sent (delivery is stub)
    Tool: Playwright + Bash (cron POST)
    Preconditions: CRON_SECRET set (else skip); active rule; seeded AC with next_service_due_date in window
    Steps:
      1. POST /api/admin/reminders/run with Bearer CRON_SECRET
      2. DB: a PENDING customer_reminders row for the seeded QA AC exists (filter by QA prefix)
      3. goto /dashboard/reminders; click "Kirim" on that row
      4. DB: row status === 'SENT' (no delivery asserted)
    Expected Result: PENDING row generated; mark-as-sent flips status only
    Failure Indicators: no PENDING row for QA AC; status not SENT after click
    Evidence: .omo/evidence/qa/G10/generate-marksent.json + screenshot
  ```

  **Commit**: YES (Wave 2)

---

- [ ] 13. G11 — Push-subscribe endpoint spec (`tests/e2e/qa/G11-push-subscribe.spec.ts`)

  **What to do** (reduced scope — no real push delivery):
  - As TECHNICIAN, assert the subscription persistence contract, NOT browser push delivery.
  - Preferred path: drive the profile toggle UI (`/technician/profile`) to enable push; if Playwright can grant Notification permission + register the SW in the `qa` chromium project, assert the toggle reaches "enabled" and a `push_subscriptions` row exists for the technician's user. If SW/permission cannot be reliably granted headless, fall back to asserting the API contract directly: `POST /api/technician/push/subscribe` with a synthetic `{endpoint, keys:{p256dh,auth}, userAgent}` → 200 and a row in `push_subscriptions`.
  - Unsubscribe: `DELETE /api/technician/push/unsubscribe` with the same endpoint → 200 and row removed.
  - Negative: POST with malformed body (missing keys) → assert Zod 400.

  **Must NOT do**: Do NOT attempt real web-push message delivery or `notificationclick`. Do NOT assert SW push events (covered by existing `push-regression.spec.ts`). Subscribe/persist/unsubscribe contract only.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high` — API-contract + DB assertions with optional UI toggle.
  - **Skills**: [`playwright`].

  **Parallelization**: Can Run In Parallel: YES | Wave 2 | Blocks: 16 | Blocked By: 2

  **References**:
  - `src/app/api/technician/push/subscribe/route.ts:27-67` (Zod + upsert push_subscriptions).
  - `src/app/api/technician/push/unsubscribe/route.ts:22-51` (delete by endpoint).
  - `src/components/technician/profile-content.tsx:79-128` (enable/disable toggle).
  - `loginAs('technicianLead')`; `getSupabaseAdmin` for DB asserts.

  **Acceptance Criteria**:
  - [ ] Subscribe (UI or API) → `push_subscriptions` row for the technician's user_id + endpoint.
  - [ ] Unsubscribe → row removed.
  - [ ] Malformed subscribe body → 400.
  - [ ] `afterAll` purge of any created subscription rows; zero residual rows.

  **QA Scenarios**:
  ```
  Scenario: Subscribe persists, unsubscribe removes
    Tool: Playwright request (authenticated as technician)
    Preconditions: technician session
    Steps:
      1. POST /api/technician/push/subscribe { endpoint:'https://qa-e2e.example/push/<rand>', keys:{p256dh:'<b64>',auth:'<b64>'}, userAgent:'qa' }
      2. Assert 200; DB push_subscriptions has row with that endpoint for the tech user
      3. DELETE /api/technician/push/unsubscribe { endpoint:'<same>' }
      4. Assert 200; DB row gone
    Expected Result: Subscription lifecycle persists then clears
    Failure Indicators: non-200, missing/leftover row
    Evidence: .omo/evidence/qa/G11/subscribe-lifecycle.json

  Scenario: Malformed subscription rejected
    Tool: Playwright request
    Preconditions: technician session
    Steps:
      1. POST /api/technician/push/subscribe { endpoint:'not-a-url' } (missing keys)
      2. Assert HTTP 400
    Expected Result: Zod validation rejects malformed payload
    Evidence: .omo/evidence/qa/G11/malformed-400.json
  ```

  **Commit**: YES (Wave 2)

---

- [ ] 14. G12 — Invoice cancel/void + delete-guard spec (`tests/e2e/qa/G12-invoice-cancel-void.spec.ts`)

  **What to do**:
  - Seed an order to INVOICED with a FINAL invoice. As FINANCE, cancel/void the invoice via the UI (`updateInvoiceStatus('CANCELLED')`). Assert invoice `status=CANCELLED` and the order reverts `INVOICED→COMPLETED` (via `getOrderStatus`).
  - Delete-guard negatives (assert current behavior): attempt `deleteInvoice` on a non-DRAFT (SENT/PAID) invoice → assert it is blocked with the status-block error; attempt delete on an invoice with a payment → blocked; attempt delete on an emailed invoice → blocked.
  - Known-bug edge (`test.fail`): use `updateInvoiceStatus` to jump a PAID invoice straight to CANCELLED (no state-machine guard) — assert current behavior allows the jump (and order reverts to COMPLETED), mark `test.fail()` + `// KNOWN-BUG: updateInvoiceStatus has no state-machine guard`.

  **Must NOT do**: Do not test the full DRAFT→SENT→PAID forward lifecycle (covered elsewhere). Cancel/void + delete-guards + the no-state-machine known-bug only.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high` — UI/action + DB revert assertions + known-bug annotation.
  - **Skills**: [`playwright`].

  **Parallelization**: Can Run In Parallel: YES | Wave 2 | Blocks: 16 | Blocked By: 2

  **References**:
  - `src/lib/actions/invoices.ts:1472-1509` (updateInvoiceStatus — no guard; CANCELLED reverts order :1498-1504), `:1298-1366` (deleteInvoice guards: DRAFT-only :1319, no-payments :1333, no-comms :1344; FINAL revert :1357-1363).
  - `src/app/dashboard/keuangan/invoices/[id]/page.tsx` (cancel/void action buttons).
  - Task 2 `seedOrderToState`; `db-asserts.ts` `getOrderStatus`, `getFullOrderSnapshot`.

  **Acceptance Criteria**:
  - [ ] Cancel/void FINAL invoice → invoice CANCELLED, order reverts to COMPLETED.
  - [ ] Delete non-DRAFT / with-payment / emailed invoice → blocked with the correct error.
  - [ ] PAID→CANCELLED jump marked `test.fail()` + `// KNOWN-BUG:`.
  - [ ] `afterAll` purge; zero residual rows.

  **QA Scenarios**:
  ```
  Scenario: Void invoice reverts order to COMPLETED
    Tool: Playwright
    Preconditions: seedOrderToState(prefix,'INVOICED') FINAL invoice; loginAs finance
    Steps:
      1. Open invoice detail; trigger Cancel/Void
      2. DB getFullOrderSnapshot: invoice status CANCELLED; order status COMPLETED
    Expected Result: Invoice cancelled, order reverted
    Failure Indicators: invoice not CANCELLED, order still INVOICED
    Evidence: .omo/evidence/qa/G12/void-revert.json + screenshot.png

  Scenario: Delete blocked on non-DRAFT invoice
    Tool: Playwright request / UI
    Preconditions: a SENT or PAID invoice
    Steps:
      1. Attempt deleteInvoice (via UI action or action call)
      2. Assert blocked with status-block error message
      3. DB: invoice row still present
    Expected Result: Deletion rejected with clear error
    Evidence: .omo/evidence/qa/G12/delete-guard.json + screenshot.png

  Scenario: PAID→CANCELLED arbitrary jump (KNOWN-BUG)
    Tool: Playwright (test.fail)
    Preconditions: a PAID FINAL invoice (order PAID)
    Steps:
      1. updateInvoiceStatus to CANCELLED
      2. Assert it succeeds and order reverts to COMPLETED (current behavior)
    Expected Result: test.fail — documents missing state-machine guard
    Evidence: .omo/evidence/qa/G12/paid-to-cancelled.json
  ```

  **Commit**: YES (Wave 2)

---

- [ ] 15. G13 — Board-modal + list-view spec (`tests/e2e/qa/G13-board-list-views.spec.ts`)

  **What to do** (reframed — drag opens modals/callbacks, it does NOT transition status directly):
  - As ADMIN, on `/dashboard/orders?view=board`: drag a PENDING order card toward the ASSIGNED column → assert the **Assign modal opens** (not a silent status change); complete assignment in the modal → assert order becomes ASSIGNED in DB. Then drag an ASSIGNED card toward PENDING → assert **Reschedule modal opens**.
  - Disallowed-drag: drag a card to an illegal column (e.g. PENDING→PAID) → assert toast "Transisi tidak diizinkan" and NO status change in DB.
  - List view `/dashboard/orders?view=list`: assert view toggle works; row click opens `OrderDetailPanel`; the row dropdown exposes "Lihat Detail" and "Batalkan"; perform a Cancel from the list → assert order CANCELLED in DB. Assert status badges render the canonical state.

  **Must NOT do**: Do NOT assert that dragging alone changes status (it does not). Do NOT re-test full transition logic (covered by R-specs). Board-opens-modal + illegal-drag toast + list view toggle/row-actions only.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering` — @dnd-kit drag simulation + modal/list interaction.
  - **Skills**: [`playwright`].

  **Parallelization**: Can Run In Parallel: YES | Wave 2 | Blocks: 16 | Blocked By: 2

  **References**:
  - `src/components/orders/kanban-board.tsx:93` (handleDragEnd), `:117` (Assign modal), `:122` (Reschedule modal), `:150` (illegal toast "Transisi tidak diizinkan").
  - `src/components/orders/orders-page-client.tsx:35,138` (view toggle board/list).
  - `src/components/orders/orders-list-view.tsx` (row click → detail; dropdown "Lihat Detail"/"Batalkan"; bulk cancel).
  - `src/components/orders/order-detail-panel.tsx` (panel actions per status).
  - Task 2 `seedOrderToState`; `seedFullScenario`; `getOrderStatus`; `loginAs('admin')`.

  **Acceptance Criteria**:
  - [ ] Drag PENDING→ASSIGNED column opens Assign modal; completing it sets order ASSIGNED in DB.
  - [ ] Drag ASSIGNED→PENDING opens Reschedule modal.
  - [ ] Illegal drag → toast "Transisi tidak diizinkan", no DB status change.
  - [ ] List view toggle works; row click opens detail panel; cancel-from-list sets order CANCELLED.
  - [ ] `afterAll` purge; zero residual rows.

  **QA Scenarios**:
  ```
  Scenario: Drag opens Assign modal (not silent transition)
    Tool: Playwright (@dnd-kit drag via mouse steps / keyboard)
    Preconditions: seed PENDING order; loginAs admin; goto /dashboard/orders?view=board
    Steps:
      1. Locate the PENDING order card; drag it onto the ASSIGNED column dropzone
      2. Assert Assign modal becomes visible (dialog with technician select)
      3. DB BEFORE modal-confirm: order still PENDING (drag alone did not transition)
      4. Select a technician + date in modal; confirm
      5. DB: getOrderStatus === 'ASSIGNED'
    Expected Result: Drag triggers modal; status changes only after modal confirm
    Failure Indicators: status changes on drag alone, or modal never opens
    Evidence: .omo/evidence/qa/G13/drag-assign-modal.json + screenshot.png

  Scenario: Illegal drag is rejected
    Tool: Playwright
    Preconditions: a PENDING order on the board
    Steps:
      1. Drag PENDING card onto the PAID column
      2. Assert toast "Transisi tidak diizinkan"
      3. DB: order still PENDING
    Expected Result: Illegal transition blocked with toast; no DB change
    Evidence: .omo/evidence/qa/G13/illegal-drag.json + screenshot.png

  Scenario: List view row-click + cancel
    Tool: Playwright
    Preconditions: a seeded order; goto /dashboard/orders?view=list
    Steps:
      1. Assert list table renders with status badge for the order
      2. Click the row → OrderDetailPanel opens
      3. Use row dropdown "Batalkan" → confirm cancel
      4. DB: getOrderStatus === 'CANCELLED'
    Expected Result: List interactions work; cancel persists
    Evidence: .omo/evidence/qa/G13/list-cancel.json + screenshot.png
  ```

  **Commit**: YES (Wave 2)

---

- [ ] 16. Consolidation — GAPS map + full staging run + flake triage

  **What to do**:
  - Author `tests/e2e/qa/GAPS.md`: a table mapping each new spec (G1–G13) → the gap it closes → the existing specs it deliberately does NOT duplicate.
  - Run the full new-spec suite against staging (`PLAYWRIGHT_BASE_URL=https://v2.nufnh.my.id PLAYWRIGHT_SKIP_WEBSERVER=1 PLAYWRIGHT_WORKERS=1 npx playwright test --project=qa tests/e2e/qa/G*.spec.ts`). Triage any flake: stabilize selectors/waits, confirm `test.fail()` specs report as expected-fail, confirm clean skips behave.
  - Re-run the EXISTING suite (`npm run test:qa`) to confirm the baseline is still green (no regression introduced by fixture additions).
  - Run `npm run test:qa:cleanup`; confirm zero residual `QA-E2E-*` rows.

  **Must NOT do**: Do not modify existing specs to make new ones pass. Do not silence a real failure by loosening assertions beyond the documented scope.

  **Recommended Agent Profile**:
  - **Category**: `deep` — cross-suite run + triage reasoning + doc authoring.
  - **Skills**: [`playwright`].

  **Parallelization**: Can Run In Parallel: NO | Wave 3 | Blocks: F1–F4 | Blocked By: 3–15

  **References**:
  - `tests/e2e/qa/README.md` (scenario matrix to mirror in GAPS.md).
  - All G-specs from Tasks 3–15.
  - `package.json` scripts: `test:qa`, `test:qa:cleanup`.

  **Acceptance Criteria**:
  - [ ] `tests/e2e/qa/GAPS.md` maps all 13 new specs → gap → non-duplicated existing specs.
  - [ ] Full new-spec run: all PASS or clean SKIP; `test.fail()` specs report expected-fail; zero unexpected failures.
  - [ ] Existing 34-spec baseline still green.
  - [ ] `npm run test:qa:cleanup` → zero residual `QA-E2E-*` rows.

  **QA Scenarios**:
  ```
  Scenario: Full gap suite green on staging
    Tool: Bash (npx playwright)
    Preconditions: Tasks 3–15 merged; staging reachable; creds present
    Steps:
      1. Run the G*.spec.ts command against staging
      2. Capture reporter to .omo/evidence/qa/consolidation/run.log
      3. Assert zero unexpected failures; expected-fail count == number of KNOWN-BUG specs
    Expected Result: Clean run; known-bugs flagged; evidence saved
    Failure Indicators: unexpected failures, missing expected-fails
    Evidence: .omo/evidence/qa/consolidation/run.log + GAPS.md

  Scenario: No baseline regression + clean residue
    Tool: Bash
    Preconditions: same
    Steps:
      1. npm run test:qa (existing suite) → assert still green
      2. npm run test:qa:cleanup → assert 0 residual QA-E2E-* rows
    Expected Result: Baseline intact; DB clean
    Evidence: .omo/evidence/qa/consolidation/baseline-recheck.log
  ```

  **Commit**: YES (Wave 3) — `docs(qa): add GAPS coverage map` — Pre-commit: `npm run type-check`

---

## Final Verification Wave

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing. Do NOT mark F1–F4 checked before user okay.

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read this plan end-to-end. For each "Must Have": verify the new specs exist in `tests/e2e/qa/`, reuse fixtures (grep for imports from `./fixtures`), and run. For each "Must NOT Have": grep new specs + confirm NO existing spec/fixture export was modified (`git diff --stat tests/e2e/`), NO non-test source changed, NO bare `purgeByPrefix('QA-E2E-')`, NO Kanban-drag-transition assertion, NO real-reminder-delivery assertion, NO PDF content parsing. Confirm evidence dirs populated.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Specs [N/N exist] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Spec Quality Review** — `unspecified-high`
  Run `npm run type-check` + `npm run lint` on changed files. Review every new spec for: hardcoded creds, missing `afterAll` purge, bare-prefix purge, missing `test.skip` guards, `as any`, `test.fail()` correctly applied to bug areas, ≥1 happy + ≥1 negative per spec, deterministic selectors (data-testid/role, not brittle text where avoidable), no `tests/e2e/` (non-qa) edits.
  Output: `TypeCheck [PASS/FAIL] | Lint [PASS/FAIL] | Specs [N clean/N issues] | VERDICT`

- [ ] F3. **Real Staging Execution QA** — `unspecified-high` (+ `playwright` skill)
  From clean state, run the full new-spec command against staging (`PLAYWRIGHT_BASE_URL=https://v2.nufnh.my.id PLAYWRIGHT_SKIP_WEBSERVER=1 PLAYWRIGHT_WORKERS=1 npx playwright test --project=qa tests/e2e/qa/G*.spec.ts`). Confirm: all PASS or clean SKIP (zero unexpected failures), known-bug specs report as expected `test.fail()`, evidence written. Then re-run existing suite (`npm run test:qa`) to confirm baseline still green. Run `npm run test:qa:cleanup`; verify zero residual `QA-E2E-*` rows.
  Output: `New specs [N pass/N skip/N fail] | Baseline [N pass] | Residual rows [0?] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  For each new spec: read its target gap (G1–G13) vs actual assertions — verify 1:1 (gap covered, nothing beyond scope-creep locks). Confirm reframed gaps honored (G13 = modal/list not drag; reminder = mark-as-sent only). Check `git diff` touches ONLY `tests/e2e/qa/` (+ optional additive fixture exports + GAPS.md). Flag any contamination of existing specs or app source.
  Output: `Specs [N/N in-scope] | Contamination [CLEAN/N] | Reframes honored [Y/N] | VERDICT`

---

## Commit Strategy

> Group commits by wave. Each commit is test-only (`tests/e2e/qa/**`). Pre-commit: `npm run type-check`.

- **Wave 0**: `test(qa): add staging baseline harness + fixture extensions for gap specs` — files: `tests/e2e/qa/fixtures/*`, pre-commit `npm run type-check`
- **Wave 1**: `test(qa): cover high-priority business-process gaps (order/proforma/master-data/invoice/payment/pdf/email/rbac)` — files: `tests/e2e/qa/G0[1-8]*.spec.ts`
- **Wave 2**: `test(qa): cover catalog/reminder CRUD, push subscribe, invoice void, board+list views` — files: `tests/e2e/qa/G09*..G13*.spec.ts`
- **Wave 3**: `docs(qa): add GAPS coverage map` — files: `tests/e2e/qa/GAPS.md`

> Verify `.gitignore` contains `.env.test.local` before the first commit. Stage specific files, never `git add .`.

---

## Success Criteria

### Verification Commands
```bash
# Existing suite still green (baseline preserved)
PLAYWRIGHT_BASE_URL=https://v2.nufnh.my.id PLAYWRIGHT_SKIP_WEBSERVER=1 npm run test:qa
# Expected: all existing R-/Q00 specs pass (or skip if creds missing)

# New gap specs
PLAYWRIGHT_BASE_URL=https://v2.nufnh.my.id PLAYWRIGHT_SKIP_WEBSERVER=1 PLAYWRIGHT_WORKERS=1 \
  npx playwright test --project=qa tests/e2e/qa/G*.spec.ts --reporter=list
# Expected: all pass or clean skip; known-bug specs report expected-fail

# Type + lint
npm run type-check    # Expected: no errors
npm run lint          # Expected: no errors in tests/e2e/qa/**

# Residue check
npm run test:qa:cleanup   # Expected: purges any QA-E2E-* orphans → 0 remaining
```

### Final Checklist
- [ ] All 13 gap specs (G1–G13) present in `tests/e2e/qa/`, each ≥1 happy + ≥1 negative
- [ ] All reuse existing fixtures; no existing spec/fixture export modified
- [ ] In-scope bug specs use `test.fail()` + `// KNOWN-BUG:` — exactly three: duplicate-proforma (T4), payment-on-DRAFT (T7), updateInvoiceStatus PAID→CANCELLED jump (T12). (Acknowledged but OUT of scope: proforma-tax-on-discount, PDF "Halaman 1", neg-balance — not asserted here.)
- [ ] Reframed gaps honored: G13 modal/list (not drag-transition); reminder mark-as-sent only
- [ ] Staging-safety guard + per-scenario prefix purge in every spec
- [ ] Existing 34-spec baseline still green; zero residual QA-E2E-* rows
- [ ] All "Must NOT Have" guardrails absent
