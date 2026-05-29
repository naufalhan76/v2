# QA Suite Fixing Plan

> Status: approved 2026-05-29 — awaiting execution.
> Decisions locked: A1(a), A2(a), A3(b), D2(a), A5+A6 bundled, B2 includes data-testid audit, Q1(a) ship reminder migration, Q2(a) remove admin-client fallbacks once PATCH route lands.

## TL;DR

15 findings split across production code, test infra, harness, and spec coverage. Critical path: A3 PATCH route + D1 R-01 happy path. Rollout in 5 waves with parallel agents — estimated 90 min wall-clock.

## Context

The technician E2E suite shipped with all 10 fixtures, 17 R-XX specs + Q00 + R-cross-audit, and the seed/cleanup scripts. R-01 happy path is missing. Several specs annotate production-code findings that should be fixed before the suite goes green. Oracle architecture review surfaced 5 test-infra improvements. F2 oracle code-quality review residue (E1-E7) needs a re-verify pass before changes.

### Source of findings

1. Oracle F2 code-quality review residue (E1-E7) — read-only re-verify needed.
2. Oracle QA architecture review — fixture-layer feedback (B1-B5).
3. R-XX spec annotations — runtime gaps documented inline (A1, A2, A4).
4. R-15 / R-17 / R-14 scaffolding gaps (A3, C1, A4).
5. R-01 missing (D1).

## Objectives

- Close every P0 and P1 finding from oracle reviews + spec annotations.
- Land R-01 happy path so the suite has a true end-to-end golden journey.
- Remove every "admin client fallback" branch in specs once the PATCH route exists, so test failures actually reflect production behaviour.
- Keep every existing passing spec passing.
- Produce regenerated evidence + audit trail.

## Wave Map

- Wave F1 — Re-verify residue (read-only audit, oracle, ~10 min)
- Wave F2 — P0 fixes (parallel, 2 fixer agents, ~30 min): A3 PATCH route + D1 R-01 spec
- Wave F3 — P1 fixes (parallel, 4 fixer agents, ~25 min): A1 PROFORMA cascade, A2 skipped AC filter, B1 globalTeardown, B2 networkidle replacement
- Wave F4 — P2 cleanups (parallel, 5 fixer agents, ~15 min): A4 reminder docs+migration, A5+A6 auth refresh, C1 enqueuePhoto exposure, C2 loadQaAccounts export, B5 README section
- Wave F5 — Negative-path coverage (1+1 fixer, ~20 min): D2 R-19 negatives + Q2 fallback cleanup
- Wave Final — Verify + audit (oracle + 1 fixer, ~15 min)

## Wave F1 — Re-verify Prior-Wave Residue

Type: Read-only audit. Single oracle agent.
Purpose: Confirm the fixes from prior waves still hold before stacking new changes.

### Items to inspect

| Item | File:line | Expected state |
|------|-----------|----------------|
| E1 | src/components/technician/complete-job-form-v2.tsx ~L113-120 | enqueuePhoto call uses EnqueuePhotoInput object shape, record.id extracted |
| E2 | src/components/technician/signature-pad.tsx | onChangeRef and onBlobChangeRef refs present, no onChange/onBlobChange in deps |
| E3 | src/app/api/technician/jobs/[id]/transition/route.ts + report/route.ts | .eq('status', order.status) on UPDATE, 23505 catch path |
| E4 | both routes above | Lead-assignment SELECT runs BEFORE idempotency replay SELECT |
| E5 | public/technician-sw.js | No urlBase64ToUint8Array function |
| E6 | src/lib/offline/sync-manager.ts ~L7 | drainQueue comment is current (not "stub") |
| E7 | src/lib/offline/sync-manager.ts newIdempotencyKey | Throws when crypto.getRandomValues unavailable; no Math.random fallback |

### Output

.omo/evidence/qa/F1-residue-audit.md — markdown table per item with PASS/FAIL/PARTIAL + file:line evidence.

### Gate

If any item FAILS, surface and pause. Do not proceed to F2 until residue is green.

## Wave F2 — P0 Fixes

### F2-A3: PATCH /api/orders/[id] route

Files:
- New: src/app/api/orders/[id]/route.ts
- New: tests/e2e/api/orders-patch.spec.ts

Body schema (Zod):
- status: enum of all 8 canonical states, optional
- assigned_technician_id: string optional nullable
- scheduled_visit_date: string optional nullable
- req_visit_date: string optional nullable
- cancellation_reason: string optional

