# Learnings — technician-pwa-ui-fresh-replan

## [2026-06-11] Init
- Plan has 9 tasks + F1-F4 final wave
- 22 dirty files from AC completion contract work (uncommitted)
- Critical path: 1 → 2 → 3/4 → 5/6/7 → 8/9 → Final
- Wave 1: Task 1 (no deps), Task 2 (deps: 1) — sequential
- Wave 2: Tasks 3 + 4 in parallel (both dep on 1,2)
- Wave 3: Tasks 5 + 6 + 7 — 5 and 6 dep on 3+4; 7 dep on 2+5 (mostly sequential)
- Wave 4: Task 8 (dep 4,5,6) then Task 9 (dep 6,7,8)
- test files: src/**/*.test.ts and src/**/*.test.tsx are gitignored per .gitignore

## [2026-06-11] Task 1 route/offline guardrails
- Route wiring proof: `grep -r "CompleteJobForm\|JobCompletionWizard" src/app/technician/ --include="*.tsx" --include="*.ts" -l` returns only `src/app/technician/job/[...id]/page.tsx`.
- Legacy form proof: `grep -r "CompleteJobForm" src/app/technician/ --include="*.tsx" --include="*.ts"` returns empty output; legacy completion form is not route-wired under technician app routes.
- Complete route wiring: `src/app/technician/job/[...id]/page.tsx` imports `JobCompletionWizard` and renders `<JobCompletionWizard orderId={id} />` when last catchall segment is `complete`; non-complete path renders `JobDetailContent`.
- Offline modules inventory: `auth-refresh.ts`, `db.ts`, `logger.ts`, `sync-manager.ts`, `test-helpers.ts`.
- Current IndexedDB stores in `src/lib/offline/db.ts`: `drafts`, `pendingPhotos`, `pendingReports`, `pendingTransitions`, `conflicts`.
- Current stored shapes: `DraftRecord`, `PendingPhotoRecord`, `PendingReportRecord`, `PendingTransitionRecord`, `ConflictRecord`.
- `LocalJobSnapshot` is not currently defined as a type or IndexedDB store in `src/lib/offline/db.ts`; existing `drafts` store keeps opaque `{ orderId, formState, updatedAt }` only.
- No E2E scope proof: `git diff --name-only | grep '^tests/e2e/'` returns empty output; no `tests/e2e/**` files changed/created.


## [2026-06-11] Task 2 TDD RED Baseline
- Setup RED baseline tests for the PWA offline workflow in `src/app/technician/__tests__/offline-workflow.test.tsx`.
- Tests verify: `LocalJobSnapshot` prop acceptance by wizard, timer disabled until prechecks pass, and nearest-minute duration calculation. All tests use `it.fails` to represent expected failures before implementation.
- Extended `src/app/technician/__tests__/visual-contract.test.tsx` with new assertions for wizard step indicators and rounded-full status pills.
- Captured test execution outputs (all expected failures correctly identified by Vitest) to `.omo/evidence/technician-pwa-offline-task-2-red.txt` and `.omo/evidence/technician-pwa-offline-task-2-visual.txt`.
- Confirmed no `tests/e2e/**` files created or modified. 

## [2026-06-12] Task 4 offline snapshot fallback
- `src/lib/offline/snapshot.ts` already contained `saveJobSnapshot`, `getJobSnapshot`, and `lockJobSnapshot`; added `src/lib/offline/snapshot.test.ts` to lock save/read/lock behavior and lock preservation on refreshed snapshots.
- `JobCompletionWizard` now accepts an optional `LocalJobSnapshot` prop and maps it into the same job context shape used by the online fetch path, so cached snapshots can mount the completion wizard without network data.
- If the wizard cannot fetch network data and `getJobSnapshot(orderId)` returns nothing, it renders `Tidak ada data offline untuk job ini` with a `Coba Lagi` retry button instead of silently showing an empty wizard.
- Evidence captured: `.omo/evidence/technician-pwa-offline-task-4-snapshot.txt`, `.omo/evidence/technician-pwa-offline-task-4-ac-contract.txt`, `.omo/evidence/technician-pwa-offline-task-4-type-check.txt`.

## [2026-06-12] Task 5 offline-first wizard
- `JobCompletionWizard` now reads `snapshot` prop or `getJobSnapshot(orderId)` before network, renders the cached job immediately, then hydrates server data in a background tick.
- Background hydrate updates job context only; restored draft fields and `acUnits` are protected by `hasRestoredRef`, so local draft survives fresh server data.
- Draft persistence is immediate after state/step changes but gated by `draftReady`, preventing initial empty state from overwriting saved drafts before restore.
- Evidence captured: `.omo/evidence/technician-pwa-offline-task-5-offline-mount.txt` and `.omo/evidence/technician-pwa-offline-task-5-draft.txt`; required type-check command exited 0.
