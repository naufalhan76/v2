# Learnings — auth-ui-security-improvements

## [2026-06-09] Session Start: Codebase Reconnaissance

### Existing Auth Structure
- `src/lib/auth.ts`: `getUser()` + `getUserRole()` — basic helpers, no profile/active check
- `src/lib/rbac.ts`: Has `UserRole` type, `hasAccess()`, `requireFinanceRole()`, partial RBAC helpers
- `src/middleware.ts`: Full route guard logic (cached, 30s TTL) — TECHNICIAN redirect, SUPERADMIN user mgmt gate
- `src/lib/actions/users.ts`: `createUser()` uses admin client + explicit insert + rollback pattern

### Key Patterns
- Supabase server client: `src/lib/supabase-server.ts` (via `createClient()`)
- Admin client: `src/lib/supabase-admin.ts` (via `createAdminClient()`)
- Auth routes exist: `/login`, `/confirm` — NO `/forgot-password`, NO `/reset-password` yet
- Login page already has "Lupa kata sandi?" link pointing to `/forgot-password` — page doesn't exist yet
- Role type `UserRole` already defined in `src/lib/rbac.ts`

### DB Schema
- `user_management` table: `auth_user_id`, `email`, `full_name`, `role`, `is_active`
- No invite table exists yet — Task 1 must decide: add columns or `user_invites` table (plan recommends B)

### Test Patterns
- Existing tests: `src/lib/actions/reminders.test.ts`, `src/lib/actions/ac-units.test.ts`
- Test config: `vitest.config.ts` + `src/tests/setup.ts`
- E2E: `playwright.config.ts`, project `qa`

### Conventions
- Server actions use `'use server'` pragma
- Import paths use `@/` alias
- Logger: `import { logger } from '@/lib/logger'`
- Error messages in Indonesian (user-facing), English (dev logs)
- `bun test` / `bun run type-check` / `bunx playwright test`

## [2026-06-09] Task 1: Auth/RBAC Contract Matrix COMPLETED
- Files created: `src/lib/auth-roles.ts`, `src/lib/auth-roles.test.ts`, `supabase/migrations/20260609_create_user_invites.sql`
- UserRole source of truth: `src/lib/rbac.ts` (`auth-roles.ts` re-exports the type)
- Route matrix: `/dashboard` allows SUPERADMIN/ADMIN/FINANCE, `/technician` allows TECHNICIAN, `/dashboard/manajemen/user` allows SUPERADMIN only, `/login` unauthenticated, `/` redirects by auth/role.
- Migration: `20260609_create_user_invites.sql`
- Any gotchas: `canManageUsers(role)` in `rbac.ts` still allows ADMIN for legacy checks; canonical route matrix keeps user-management route SUPERADMIN-only per middleware behavior.

## [2026-06-09] Task 2: Server Auth Guards COMPLETED
- auth-guards.ts guard API: `getCurrentUserProfile`, `requireUserProfile`, `requireRole`, `requireAnyRole`, `requireSuperAdmin`, `requireFinanceAccess`
- Server actions refactored: `src/lib/actions/api-keys.ts`, `src/lib/actions/users.ts`
- Mock pattern used: `src/lib/actions/reminders.test.ts`
- Gotchas: `bun test` resolves `server-only` before static imports, so `src/lib/auth-guards.test.ts` mocks it before dynamically importing guards.

## [2026-06-09] Task 4: Admin Invite Flow COMPLETED
- New actions: inviteUser, resendInvite, acceptInvite
- UI changes: user management page shows invite status + button
- Supabase admin API used: `auth.admin.inviteUserByEmail(email, { data: { role } })`
- Gotchas: `requireSuperAdmin` pulls `server-only` in Bun tests, so user actions now use an inline session/profile SUPERADMIN guard; pending duplicate invites route to resend.

## [2026-06-09] Task 3: Forgot/Reset Password COMPLETED
- Routes created: /forgot-password, /reset-password
- Token handling: Handled automatically by Supabase's `getSession` and hash URL on initial load for the reset-password page.
- Middleware update: Added `/forgot-password` and `/reset-password` to `authRoutes` to ensure authenticated users are redirected away.
- Gotchas: Vitest is used instead of bun:test for DOM testing due to happy-dom config.

## [2026-06-09] Task 4: Admin Invite Flow COMPLETED
- New actions: inviteUser, resendInvite, acceptInvite
- UI: user management page shows invite status + Undang button
- Supabase admin API: inviteUserByEmail
- Gotchas: SUPERADMIN authorization must happen with anon createClient before admin client usage; duplicate pending invites should resend/update last_sent_at, not create a second pending row because the DB has a partial unique index.

## [2026-06-09] Task 2: Server Auth Guards COMPLETED
- auth-guards.ts: getCurrentUserProfile, requireUserProfile, requireRole, requireAnyRole, requireSuperAdmin, requireFinanceAccess
- server-only import: YES
- api-keys.ts refactored: YES
- Mock pattern: vi.mock('@/lib/supabase-server', ...)
- Gotchas: api-keys.ts was already partially refactored; getUserApiKeys now also uses requireSuperAdmin().

## [2026-06-09] Task 5: Middleware Hardening COMPLETED
- Matrix used in middleware: YES
- Test cases: 9 tests added
- API middleware: Reviewed; API guards use explicit requiredRoles/finance role arrays matching the same SUPERADMIN/ADMIN/FINANCE decisions, while route-only redirects remain in ROUTE_ROLE_MATRIX.
- Gotchas: Middleware must keep @supabase/ssr createServerClient and avoid auth-guards.ts because auth-guards imports server-only.

## [2026-06-09] Task 7: Auth UX Polish COMPLETED
- Pages updated: login, forgot-password, reset-password, confirm, auth-guards, auth-roles
- Neutral copy verified: forgot-password [YES]
- Invalid token handling: reset-password [YES], confirm [YES]
- Screenshots captured: .omo/evidence/task-7-auth-error-states.png, .omo/evidence/task-7-forgot-copy.png
- Gotchas: Supabase reset password automatically sets session on hash load, but throws an error if token has expired or `updateUser` is called incorrectly. Handled with explicit Indonesian error string.
## [2026-06-09] Task 6: Auth Regression Suite COMPLETED
- Unit tests passing: auth-roles [4], auth-guards [6], users [5], middleware [9]
- Playwright smoke: [SKIP 3 - NEXT_PUBLIC_SUPABASE_URL not configured]
- Test data names: admin@example.com, tech@example.com, invitee@example.com (deterministic)
- Gotchas: `qa` project needed `testMatch` coverage for explicit `tests/e2e/auth-smoke.spec.ts` because its testDir was scoped to `tests/e2e/qa`.