Dispatch logic:
- status='CANCELLED' -> cancelOrder(orderId, body.cancellation_reason)
- status='ASSIGNED' && assigned_technician_id -> assignOrdersToTechnician
- status='PENDING' && scheduled_visit_date -> rescheduleOrder
- Else -> updateOrderStatus

Auth: requireAuth + RBAC. Admin/SuperAdmin: all transitions. Finance: only INVOICED/PAID.

Optimistic lock: every internal action already has .eq('status', currentStatus). If write returns 0 rows, return 409 with message "Order status changed concurrently".

Tests: cancel, assign, reschedule, race (409), invalid status (400), unauthorised role (403).

Touches: 2 new files, 0 modified.

### F2-D1: R-01 happy path spec

File: tests/e2e/qa/R01-happy-path.spec.ts

10 steps in single test body:

| Step | Actor | Action | Verify |
|------|-------|--------|--------|
| 1 | Admin (admin client) | seedOrder + insert PROFORMA via admin client | status=PENDING, 2 items, 1 PROFORMA |
| 2 | Admin (API) | PATCH /api/orders/[id] with status=ASSIGNED | status=ASSIGNED, 1 lead row |
| 3 | Tech (mobile context) | waitForRealtimeUpdate poll getJobsToday | order in list within 20s |
| 4 | Tech (API) | technicianTransition EN_ROUTE + Jakarta GPS + idempotency_key | transition row has lat/lng/key |
| 5 | Tech (API) | technicianTransition IN_PROGRESS | transition row #2 |
| 6 | Tech (API) | Upload 4 photos + 1 signature; submitReport with 2 ac_units, materials, next_service H+90 | service_reports row, ac_units.next_service_due_date=H+90, status=COMPLETED |
| 7 | Finance (admin client) | Insert FINAL invoice + update order to INVOICED | 1 FINAL invoice, status=INVOICED |
| 8 | Finance (API or admin client fallback) | Record payment 500k | 1 payment_records row, status=PAID |
| 9 | Cron (API) | POST /api/admin/reminders/run with Bearer CRON_SECRET | >=1 customer_reminders row |
| 10 | Final assertion | getFullOrderSnapshot | terminal=PAID, all rows present |

Evidence: .omo/evidence/qa/r01/step{N}.{png,json} per step.
Cleanup: test.afterAll(scenario.cleanup).
Touches: 1 new file.

### Parallelism

A3 and D1 are independent — run in parallel. R-01 step 2 uses the new PATCH route, so D1 must merge after A3 lands. Implementation tactic: D1 written assuming PATCH works, but tested against staging only after A3 is verified.

## Wave F3 — P1 Fixes

### F3-A1: cancelOrder PROFORMA cascade

File: src/lib/actions/orders.ts cancelOrder function (~L505)

Change: After updating order status to CANCELLED, find every PROFORMA invoice for the order and update its status to CANCELLED.

Pseudocode:
- query: invoices where order_id matches AND invoice_type='PROFORMA' AND status != 'CANCELLED'
- if any rows, update them all to status='CANCELLED', updated_at=now()

Tests: R-02 already covers — re-running should pass without the "finding" annotation.
Touches: 1 modified file.

### F3-A2: Skipped AC propagation filter

File: src/app/api/technician/jobs/[id]/report/route.ts ~L197-217

Change: Filter the propagation list against the report payload's ac_units array, excluding entries where skipped=true.

Pseudocode:
- build skippedAcIds Set from reportData.ac_units where skipped=true and ac_unit_id present
- propagateIds = acUnitIds.filter(id => !skippedAcIds.has(id))
- only run the next_service_due_date update on propagateIds

Tests: R-09 already covers — re-running should pass without the "finding" annotation.
Touches: 1 modified file.

### F3-B1: globalTeardown wiring

Files:
- New: tests/e2e/qa/global-teardown.ts — calls purgeAllQaData()
- Modify: playwright.config.ts — add globalTeardown path

Behaviour: Runs once after all workers finish, regardless of pass/fail/crash. Best-effort; wraps in try/catch, logs failures.

Touches: 1 new file, 1 modified file.

### F3-B2: networkidle replacement + data-testid audit

