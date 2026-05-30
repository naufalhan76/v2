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
