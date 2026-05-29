# QA E2E Test Suite

End-to-end test suite covering the full order lifecycle from CREATE to PAID,
with 18 field scenarios + cross-cutting invariants audit.

## Overview

This suite exercises:
- Full happy path (R-01): PENDING → ASSIGNED → EN_ROUTE → IN_PROGRESS → COMPLETED → INVOICED → PAID
- Field scenarios (R-02 ... R-15): cancel, reschedule, reassign, helpers, offline, partial payment, multi-AC edge cases
- Performance + edge (R-16 ... R-18): 5-AC load, quota guard, iOS Safari fallback
- Cross-cutting invariants (R-cross): DB integrity audit across all QA-E2E-* orders

Every spec uses the `qaTest` fixture which auto-skips if QA credentials are
missing — running the suite without seeding accounts will produce a clean
"all skipped" result rather than failures.

## Prerequisites

The suite runs against the **staging** Supabase instance. Required env vars
in `.env.test.local` (or `.env.staging`):

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET` (only needed for R-14 reminder generation)

WARNING: this suite seeds and deletes data on the configured Supabase
project. Never point it at production. All seeded rows carry the
`QA-E2E-{scenarioId}-{ts}-{rand}` prefix and are purged via
`afterAll(scenario.cleanup)`.

## Setup

```bash
# 1. Copy .env.staging values into .env.test.local
cp .env.staging .env.test.local

# 2. Seed the four test accounts (admin, finance, 2 technicians)
npm run qa:seed
# This creates auth users, user_management rows, technicians rows,
# and writes QA_*_EMAIL / QA_*_PASSWORD into .env.test.local.

# 3. Verify the credentials block exists
grep ^QA_ .env.test.local
```

## Running

```bash
# Full suite (10 workers, parallel)
npm run test:qa

# Just the happy path
npm run test:qa:happy

# Cleanup any orphaned QA-E2E-* rows between runs
npm run test:qa:cleanup
```

## Scenarios

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

## Data Isolation

Every scenario seeds with prefix `QA-E2E-{scenarioId}-{timestamp}-{rand}`.

- Customer IDs: `CUST-QA-E2E-...`
- Location IDs: `LOC-QA-E2E-...`
- AC unit IDs: `AC-QA-E2E-...`
- Order IDs: `ORD-QA-E2E-...`

`afterAll` calls `scenario.cleanup()` which cascades through all related
tables. The orphan-safety net is `npm run test:qa:cleanup` which purges
every QA-E2E-* row in the database.

## Evidence

Each spec writes to `.omo/evidence/qa/{scenarioId}/`:
- `result.json` or per-step JSON snapshots
- screenshots at key UI states
- timing data where relevant

These are gitignored — regenerate by running the suite.

## Troubleshooting

**Tests all skip** — Run `npm run qa:seed` and verify QA_*_EMAIL block
exists in `.env.test.local`. Confirm `NEXT_PUBLIC_SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` are set.

**R-14 always skips** — Set `CRON_SECRET` in `.env.test.local`.

**FK violation on cleanup** — `npm run test:qa:cleanup` between runs.

**ESM / TS error on seed script** — Run with `npx tsx scripts/seed-qa-accounts.ts`.

## Architecture

```
tests/e2e/qa/
├── fixtures/
│   ├── env.ts          # supabase admin + dotenv loader
│   ├── types.ts        # SeedScenario, FullOrderSnapshot, etc.
│   ├── roles.ts        # qaTest fixture, loginAs(context, role)
│   ├── seeders.ts      # seedFullScenario, seedOrder, assignLeadTechnician
│   ├── cleanup.ts      # purgeByPrefix, purgeAllQaData (FK-cascade order)
│   ├── db-asserts.ts   # getFullOrderSnapshot, getOrderStatus, getReminderCount
│   ├── api-helpers.ts  # technicianTransition, adminCancelOrder, etc.
│   ├── realtime.ts     # openDualContexts, waitForRealtimeUpdate
│   ├── synth.ts        # synthJpegBlob, synthSignaturePng
│   └── index.ts        # barrel re-exports
└── R0X-*.spec.ts       # 18 + cross-audit specs
```

`qaTest` extends Playwright's base `test` with a `qaAccounts` fixture that
skips if creds are missing — so individual specs don't have to repeat the
guard logic.

## Setup vs SUT (System Under Test)

To keep specs honest, distinguish between setup steps (admin-client direct
writes for speed) and assertion steps (must hit real API/UI).

| Step | Approach |
|------|----------|
| Create customer/location/AC | admin client only |
| Create order (precondition) | admin client only |
| Assign tech (precondition) | admin client only |
| Assign tech (testing assignment) | API only via `adminAssignOrder` |
| Transition (testing transitions) | API only via `technicianTransition` |
| Cancel order (testing cancellation cascade) | API only via `adminCancelOrder` |
| Submit report (testing report logic) | API only via `technicianSubmitReport` |
| Record payment (testing payment side effects) | API only via `POST /api/invoices/.../payments` |

Rule of thumb: anything under test must go through the surface that production clients use.