Files modified:
- tests/e2e/qa/fixtures/roles.ts loginPage function
- src/app/dashboard/dashboard-shell.tsx (add data-testid="dashboard-shell")
- src/components/technician/today-jobs-list.tsx (add data-testid="today-jobs-section")
- src/components/technician/empty-today-jobs.tsx (add data-testid="today-jobs-empty")
- Any other landed-page roots needed for finance role

Change in loginPage: replace waitForLoadState('networkidle') with role-specific selector waits. Admin/finance wait for dashboard-shell testid. Technician waits for today-jobs-section OR today-jobs-empty.

data-testid audit step: read each component first; only add data-testid props on existing DOM nodes. No logic changes.

Touches: 1 fixture + 3-4 component files modified.

## Wave F4 — P2 Cleanups

### F4-A4: Reminder rule docs + default migration

Q1=(a): ship the migration.

Files:
- Modify: docs/CRON-SETUP.md — add "Reminder rule prerequisite" section documenting that customer_reminders rows are only generated for AC units that match an active reminder_rules row. Include sample SQL for inspecting rules.
- New: migrations/015_default_reminder_rule.sql — idempotent INSERT of one default rule (name='Default same-day', days_before_due=0, active=true). Guarded with WHERE NOT EXISTS check on name.
- New: migrations/015_rollback_default_reminder_rule.sql — DELETE FROM reminder_rules WHERE name='Default same-day'.

Touches: 1 modified doc, 2 new migrations.

### F4-A5+A6: Auth-refresh mutex + drainQueue surfacing

Files:
- Modify: src/lib/offline/auth-refresh.ts
- Modify: src/lib/offline/sync-manager.ts

Auth-refresh changes:
1. Module-level `let inflight: Promise<AuthRefreshResult> | null = null`
2. refreshSession() checks inflight — if non-null, await and return its result
3. Otherwise set inflight = doRefresh(), await, clear inflight in finally, return

Sync-manager change: log auth refresh outcome in drainQueue via offlineLogger.info('drain auth', { ok, reason }).

Tests: R-12 token-expiry already exercises this path — no new test.
Touches: 2 modified files.

### F4-C1: Expose enqueuePhoto at /test/sync

Files:
- Modify: src/app/test/sync/page.tsx
- Modify: src/app/__test/sync/page.tsx (mirror, if it still exists)

Change: add import { enqueuePhoto } from '@/lib/offline/sync-manager', and inside existing window-guard blocks plus the useEffect, assign window.__enqueuePhoto = enqueuePhoto.

Tests: R-17 quota-guard now exercises the real path instead of skipping.
Touches: 1-2 modified files.

### F4-C2: Export loadQaAccounts from fixtures index

File: tests/e2e/qa/fixtures/index.ts
Change: append `export { loadQaAccounts } from './env'`.
Touches: 1 modified file (1 line).

### F4-B5: README "Setup vs SUT" section

File: tests/e2e/qa/README.md

Append a section explaining the contract between setup steps (admin-client direct writes for speed) and assertion steps (must hit real API/UI). Provide a table mapping each common step to which approach is correct. Rule of thumb: anything under test must go through the surface that production clients use.

Touches: 1 modified file.

## Wave F5 — Negative-Path Coverage + Fallback Cleanup

### F5-D2: R19-state-machine-negatives.spec.ts

File: tests/e2e/qa/R19-state-machine-negatives.spec.ts

Coverage matrix (5 cases):

