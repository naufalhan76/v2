# Issues

## [2026-05-31] Wave 0 Task 1 — Baseline run: RED (28/32 failed)
- **Root cause**: All 28 failing tests time out at `roles.ts:26` (`loginPage()`). Login succeeds (URL transitions), but the dashboard page after login does not contain any of the four expected testid selectors: `[data-testid="dashboard-shell"]`, `[data-testid="today-jobs-section"]`, `[data-testid="today-jobs-empty"]`, `[data-testid="technician-home"]`.
- **2 passed**: DB-only operations (seedFullScenario, getFullOrderSnapshot) — confirms staging DB connectivity works.
- **2 skipped**: R14 (CRON_SECRET missing), R-cross (no QA-E2E- orders to audit since all order-creating specs failed).
- **Safety**: All config/env checks pass. SUPERADMIN exists. .env.test.local is gitignored. Staging host is explicit.
- **Impact on Wave 0 Task 2**: Fixture extension must account for systemic UI-testid mismatch. Recommend adding diagnostic helpers that dump actual page HTML when expected testids are absent.

## [2026-05-30] Session start
- No issues yet.
