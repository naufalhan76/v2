# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run lint         # ESLint check
npm run lint:fix     # ESLint auto-fix
npm run type-check   # TypeScript check (no emit)
```

No test framework is configured.

## Stack

- **Next.js 15** App Router + React 19 + TypeScript 5
- **Supabase** — PostgreSQL + Auth + Realtime (Row-Level Security enabled)
- **TanStack Query v5** — server state, 1-min stale time, no refetch on focus
- **TanStack Table v8** — data tables
- **React Hook Form + Zod** — forms and validation
- **shadcn/ui** (New York style, zinc base) + Tailwind CSS 3.3
- **Recharts** — charts/KPIs
- **Resend** — email; **jsPDF + html2canvas** — PDF export

## Architecture

### Data Flow

Two parallel patterns coexist — **Server Actions** (`src/lib/actions/`) for most mutations and reads, and **REST API routes** (`src/app/api/`) for external/mobile clients. Pages use TanStack Query wrapping server actions for caching and invalidation.

### Auth & RBAC

- Supabase JWT auth; server-side via `verifyAuth()` in `src/app/api/middleware/auth.ts`
- 4 roles: `SUPERADMIN > ADMIN > TECHNICIAN / FINANCE`
- RBAC helpers in `src/lib/rbac.ts`: `isSuperAdmin()`, `isAdmin()`, `hasAccess()`, etc.
- `createClient()` in `src/lib/supabase-server.ts` respects RLS; `createAdminClient()` in `src/lib/supabase-admin.ts` bypasses it — use admin client only when intentional

### API Response Shape

All API routes return:
```typescript
{ success: boolean; data?: T; error?: string; message?: string; pagination?: { total, page, limit, totalPages } }
```
Use helpers from `src/app/api/utils.ts` (`successResponse`, `errorResponse`, `paginatedResponse`).

### Realtime

Supabase Postgres Change subscriptions in `src/lib/realtime.ts` — channels for orders, payments, service records, pricing, SLA. On change, they call `queryClient.invalidateQueries()` to refresh TanStack Query cache.

### Order Workflow

Orders follow a strict state machine (8 canonical states):
`PENDING → ASSIGNED → EN_ROUTE → IN_PROGRESS → COMPLETED → INVOICED → PAID`
Plus `CANCELLED` (terminal). Reschedule is an action that resets to PENDING. Reassign replaces lead while in ASSIGNED. Transitions enforced in `src/lib/actions/orders.ts`. Status mapper at `src/lib/order-status.ts` is the single source of truth (handles legacy DB values via `toCanonical()`).

### Push Notifications

Web push for technicians via VAPID. Browser helpers in `src/lib/push.ts`, server sender in `src/lib/server/push-sender.ts`. Triggered fire-and-forget from `assignOrdersToTechnician` and `rescheduleOrder` in `src/lib/actions/orders.ts`. Subscription state managed in `/technician/profile`. Service worker at `public/technician-sw.js` handles push, notificationclick, and pushsubscriptionchange events.

### Logging

`src/lib/logger.ts` — scoped logger. `debug`/`info` stripped in production via `next.config.js`. Use `warn`/`error` for anything that must appear in prod.

## Key Conventions

- Path alias `@/*` maps to `src/*`
- Soft deletes — records are never hard-deleted
- Zod schemas for all API inputs live in `src/app/api/schemas/`
- shadcn components live in `src/components/ui/` — add new ones via `npx shadcn@latest add <component>`
- Dashboard pages are under `src/app/dashboard/`. Primary route: `orders/` (replaces `operasional/*` for order lifecycle). Other groups: `manajemen/` (customer, teknisi), `keuangan/` (invoices), `settings/` (service-catalog), `admin/`. Legacy `operasional/`, `konfigurasi/`, and `manajemen/lokasi`, `manajemen/ac-units` remain accessible via direct URL until Phase 5 cleanup.
- Order workflow primarily lives at `/dashboard/orders` with `?view=board` (Kanban) or `?view=list` (table). State machine transitions enforced server-side in `src/lib/actions/orders.ts`. Optimistic mutations via hooks in `src/hooks/use-order-mutation.ts`.

## Agent skills

### Issue tracker

GitHub Issues on `naufalhan76/webpanel`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix). See `docs/agents/triage-labels.md`.

### Domain docs

Multi-context layout with CONTEXT-MAP.md at root. See `docs/agents/domain.md`.
