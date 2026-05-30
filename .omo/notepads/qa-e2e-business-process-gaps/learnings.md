# Learnings

## [2026-05-31] Task 2 complete — gap-helpers.ts
- File: tests/e2e/qa/fixtures/gap-helpers.ts (328 lines, barrel-exported via index.ts)
- Functions: seedOrderToState, assertStagingHost, superAdminAccountOrSkip, resendKeyAbsentOrSkip, scenarioPrefix
- Type-check: PASS (tsc --noEmit clean)
- Verification: assertStagingHost + scenarioPrefix pass (2/2) ✓
- seedOrderToState skipped — loginAs testid mismatch (known baseline issue)
  - API call flow is correct; will exercise fully once testid issue resolved (Task 1 follow-up)
  - Fallback: DB-insert path (service_reports + order_status_transitions) ready for RPC-missing staging
  - `technician_submit_report_v2` RPC gap confirmed — function handles via try/catch → direct DB fallback
- Storage buckets (service-photos, signatures): configured via bootstrap-staging.mjs; fixtures use placeholder URLs for seed data; specs that need real uploads use synth helpers + supabase storage API
- No existing fixture signatures modified; no app source code changed

## [2026-05-31] Task 5 complete — G03 master-data CRUD spec
- File: tests/e2e/qa/G03-master-data-crud.spec.ts (365 lines)
- Scenarios: 4 serial tests — customer CRUD, location CRUD, AC unit CRUD, AC-add blocked without location
- Fixtures: qaTest, loginAs('admin'), assertStagingHost, scenarioPrefix, getSupabaseAdmin
- Evidence: .omo/evidence/qa/G03/{customer-crud,location-crud,ac-crud,ac-needs-location}.json + 8 screenshots
- Cleanup: afterAll deletes tracked rows (AC → location → customer) + residual sanity check
- Finding: Customer/location/AC DELETE all perform hard delete; no deleted_at column on customers/locations/ac_units tables. Documented via testInfo.annotation.
- Type-check: PASS; ESLint: PASS

## [2026-05-31] Task 3 complete — G01 order-create UI spec
- File: tests/e2e/qa/G01-order-create-ui.spec.ts (316 lines)
- Scenarios: 3 serial tests — happy path (order via UI → redirect → DB PENDING), negative no-AC, negative no-service-type
- Fixtures: qaTest serial, seedFullScenario (admin client), loginAs(context,'admin'), assertStagingHost, scenarioPrefix, getSupabaseAdmin, getOrderStatus
- Evidence: .omo/evidence/qa/G01/{happy,negative-no-ac,negative-no-service-type}.json + 3 screenshots
- Catalog price autofill: asserts estimasi-harga input === catalog base_price for unit_type+capacity+service_type match
- Cleanup: afterAll scenario.cleanup() (not bare purgeByPrefix)
- Fixes applied: _seededServiceTypeId unused-var prefix; scenario.cleanup() instead of purgeByPrefix()
- Type-check: PASS; ESLint: PASS
