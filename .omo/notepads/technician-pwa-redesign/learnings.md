# Learnings — Technician PWA Redesign

## Project Conventions
- Next.js 15 App Router, React 19, TypeScript, Tailwind CSS, shadcn/ui
- Testing: Vitest (unit) + Playwright (E2E)
- Package manager: Bun
- Offline: IndexedDB queue + service worker bridge
- State: TanStack Query v5
- Forms: React Hook Form + Zod
- Icons: Lucide (NOT Material Symbols)
- Font: Lexend (new for technician)
- Primary color: Indigo Navy #211c59
- Technician theme preference uses localStorage key `msn-tech-theme` with values `light`, `dark`, or `system`; `dark` class is applied on `<html>`.
- Technician design tokens are scoped with `.technician` CSS variables and dark overrides via `.dark .technician` / `.technician.dark`.
- `/technician` routes load Lexend through `next/font` in `src/app/technician/layout.tsx`, leaving admin body font unchanged.
- 2026-06-12: Technician theme infrastructure lives in `src/hooks/use-technician-theme.ts`; it defaults invalid/missing preferences to `system`, persists every selected mode to `msn-tech-theme`, resolves system mode through `(prefers-color-scheme: dark)`, and includes an inline script for pre-hydration `<html class="dark">` sync.
- Tailwind exposes technician font utilities as `font-heading` and `font-body`, both backed by Lexend with the default sans fallback stack.
- 2026-06-12: Technician RGB CSS variables are defined in `:root` and `.technician`; `.dark` plus `.dark .technician`/`.technician.dark` override background, card, text, and secondary text values.
- 2026-06-12: Backend transition IN_PROGRESS now requires GPS only; `arrival_photos` is optional and may be omitted or empty.
- 2026-06-12: Technician theme infrastructure exports `TechTheme` (`light`/`dark`/`system`), persists preference under `msn-tech-theme`, applies `.dark` on `<html>`, and uses an inline technician theme script in `/technician` layout to avoid initial wrong-theme flash.

## Timer Persistence Module
- Persistent technician work timer uses localStorage key `msn-tech-active-timer`; stores only `{ orderId, work_started_at }` for active timer state and computes elapsed/duration from timestamps.
- `hasAnyActiveTimer()` enforces confirmed one-active-job limit before another job start; `clearTimer(orderId)` removes matching active timer after successful submit.


## Characterization Test Findings — Task 1
- `JobCompletionWizard` persists drafts in `localStorage` under `msn-erp-wizard-draft-${orderId}` and saves `customerNameSigned`, notes, next-service fields, `workStartedAt`, `acUnits`, and `currentStep` after draft hydration.
- Wizard step 1 requires exact AC unit count and before/after photos for serviced units; existing complete AC identity fields are accepted from initial job context.
- Wizard step 2 requires signer name plus a `SignaturePad` blob; submit enqueues signature as `kind: "signature"`, strips per-AC preview photo arrays from payload, flattens materials, calculates `actual_total_price`, and removes draft after `enqueueReport` succeeds.
- `sync-manager` treats 200/idempotent as success and deletes synced queue records; 422/403 report responses are permanent failures that delete reports; 5xx responses retry with attempt-count backoff `[0, 1000, 5000, 30000, 120000, 600000]`.
- Report sync uploads photo blobs before POST, patches signature URL into `customer_signature_url`, patches AC before/after URLs into `ac_units[]`, then `cleanupAfterSync` deletes reports, transitions, and photos for that order on success.
- `JobDetailContent` transitions ASSIGNED via direct `EN_ROUTE` POST; EN_ROUTE opens required arrival-photo modal before `IN_PROGRESS`; IN_PROGRESS locks snapshot then routes to `/technician/job/${orderId}/complete`.

## Characterization Test Verification — 2026-06-12
- Added ignored-but-force-committed characterization tests for wizard, sync manager, and job detail surfaces because repo `.gitignore` excludes `src/**/*.test.ts(x)` and `.omo/` by default.
- Targeted characterization commands pass individually: wizard `4/4`, sync manager `8/8`, job detail `3/3`.
- Full `bun run test --run` still has unrelated pre-existing failures in dashboard/UI/invoice/auth guard tests, including `bun:test` import bundling in `src/lib/auth-guards.test.ts` and stale class-token assertions expecting old amber/emerald/red Tailwind classes.
- 2026-06-12 characterization test verification: separate test files now pin wizard navigation/validation/draft/submit payload, sync 200/422/403/5xx/photo/backoff behavior, and job detail ASSIGNED→EN_ROUTE→IN_PROGRESS plus arrival-photo modal behavior.
- 2026-06-12: Technician transition route keeps GPS required for IN_PROGRESS while accepting omitted or empty `arrival_photos`.
- 2026-06-12 Task 5: `src/lib/offline/timer.ts` keeps one active technician timer in localStorage, returns rounded duration via `computeWorkDurationMinutes()`, and `stopTimer()` removes active state after returning completion metadata.
- 2026-06-12 Task 5: `src/lib/offline/timer.ts` is localStorage-only, intentionally not IndexedDB; `stopTimer()` removes active state after returning `{ work_completed_at, durationMinutes }` so next job can start.
- Task 7: Redesigned `BottomTabBar` to pill-shape, updated icons (CalendarDays, Clock, User), and applied design system tokens.

## UI Redesign Findings — 2026-06-12
- Technician redesign requires converting skeletons to new design language to prevent layout shifts.
- Skeletons updated with new visual tokens: indigo shimmer (`bg-indigo-50 dark:bg-gray-700`), high border radii (`rounded-[32px]`), and layout parity with new dashboard components (curved header `rounded-b-[40px]`, stat cards).
- Created `history-skeleton.tsx` corresponding to updated history view with `rounded-b-[80px]` headers.


### Swipe-to-Action Redesign (Task 10)
- Redesigned `SwipeToAction` component according to ui-style-reference.md
- Used tech-primary (`#211c59`) for the track, white thumb with ChevronRight
- Updated props: `onComplete`, `label`, `disabled`, `loading`
- Switched to native pointer events (`setPointerCapture`, `releasePointerCapture`) for smooth dragging
- Added touch-action handling (`touch-pan-y` on container, `touch-none` on thumb) to prevent vertical scroll conflict while dragging
- Added vibration feedback on complete
- Fixed React testing library mock for `setPointerCapture` in Vitest environment
- Tests cover full swipe past threshold and early release scenarios

## Sync Manager Data Preservation — 2026-06-12
- Task 6 changes report sync failure handling: 422 keeps pending report with `status: "needs-attention"`; 403 keeps pending report with `status: "auth-error"`; neither path deletes the IndexedDB report.
- `drainQueue({ bypassBackoff: true })` is the manual-sync path and skips retry backoff; normal drain keeps existing backoff behavior.
- `enqueueReport()` still requests Background Sync, and when `navigator.onLine` is true it immediately drains the queue with backoff bypass so online submissions are sent without waiting for the service worker.
- `DrainResult.errors` now carries optional `status` for report attention/auth errors, and `useOnlineSync()` exposes `errors` plus `needsAttention` for `SyncStatus`.