| # | Actor | Setup | Attempt | Expected |
|---|-------|-------|---------|----------|
| 1 | Tech | Order at PENDING | technicianTransition -> EN_ROUTE | 422 (must be ASSIGNED first) |
| 2 | Tech | Order at IN_PROGRESS | technicianTransition -> CANCELLED | 422 (tech can't cancel) |
| 3 | Tech | Order at EN_ROUTE | technicianTransition -> COMPLETED | 422 (must be IN_PROGRESS first) |
| 4 | Admin (API PATCH) | Order at PAID (terminal) | PATCH -> CANCELLED | 422 (terminal) |
| 5 | Helper (not lead) | Order ASSIGNED with helper added | technicianTransition -> EN_ROUTE | 403 (only lead can transition) |

Evidence: .omo/evidence/qa/r19/transitions.json — per-case status + body.
Touches: 1 new file.

### F5-Q2-cleanup: Remove admin-client fallbacks

Q2=(a): remove the fallbacks once PATCH works.

Files affected (read first to confirm fallback location):
- tests/e2e/qa/R02-cancel-pending.spec.ts — remove try/catch around adminCancelOrder
- tests/e2e/qa/R04-reassign-lead.spec.ts — replace direct admin-client reassign with PATCH using status=ASSIGNED + assigned_technician_id
- tests/e2e/qa/R06-cancel-during-work.spec.ts — remove fallback admin-client cancel branch
- tests/e2e/qa/R08-partial-payment.spec.ts — keep payment fallback (no payment API exists yet); only remove if payment route lands

Pattern: find every try/catch around adminCancelOrder with admin-client fallback and replace with the bare API call. After cleanup, a future PATCH route regression will fail tests instead of silently using admin-client fallback.

Touches: 3-4 modified spec files.

## Wave Final — Verify + Audit

Three streams in parallel (oracle + fixer):

### 1. tsc + lint + playwright

- npx tsc --noEmit
- npm run lint 2>&1 | tail -50
- npx playwright test --project=qa --reporter=list (skip-clean expected without QA creds)
- npx playwright test --reporter=list (full chromium-mobile + webkit smoke)

### 2. Oracle compliance pass

- Re-read every file modified across F1-F5
- Verify each fix matches its plan entry
- Verify no new P0/P1 introduced
- Verdict: ship-ready or N findings

### 3. Regenerate .omo/evidence/qa/Q-final-verification.md

- Inventory of every spec, fixture, script
- tsc/lint/test status
- Definition of Done checklist (5 items)
- Success Criteria checklist (8 items)
- Final verdict

## Files Touched Summary

| Wave | Files modified | Files created |
|------|----------------|---------------|
| F1 | 0 | 1 evidence MD |
| F2 | 0 | 3 (PATCH route, R-01 spec, PATCH spec) |
| F3 | 5-6 (orders.ts, report/route.ts, playwright.config.ts, roles.ts, 3-4 components) | 1 (global-teardown.ts) |
| F4 | 5 (auth-refresh.ts, sync-manager.ts, test/sync/page.tsx, index.ts, README, CRON-SETUP) | 2 (default reminder rule + rollback) |
| F5 | 3-4 (R02/R04/R06/maybe R08) | 1 (R-19 spec) |
| Final | 0 | 1 evidence MD (regenerated) |

Net new files: ~8
Net modified files: ~13-15
Files deleted: 0
Breaking changes: 0 (PATCH is purely additive)

## Risk and Mitigation

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| F1 finds residue regression that blocks F2 | Low | Pause and fix before continuing — gated |
| A3 PATCH route conflicts with [id]/status route | Low | Verified additive: [id]/status is POST; new is PATCH at [id] |
| A1 PROFORMA cascade breaks invoice listing UI | Low | Existing UI already filters by status; CANCELLED rows are normal |
| A2 propagation filter breaks R-09 spec | Zero | R-09 specifically annotates this finding; fix makes R-09 pass cleanly |
| B2 networkidle replacement times out on missing testids | Medium | Audit + add testids in same wave; fallback selector includes empty-state |
| F4-A4 default reminder rule conflicts with prod | Low | Migration is idempotent + name-guarded; rollback included |
| F5 fallback cleanup masks PATCH route bug at first run | Medium | Run F2 verification before F5 cleanup — only remove fallbacks after PATCH proven working in dry-run |

## Definition of Done

- [ ] All 7 E1-E7 residue items verified PASS in F1 audit
- [ ] PATCH /api/orders/[id] route exists, accepts the schema documented above, and exercises every action path with a passing spec
- [ ] R-01 happy path spec passes against staging with QA creds present (or skips cleanly when absent)
- [ ] R-02 and R-09 no longer emit "finding" annotations
- [ ] globalTeardown purges QA-E2E-* rows on suite end
- [ ] loginAs no longer waits on networkidle
- [ ] enqueuePhoto exposed at /test/sync so R-17 stops skipping
- [ ] R-19 negative-path spec exists and passes with 5 cases
- [ ] Admin-client fallbacks removed from R-02/R-04/R-06
- [ ] tsc --noEmit clean
- [ ] npm run lint warnings-only (no errors)
- [ ] Full Playwright suite skips cleanly without QA creds; oracle compliance pass returns ship-ready
- [ ] .omo/evidence/qa/Q-final-verification.md regenerated and committed

## Open Questions Resolved

- A1, A2, A3, D2, A5+A6, B2: per recommendations
- Q1: ship reminder migration (idempotent)
- Q2: remove admin-client fallbacks once PATCH works

No outstanding questions.
