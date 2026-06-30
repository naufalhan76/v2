# Development Guide

This file provides development guidelines and conventions for this project.

## Commands

```bash
bun run dev          # Start dev server
bun run build        # Production build
bun run lint         # ESLint check
bun run lint:fix     # ESLint auto-fix
bun run type-check   # TypeScript check (no emit)
```

Vitest is configured (100 test files). Run: `bunx vitest run`

## Stack

- **Next.js 15** App Router + React 19 + TypeScript 5
- **Supabase** — PostgreSQL + Realtime | **Clerk** — Authentication
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

- Clerk auth; server-side via `auth()` from `@clerk/nextjs/server` (returns `{ userId }`)
- API routes via `getAuth(request)` from `@clerk/nextjs/server` in `src/app/api/middleware/auth.ts`
- 4 roles: `SUPERADMIN > ADMIN > TECHNICIAN / FINANCE`
- Role resolved by querying `user_management` table using Clerk `userId`
- RBAC helpers in `src/lib/rbac.ts`: `isSuperAdmin()`, `isAdmin()`, `isFinance()` (includes SUPERADMIN), `hasAccess()`, etc.
- `createClient()` in `src/lib/supabase-server.ts` uses service role key (RLS dropped); `createAdminClient()` in `src/lib/supabase-admin.ts` also available

### API Response Shape

All API routes return:
```typescript
{ success: boolean; data?: T; error?: string; message?: string; pagination?: { total, page, limit, totalPages } }
```
Use data-shape helpers from `src/app/api/utils.ts` (`successResponse`, `errorResponse`) and HTTP-response helpers (`jsonSuccess`, `jsonError`, `handleApiError`, `unauthorizedResponse`, `forbiddenResponse`, `notFoundResponse`).

### Realtime

Supabase Postgres Change subscriptions in `src/lib/realtime.ts` — channels for orders, payments, service records, pricing, SLA. On change, they call `queryClient.invalidateQueries()` to refresh TanStack Query cache.

### Order Workflow

Orders follow a strict state machine (8 canonical states):
`PENDING → ASSIGNED → EN_ROUTE → IN_PROGRESS → COMPLETED → INVOICED → PAID`
Plus `CANCELLED` (terminal). Reschedule is an action that resets to PENDING. Reassign replaces lead while in ASSIGNED. Transitions enforced in split server action files: `src/lib/actions/orders-mutations-status.ts`, `orders-mutations-assign.ts`, `orders-mutations-schedule.ts`, `orders-mutations-cancel.ts`. Status mapper at `src/lib/order-status.ts` is the single source of truth (handles legacy DB values via `toCanonical()`).

### Push Notifications

Web push for technicians via VAPID. Browser helpers in `src/lib/push.ts`, server sender in `src/lib/server/push-sender.ts`. Triggered fire-and-forget from `assignOrdersToTechnician` in `src/lib/actions/orders-mutations-assign.ts` and `rescheduleOrder` in `src/lib/actions/orders-mutations-schedule.ts`. Subscription state managed in `/technician/profile`. Service worker at `public/technician-sw.js` handles push, notificationclick, and pushsubscriptionchange events.

### Service Reminders

Configurable reminder rules in `reminder_rules` table; queue in `customer_reminders`. Generated from `ac_units.next_service_due_date` via functions in `src/lib/actions/reminders-queue.ts`. Rules CRUD in `src/lib/actions/reminders-rules.ts`. Admin UI at `/dashboard/reminders`. Rules CRUD at `/dashboard/settings/reminder-rules`. Cron entrypoint: `POST /api/admin/reminders/run` (Bearer `CRON_SECRET` or admin session — see `docs/CRON-SETUP.md`). Technicians input next-service date in the Complete Job Form; system auto-updates `ac_units.next_service_due_date` on report submission.

### Proforma Invoices

Optional checkbox in Create Order form (`/dashboard/orders/new`). When checked, creates a proforma invoice (`invoice_type='PROFORMA'`, `status='DRAFT'`) automatically using estimated prices from order items. See `createProformaInvoice` in `src/lib/actions/invoices-create.ts`. The final invoice (`invoice_type='FINAL'`) is still generated post-completion via `createInvoiceFromOrder` in `src/lib/actions/invoices-order.ts` using actual reported prices. Invoice listing in `src/lib/actions/invoices-listing.ts`, payments in `src/lib/actions/invoices-payments.ts`.

### Logging

`src/lib/logger.ts` — scoped logger. `debug`/`info` stripped in production via `next.config.js`. Use `warn`/`error` for anything that must appear in prod.

## Address pinpoint maps

This application uses Leaflet for customer address pinpointing.

Environment variables:
- `NEXT_PUBLIC_NOMINATIM_BASE_URL`: Base URL for OpenStreetMap Nominatim geocoding service. Default: `https://nominatim.openstreetmap.org`.
- `NEXT_PUBLIC_OSM_TILE_URL`: URL for OpenStreetMap tiles. Default: `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`.

If using a custom tile/geocoding provider (e.g., Mapbox, Maptiler), ensure these variables are updated accordingly in your `.env`.

## Key Conventions

- Path alias `@/*` maps to `src/*`
- Soft deletes — records are never hard-deleted
- Zod schemas for all API inputs live in `src/app/api/schemas/`
- Error handling: duck-type errors as `(error as { message?: string })?.message || 'fallback'` instead of `instanceof Error`
- Auth guard pattern: `const { userId } = await auth(); if (!userId) return { success: false, error: '...' }`
- shadcn components live in `src/components/ui/` — add new ones via `bunx shadcn@latest add <component>`
- Dashboard pages are under `src/app/dashboard/`. Primary route: `orders/` (replaces `operasional/*` for order lifecycle). Other groups: `manajemen/` (customer, teknisi), `keuangan/` (invoices), `settings/` (service-catalog), `admin/`. Legacy `operasional/`, `konfigurasi/`, and `manajemen/lokasi`, `manajemen/ac-units` remain accessible via direct URL until Phase 5 cleanup.
- Order workflow primarily lives at `/dashboard/orders` with `?view=board` (Kanban) or `?view=list` (table). State machine transitions enforced server-side in `src/lib/actions/orders.ts`. Optimistic mutations via hooks in `src/hooks/use-order-mutation.ts`.

## Agent skills

### Issue tracker

GitHub Issues on `naufalhan76/webpanel`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix). See `docs/agents/triage-labels.md`.

### Domain docs

Multi-context layout with CONTEXT-MAP.md at root. See `docs/agents/domain.md`.
