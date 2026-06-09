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

## [2026-06-09] Task 3: Forgot/Reset Password COMPLETED
- Routes created: /forgot-password, /reset-password
- Token handling: Handled automatically by Supabase's `getSession` and hash URL on initial load for the reset-password page.
- Middleware update: Added `/forgot-password` and `/reset-password` to `authRoutes` to ensure authenticated users are redirected away.
- Gotchas: Vitest is used instead of bun:test for DOM testing due to happy-dom config.
