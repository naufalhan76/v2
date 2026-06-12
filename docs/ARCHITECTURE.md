# Arsitektur Teknis — MSN ERP

> **Technical Architecture Document**
> Versi: 1.2 | Tanggal: 2026-06-13

---

## Daftar Isi

1. [System Overview](#1-system-overview)
2. [Stack Decisions](#2-stack-decisions)
3. [Project Structure](#3-project-structure)
4. [Auth & Authorization Flow](#4-auth--authorization-flow)
5. [Order State Machine](#5-order-state-machine)
6. [Data Flow Patterns](#6-data-flow-patterns)
7. [API Design](#7-api-design)
8. [Component Architecture](#8-component-architecture)
9. [Offline Architecture](#9-offline-architecture)
10. [Database Schema](#10-database-schema)
11. [Real-time Subscriptions](#11-real-time-subscriptions)
12. [Deployment](#12-deployment)

---

## 1. System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      DNS / CDN (Vercel Edge)                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────┐       ┌──────────────────────────┐    │
│  │   Admin Dashboard    │       │   Technician PWA         │    │
│  │   (Next.js SSR)      │       │   (Next.js + SW)         │    │
│  │   /dashboard/*       │       │   /technician/*          │    │
│  └──────────┬───────────┘       └──────────┬───────────────┘    │
│             │                              │                     │
│             │      ┌─────────────────┐      │                     │
│             └──────│   Next.js API   │──────┘                     │
│                    │   Route Handlers│                            │
│                    │   /api/*        │                            │
│                    └────────┬────────┘                            │
│                             │                                     │
│       ┌─────────────────────┼─────────────────────┐               │
│       │                     │                     │               │
│       ▼                     ▼                     ▼               │
│  ┌──────────┐       ┌──────────────┐      ┌─────────────┐        │
│  │ Supabase │       │  Supabase    │      │  Resend     │        │
│  │ Auth     │       │  Postgres    │      │  (Email)    │        │
│  │ (JWT)    │       │  + RLS       │      └─────────────┘        │
│  └──────────┘       │  + Realtime  │                             │
│                     └──────────────┘                             │
│                            │                                     │
│                     ┌──────┴──────┐                              │
│                     │  Supabase   │                              │
│                     │  Storage    │                              │
│                     │ (foto, ttd) │                              │
│                     └─────────────┘                              │
│                                                                  │
│  External:                                                        │
│  ┌──────────────┐    ┌───────────────────────┐                   │
│  │ Cron Job     │───▶│ POST /api/admin/       │                   │
│  │ (GitHub/etc) │    │   reminders/run       │                   │
│  └──────────────┘    └───────────────────────┘                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Arsitektur Inti

MSN ERP menggunakan **Next.js 15 App Router** dengan **dual rendering strategy**:
- **Server Components (RSC)** untuk halaman dashboard (SSR/SSG)
- **Client Components** untuk interaktivitas (Kanban, form, chart)
- **Server Actions** (`'use server'`) untuk mutations
- **Route Handlers** (`route.ts`) untuk REST API eksternal

### Dua Aplikasi dalam Satu Codebase

| Aspek | Admin Dashboard | Technician PWA |
|-------|----------------|----------------|
| Route prefix | `/dashboard/*` | `/technician/*` |
| Layout | Sidebar + Navbar | Bottom Tab Bar |
| Target | Desktop (1280px+) | Mobile (PWA) |
| Offline | Online-only | Offline-first |
| Auth middleware | Server cookie | Session + cookie |

---

## 2. Stack Decisions

### Framework & Language

| Decision | Value | Rationale |
|----------|-------|-----------|
| Framework | Next.js 15 (App Router) | Server Components, streaming, API routes in one project |
| Language | TypeScript 5 (strict) | Type safety, better DX, fewer runtime errors |
| React | React 19 | `useOptimistic`, `useFormStatus`, concurrent features |
| Node output | `output: standalone` | Docker-ready deployment |

### Database & Auth

| Decision | Value | Rationale |
|----------|-------|-----------|
| Database | Supabase PostgreSQL | Managed Postgres with realtime, auth, storage |
| Auth | Supabase Auth (JWT) | Server-side SSR cookies, email/password |
| RLS | All tables | Defense-in-depth: DB-level access control |
| ORM | Raw SQL (knex-style) + Service Role client | Direct control over queries, no ORM overhead |

### UI & Styling

| Decision | Value | Rationale |
|----------|-------|-----------|
| Component library | shadcn/ui (New York, zinc) | Unstyled primitives, full customization |
| CSS | Tailwind CSS 3.3 | Utility-first, consistent design tokens |
| Theme | next-themes (`ThemeProvider`) | Dark/light mode with system preference |
| Drag & drop | @dnd-kit/core + @dnd-kit/sortable | Kanban board, accessible |
| Charts | Recharts | Composable SVG charts, good with Tailwind |
| Tables | TanStack Table v8 | Headless table with sorting, pagination, selection |

### Data Fetching

| Decision | Value | Rationale |
|----------|-------|-----------|
| Server state | TanStack Query v5 | Caching, dedup, optimistic updates |
| Stale time | 60s (default) | Reduce re-fetches |
| Refetch on focus | `false` | Prevent unnecessary requests |
| Mutations | Server Actions (`'use server'`) + TanStack mutation hooks | Optimistic updates, invalidation |
| Forms | React Hook Form + Zod | Type-safe validation, performant |

### Other

| Decision | Value | Rationale |
|----------|-------|-----------|
| PDF | jsPDF | Client-side PDF generation without server |
| Email | Resend | Email API untuk invoice |
| Push | web-push (server), VAPID (browser) | Web Push notification standar |
| Offline | IndexedDB + custom sync-manager | Queue offline actions, sync when online |
| Notifications | Browser Notification API + Service Worker | Push + click handlers |

---

## 3. Project Structure

```
src/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Public auth pages
│   │   ├── login/page.tsx        #   Login form
│   │   ├── confirm/page.tsx      #   Email confirmation
│   │   └── layout.tsx            #   Auth layout (minimal)
│   │
│   ├── api/                      # REST API Route Handlers
│   │   ├── auth/                 #   Auth endpoints
│   │   ├── customers/            #   Customer CRUD
│   │   ├── orders/               #   Order queries & mutations
│   │   ├── ac-units/             #   AC unit CRUD
│   │   ├── invoices/             #   Invoice queries & send
│   │   ├── service-records/      #   Service records
│   │   ├── service-reports/      #   Service reports & signature
│   │   ├── technicians/          #   Technician list
│   │   ├── technician/           #   Technician mobile API
│   │   │   ├── jobs/today/       #     Today's jobs
│   │   │   ├── jobs/[...id]/     #     Job detail + transition + report
│   │   │   ├── history/          #     Job history
│   │   │   └── push/             #     Push subscription
│   │   ├── admin/reminders/run   #   Cron trigger
│   │   └── dashboard/kpi/        #   Dashboard KPIs
│   │
│   ├── dashboard/                # Admin dashboard pages
│   │   ├── page.tsx              #   KPI dashboard
│   │   ├── orders/               #   Order management
│   │   │   ├── new/              #     Create order
│   │   │   └── [orderId]/edit/   #     Edit order
│   │   ├── invoices/             #   Invoice management
│   │   ├── customers/            #   Customer management
│   │   ├── technicians/          #   Technician management
│   │   ├── manajemen/            #   Users + AC units + locations
│   │   ├── settings/             #   Catalog, pricing, config
│   │   ├── reminders/            #   Reminder management
│   │   └── admin/                #   Admin panel
│   │
│   ├── technician/               # Technician PWA
│   │   ├── page.tsx              #   Home (today jobs)
│   │   ├── job/[...id]/          #   Job detail + completion
│   │   ├── history/              #   Job history
│   │   ├── profile/              #   Profile + push settings
│   │   ├── layout.tsx            #   PWA shell + bottom tab
│   │   ├── sw-register.tsx       #   Service worker registration
│   │   └── error.tsx             #   Error boundary
│   │
│   ├── layout.tsx                # Root layout (ThemeProvider + QueryProvider)
│   └── error.tsx                 # Root error boundary
│
├── components/                   # React components
│   ├── ui/                       #   shadcn/ui primitives
│   ├── navbar.tsx                #   Top navigation bar
│   ├── sidebar.tsx               #   Left sidebar
│   ├── theme-provider.tsx        #   next-themes wrapper
│   ├── query-provider.tsx        #   TanStack Query provider
│   ├── command-palette.tsx       #   ⌘K command palette
│   ├── order-notifications.tsx   #   Cancelled order alerts
│   ├── api-key-display.tsx       #   Personal API key card
│   ├── api-keys-management.tsx   #   API key CRUD page
│   ├── dashboard/                #   Dashboard widgets (charts, KPI cards)
│   ├── orders/                   #   Order components (23 files)
│   │   ├── orders-page-client.tsx#     Master orchestrator
│   │   ├── kanban-board.tsx      #     Drag-and-drop board
│   │   ├── kanban-column.tsx     #     Droppable column
│   │   ├── order-card.tsx        #     Kanban card
│   │   ├── order-detail-panel.tsx#     Sheet with 4 tabs
│   │   ├── assign-modal.tsx      #     Assign technician form
│   │   ├── reschedule-modal.tsx  #     Reschedule form
│   │   ├── cancel-modal.tsx      #     Cancel confirmation
│   │   └── ...                   #     (order-filters, list-view, badges, etc.)
│   ├── invoices/                 #   Invoice components
│   ├── technician/               #   Technician mobile components
│   │   ├── bottom-tab-bar.tsx    #     Mobile nav (4 tabs: Home/History/Profile)
│   │   ├── home-header.tsx       #     Home page header
│   │   ├── today-job-card.tsx    #     Today job card (redesigned)
│   │   ├── job-detail-content.tsx#     Job detail + GPS transition
│   │   ├── wizard-phase-a.tsx    #     Phase A: foto before + AC identity per unit
│   │   ├── wizard-phase-b.tsx    #     Phase B: timer dengan blocking
│   │   ├── wizard-phase-c.tsx    #     Phase C: detail + foto after + signature + submit
│   │   ├── swipe-to-action.tsx   #     Swipe gesture (ASSIGNED → EN_ROUTE only)
│   │   ├── ac-unit-form.tsx      #     Per-AC data entry
│   │   ├── photo-upload-offline.tsx#   Offline photo capture
│   │   ├── material-input.tsx    #     Material addon search
│   │   ├── signature-pad.tsx     #     Canvas signature
│   │   ├── sync-status.tsx       #     Sync indicator
│   │   ├── conflict-resolution.tsx#    Offline conflict dialog
│   │   ├── skeleton-*.tsx        #     Loading skeleton states
│   │   └── ...                   #     (profile, history)
│   └── ...                       #
│
├── hooks/                        # Custom React hooks
│   ├── use-order-mutation.ts     #   Order CRUD mutations (optimistic)
│   ├── use-invoice-mutation.ts   #   Invoice CRUD mutations
│   ├── use-online-sync.ts        #   Offline queue drain manager
│   ├── use-conflicts.ts          #   Conflict loader
│   ├── use-technician-theme.ts   #   Technician dark mode (light/dark/system)
│   ├── use-optimistic.ts         #   Generic optimistic update utilities
│   ├── use-sortable-table.ts     #   Generic sort hook
│   └── use-toast.ts              #   Toast notification system
│
├── lib/                          # Core business logic
│   ├── actions/                  #   Server Actions
│   │   ├── orders.ts             #     Order CRUD + state transitions
│   │   ├── invoices.ts           #     Invoice CRUD + payments + PDF
│   │   ├── reminders.ts          #     Reminder rules + generation
│   │   ├── create-order.ts       #     Order creation flow
│   │   ├── dashboard.ts          #     Dashboard KPIs + charts
│   │   ├── customers.ts          #     Customer CRUD
│   │   ├── technicians.ts        #     Technician CRUD
│   │   ├── users.ts              #     User management
│   │   ├── profile.ts            #     User profile
│   │   ├── locations.ts          #     Location CRUD
│   │   ├── ac-units.ts           #     AC unit CRUD
│   │   ├── addons.ts             #     Addon catalog + stock
│   │   ├── service-catalog.ts    #     Multi-dim pricing catalog
│   │   ├── service-config.ts     #     Master reference config
│   │   ├── service-pricing.ts    #     Flat pricing
│   │   ├── order-history.ts      #     Status transition history
│   │   ├── invoice-config.ts     #     Invoice configuration
│   │   ├── invoice-communications.ts # Invoice communication log
│   │   ├── service-records.ts    #     Service records
│   │   └── api-keys.ts           #     API key management
│   │
│   ├── supabase-server.ts        #   SSR client (cookie-based)
│   ├── supabase-browser.ts       #   Browser client (anon key)
│   ├── supabase-admin.ts         #   Admin client (service role, bypass RLS)
│   ├── auth.ts                   #   Auth helpers (getUser, getUserRole)
│   ├── rbac.ts                   #   Role hierarchy + permission gates
│   ├── order-status.ts           #   State machine (8 canonical states)
│   ├── invoice-status.ts         #   Invoice status helpers
│   ├── invoice-utils.ts          #   Invoice revision checks
│   ├── invoice-errors.ts         #   Custom invoice errors
│   ├── status-colors.ts          #   Status → Tailwind class mapping
│   ├── order-utils.ts            #   Order UI helpers (urgensi, board, filter)
│   ├── service-types.ts          #   Service type normalization
│   ├── service-report.ts         #   Service report query
│   ├── pdf-export.ts             #   jsPDF invoice generator
│   ├── push.ts                   #   Browser-side push helper
│   ├── server/push-sender.ts     #   Server-side push fan-out
│   ├── realtime.ts               #   Supabase realtime subscriptions
│   ├── api-key.ts                #   HMAC-SHA512 API key generation
│   ├── logger.ts                 #   Scoped console logger
│   ├── format.ts                 #   IDR currency + date format
│   ├── bank-accounts.ts          #   Bank account parsing
│   ├── reminder-utils.ts         #   Reminder types + template engine
│   ├── utils.ts                  #   cn(), formatRupiah(), formatPhone()
│   ├── utils/                    #   Utility functions
│   │   ├── money.ts              #     Discount/tax calculation
│   │   ├── image-compression.ts  #     Canvas-based image compression
│   │   ├── geolocation.ts        #     GPS capture (best-effort)
│   │   └── html.ts               #     HTML entity escape
│   └── offline/                  #   Offline support
│       ├── db.ts                 #     IndexedDB schema
│       ├── sync-manager.ts       #     Queue + sync logic (422/403 → needs-attention)
│       ├── timer.ts              #     Persistent timer (localStorage timestamps)
│       └── auth-refresh.ts       #     Offline auth refresh
│
├── middleware.ts                 # Next.js middleware (auth guard + role routing)
│
├── types/                        # TypeScript type definitions
│   └── create-order.ts           #   Order types (OrderItem, ServiceTypeEnum, etc.)
│
└── styles/                       # Global CSS
    └── globals.css               #   Tailwind directives + CSS variables
```

---

## 4. Auth & Authorization Flow

### 4.1 Three Supabase Client Strategies

```
┌─────────────────────────────┬──────────────────┬──────────────────────────┐
│ Client                      │ Use When          │ How It Works             │
├─────────────────────────────┼──────────────────┼──────────────────────────┤
│ supabase-server.ts          │ Server Components,│ createServerClient()     │
│                             │ Server Actions    │ Cookies via next/headers │
├─────────────────────────────┼──────────────────┼──────────────────────────┤
│ supabase-browser.ts         │ Client Components,│ createBrowserClient()    │
│                             │ Login form        │ Anon key from env        │
├─────────────────────────────┼──────────────────┼──────────────────────────┤
│ supabase-admin.ts           │ Admin mutations,  │ Service role key         │
│                             │ Push sending      │ Bypasses RLS             │
└─────────────────────────────┴──────────────────┴──────────────────────────┘
```

### 4.2 Login Flow

```
1. User submits email/password
   └─ supabase.auth.signInWithPassword({ email, password })
        └─ On success: query user_management(role, is_active)
             ├─ Valid: role ∈ {SUPERADMIN, ADMIN, FINANCE, TECHNICIAN}
             │    └─ Redirect:
             │         TECHNICIAN → /technician
             │         Others     → /dashboard (or ?redirectTo)
             └─ Invalid: "Pengguna tidak ditemukan. Hubungi administrator..."
```

### 4.3 Middleware Route Protection

```
Setiap request ke protected route:
  └─ middleware.ts
       └─ createServerClient() → getUser()
            ├─ No user → /login?redirectTo=pathname
            ├─ User found:
            │    └─ Query user_management(role, is_active) [30s cache]
            │         ├─ inactive → signOut() + /login?error=Akun tidak aktif
            │         └─ active → check role routing:
            │              ├─ TECHNICIAN accessing /dashboard/* → /technician
            │              └─ Non-TECHNICIAN accessing /technician → /dashboard
            └─ Root / → /dashboard (authed) or /login (unauthed)
```

### 4.4 RBAC Role Hierarchy

```
SUPERADMIN (4)     — full system access + user management + API keys
    │
    └── ADMIN (3)  — daily operations, create/assign orders, manage data
          │
          ├── TECHNICIAN (2) — mobile PWA: own jobs only, transitions, reports
          │
          └── FINANCE (2)    — invoices, payments, reports (read-only orders)
```

**Helper functions** (`src/lib/rbac.ts`):
- `hasAccess(userRole, requiredRole)` — numeric hierarchy comparison
- `canManageUsers(role)` — SUPERADMIN | ADMIN
- `canViewAllUsers(role)` — SUPERADMIN only
- `requireFinanceRole(user)` — throws if not SUPERADMIN | ADMIN | FINANCE

### 4.5 API Auth

```
API Route (route.ts)
  └─ verifyAuth(request)
       └─ Authorization: Bearer <JWT> → supabase.auth.getUser(token)
            └─ Returns Supabase User or 401

Khusus finance routes:
  └─ requireFinanceRoleAPI(request)
       ├─ 1. Try Bearer token
       └─ 2. Fallback: cookie session (for browser)
            └─ Returns 403 if not SUPERADMIN | ADMIN | FINANCE
```

---

## 5. Order State Machine

### 5.1 Canonical States (8)

```
PENDING ──→ ASSIGNED ──→ EN_ROUTE ──→ IN_PROGRESS ──→ COMPLETED ──→ INVOICED ──→ PAID
    ↑            │            │              │                                       │
    └── Reschedule ┘            └────── CANCELLED (terminal) ────────────────────────┘
```

### 5.2 Transition Matrix

| From \ To | PENDING | ASSIGNED | EN_ROUTE | IN_PROGRESS | COMPLETED | INVOICED | PAID | CANCELLED |
|-----------|---------|----------|----------|-------------|-----------|----------|------|-----------|
| PENDING | — | SA, A | — | — | — | — | — | SA, A |
| ASSIGNED | SA, A | — | T | — | — | — | — | SA, A |
| EN_ROUTE | SA, A | — | — | T | — | — | — | SA, A |
| IN_PROGRESS | — | — | — | — | T | — | — | SA, A |
| COMPLETED | — | — | — | — | — | SA, A, F | — | — |
| INVOICED | — | — | — | — | — | — | SA, A, F | SA, A |
| PAID | — | — | — | — | — | — | — | — |
| CANCELLED | — | — | — | — | — | — | — | — |

SA=SUPERADMIN, A=ADMIN, T=TECHNICIAN, F=FINANCE

### 5.3 Legacy Status Mapping

Beberapa nilai DB lawan masih ada. Mapped runtime via `toCanonical()`:

| Legacy DB Value | Canonical |
|----------------|-----------|
| NEW, ACCEPTED, RESCHEDULE | PENDING |
| EN ROUTE | EN_ROUTE |
| ARRIVED, TO_WORKSHOP, IN_WORKSHOP | IN_PROGRESS |
| DONE, READY_TO_RETURN, DELIVERED | COMPLETED |
| CLOSED | PAID |

### 5.4 Enforcement Points

State machine ditegakkan di **3 lapisan**:
1. **Server Actions** (`src/lib/actions/orders.ts`) — `canTransition()` dipanggil sebelum setiap update
2. **API Routes** (`/api/orders/[id]/status`) — validasi yang sama untuk REST clients
3. **UI** — Kanban hanya mengizinkan drop yang valid; tombol kontekstual di detail panel

Setiap transisi menulis baris ke `order_status_transitions` dengan:
- `from_status`, `to_status`
- `changed_by` (auth.users UUID)
- `changed_at`
- GPS: `lat`, `lng`, `accuracy_m` (dari teknisi)
- `arrival_photos` (untuk transisi EN_ROUTE → IN_PROGRESS)
- `idempotency_key` (untuk safe retry dari mobile)

---

## 6. Data Flow Patterns

### 6.1 Dual Data Access Pattern

Server Actions dan REST API ada secara paralel:

```
Page Component (Client)
  │
  ├── useQuery → fetch data via Server Action (wrapped)
  │     Server Action → supabase-admin or supabase-server → DB
  │
  └── useMutation → call Server Action
        Server Action → validate → supabase → revalidatePath

API Client (Mobile/External)
  │
  └── HTTP → Route Handler (route.ts)
        verifyAuth → server action (with admin client) or direct query
```

**Mengapa dua pattern?**
- **Server Actions** untuk web dashboard — lebih aman (bukan exposed endpoints), otomatis cookie session
- **REST API** untuk technician PWA dan integrasi eksternal — standard API contract

### 6.2 Optimistic Updates (Orders)

Semua mutation order menggunakan optimistic update via React 19 `useOptimistic`:

```
1. User klik tombol (e.g., Assign)
2. UI langsung update (optimistic)
3. Server action dijalankan
4. On success → invalidate cache (data nyata dari server)
5. On error → rollback ke snapshot sebelumnya
```

### 6.3 Invoice → Order Sync

Mutasi invoice selalu berdampak ke status order:

| Aksi Invoice | Efek Order |
|-------------|------------|
| Create FINAL invoice | `COMPLETED` → `INVOICED` |
| Delete FINAL invoice (DRAFT) | `INVOICED` → `COMPLETED` |
| Record payment (lunas, FINAL) | `INVOICED` → `PAID` |
| Cancel invoice | `INVOICED` → `COMPLETED` |

### 6.4 Fire-and-Forget Push

Push notification dikirim best-effort. Gagal kirim tidak blokir operasi utama:

```
assignOrdersToTechnician(data)
  ├── 1. DB updates (atomic)
  ├── 2. Push notifications (Promise.allSettled)
  │      └── web-push → VAPID → browser notification
  └── 3. Return success
```

---

## 7. API Design

### 7.1 Response Format

Semua endpoint mengembalikan:

```typescript
{
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
```

### 7.2 Status Codes

| Code | Use |
|------|-----|
| 200 | OK |
| 201 | Created |
| 400 | Bad Request / Validation error |
| 401 | Unauthorized (no/invalid token) |
| 403 | Forbidden (wrong role) |
| 404 | Not Found |
| 409 | Conflict (concurrent modification / idempotency) |
| 422 | Unprocessable (state machine violation) |
| 500 | Internal Server Error |
| 501 | Not Implemented |

### 7.3 Auth Methods

| Method | Header | Used By |
|--------|--------|---------|
| Bearer JWT | `Authorization: Bearer <token>` | API clients, external integration |
| Cookie session | `sb-access-token` cookie | Browser dashboard, technician PWA |
| Cron secret | `Authorization: Bearer <CRON_SECRET>` | External cron jobs |
| API Key | `Authorization: Bearer sk_...` | Partner integration (future) |

---

## 8. Component Architecture

### 8.1 Component Tree (Admin Dashboard)

```
<ThemeProvider>
  <QueryProvider>
    <Navbar>
      <JakartaTime />            ← live clock WIB
      <OrderNotifications />     ← polling cancelled orders (10s)
      <CommandPalette />         ← ⌘K
    </Navbar>
    <Sidebar>                     ← collapsible, RBAC-filtered
      <DarkModeToggle />
      <ProfileSection />
    </Sidebar>
    <main>
      <OrdersPageClient>          ← Master orchestrator
        <OrderFilters />          ← URL-synced filters
        <OrdersBoardView>
          <KanbanBoard>           ← @dnd-kit
            <KanbanColumn>        ← useDroppable
              <OrderCard />       ← useDraggable, forwardRef
            </KanbanColumn>
          </KanbanBoard>
        </OrdersBoardView>
        <OrdersListView />        ← TanStack Table (alternatif)
        <BulkAssignBar />         ← selection mode
        <OrderDetailPanel>        ← Sheet slide-over
          <OrderDetailTab />
          <OrderReportTab>
            <ReportPhotoGallery />
            <ReportMaterialsTable />
            <ReportSignatureCard />
          </OrderReportTab>
          <OrderInvoiceTab />
          <OrderHistoryTab />
          <AssignModal />
          <RescheduleModal />
          <CancelModal />
        </OrderDetailPanel>
      </OrdersPageClient>
    </main>
  </QueryProvider>
</ThemeProvider>
```

### 8.2 Component Tree (Technician PWA)

```
<ThemeProvider>
  <QueryProvider>
    <TechnicianLayout>            ← PWA manifest, viewport
      <main>
        <HomeHeader />            ← greeting + status badge
        <TodayJobsList>           ← auto-refresh 60s
          <TodayJobCard />        ← redesigned card + active pulse
          <EmptyTodayJobs />
          <TodayJobsSkeleton />
        </TodayJobsList>

        <JobDetailContent>        ← GPS-first transition flow
          <SwipeToAction />       ← swipe gesture (ASSIGNED → EN_ROUTE only)
          <WizardPhaseA>          ← Phase A: foto before + AC identity per unit
          <WizardPhaseB>          ← Phase B: timer blocking (minimum duration)
          <WizardPhaseC>          ← Phase C: detail + foto after + signature + submit
            <AcUnitForm>          ← branches on AC source (existing vs new)
              <PhotoUploadOffline /> ← IndexedDB
              <MaterialInput />      ← addon catalog search + pending request
            </AcUnitForm>
            <SignaturePad />
            <SyncStatus />
          </WizardPhaseC>
        </JobDetailContent>

        <HistoryList>
          <HistoryJobCard />
        </HistoryList>

        <ProfileContent>
          <PushToggle />
        </ProfileContent>
      </main>
      <BottomTabBar />            ← 4 tabs: Home / History / Profile
      <SyncStatus />              ← connectivity/sync badge
      <ConflictResolution />      ← offline conflict dialog
    </TechnicianLayout>
  </QueryProvider>
</ThemeProvider>
```

---

## 9. Offline Architecture (Technician PWA)

### 9.1 Queue Storage (IndexedDB)

| Store | Content | Sync Order |
|-------|---------|------------|
| `pending_transitions` | { orderId, toStatus, gps, idempotencyKey, arrivalPhotos } | 1st |
| `pending_photos` | { orderId, acUnitIdx, kind, file blob } | 2nd |
| `pending_reports` | { orderId, acUnits, signature, total, nextService } | 3rd |

### 9.2 Sync Trigger Events

```
Queue drain dipicu oleh 4 event:
  1. window 'online' event         — browser goes online
  2. Service worker 'sync' event   — Chromium Background Sync
  3. visibilitychange → visible    — user returns to tab
  4. Mount-time check              — initial page load

Drain order: transitions → photos → reports
Conflict? → simpan ke ConflictRecord → tampilkan ConflictResolution dialog
```

### 9.3 Conflict Resolution

| Conflict Type | Description | User Action |
|---------------|-------------|-------------|
| cancelled | Order dibatalkan saat offline | Export PDF laporan, discard |
| reassigned | Teknisi diganti saat offline | Export PDF, discard |
| auth_expired | Session expired saat offline | Logout → login ulang |

### 9.4 Photo Upload Flow (Offline)

```
1. User capture foto → compressImage (Canvas, ≤1MB, 1600px max)
2. enqueuePhoto({ orderId, acUnitIdx, kind, blob }) → IndexedDB
3. UI: preview thumbnail + "Belum tersinkron" badge
4. Saat sync:
   a. Upload blob ke Supabase Storage
   b. Dapatkan public URL
   c. Update pending report dengan URL (bukan blob)
5. Hapus dari IndexedDB setelah sukses
```

### 9.5 Persistent Work Timer

File: `src/lib/offline/timer.ts`. Timer kerja teknisi disimpan via localStorage agar survive refresh, close app, bahkan restart HP.

```
localStorage key: msn-tech-timer-{jobId}
Stored value:     ISO string dari waktu start (work_started_at)

Aturan:
  - Hanya 1 timer aktif di satu waktu (mulai job kedua diblokir)
  - Timer dihitung dari timestamp tersimpan, bukan setInterval
  - Saat Phase B: UI baca timestamp → hitung elapsed → block kalau belum
    mencapai durasi minimum
  - Timer dihapus dari localStorage saat report berhasil di-submit
```

### 9.6 Sync Manager — Error Handling (422/403)

File: `src/lib/offline/sync-manager.ts`.

| Response | Lama (BUG) | Baru |
|----------|-----------|------|
| 422 / 403 | Hapus queued report dari IndexedDB (**data loss**) | Tandai report dengan status `needs-attention`, data dipertahankan di queue |

Laporan bertanda `needs-attention` muncul di UI sehingga teknisi bisa menghubungi admin untuk resolve konflik state secara manual, alih-alih kehilangan data.

### 9.7 Technician Dark Mode

Terpisah dari admin theme (admin pakai `next-themes` ThemeProvider).

| Aspek | Implementasi |
|-------|--------------|
| Hook | `src/hooks/use-technician-theme.ts` |
| localStorage key | `msn-tech-theme` |
| Opsi | `light` / `dark` / `system` |
| CSS variables | `--tech-bg: #0f0e1a`, `--tech-card: #1a1833`, dll di `globals.css` |
| Scope | Hanya route `/technician/*`, tidak mempengaruhi admin |

---

## 10. Database Schema

### 10.1 Entity Relationship (High-Level)

```
user_management ──┬── auth.users (Supabase)
technicians ──────┤
                  │
customers ──── locations ──── ac_units
                  │
orders ───────────┤
  ├── order_items ──── service_catalog
  ├── order_addons ─── addon_catalog
  ├── order_technicians ─── technicians
  ├── order_status_transitions
  └── service_reports ─── service_records
        │
invoices ─────────┤
  ├── invoice_items
  ├── invoice_communications
  └── payment_records

reminder_rules ──── customer_reminders ──── ac_units
push_subscriptions ──── auth.users
```

### 10.2 Key Tables Summary

| Table | Purpose | Key Columns |
|-------|---------|------------|
| `orders` | Core order entity | `order_id`, `customer_id`, `status` (enum), `scheduled_visit_date`, `deleted_at` |
| `order_items` | Multi-service line items | `order_id`, `location_id`, `ac_unit_id`, `service_type`, `estimated_price`, `actual_price` |
| `order_technicians` | M:N orders↔technicians | `order_id`, `technician_id`, `role` (lead/helper) |
| `order_status_transitions` | State machine audit trail | `order_id`, `from/to_status`, `lat/lng`, `idempotency_key`, `arrival_photos` |
| `service_reports` | Technician completion report | `order_id`, `ac_units` (JSONB), `materials` (JSONB), `actual_total_price`, `customer_signature_url`, `idempotency_key` |
| `technician_submit_report_v2()` | RPC: submit report + AC contract enforcement | Enforces AC source: existing=read-only identity, new=required fields. Idempotent. |
| `invoices` | Invoice (proforma/final, linked/blank) | `invoice_number`, `order_id` (nullable), `total_amount`, `status`, `invoice_type`, `source` |
| `invoice_items` | Invoice line items | `invoice_id`, `item_type`, `description`, `qty`, `unit_price`, `total_price` |
| `payment_records` | Payment tracking | `invoice_id`, `amount`, `payment_method`, `payment_date` |
| `invoice_configuration` | Company info + defaults | `company_name`, `npwp`, `bank_accounts` (JSON), `default_tax_percentage` |
| `customer_reminders` | Reminder queue | `ac_unit_id`, `rule_id`, `due_date`, `status` |
| `reminder_rules` | Configurable rules | `name`, `days_before_due`, `channel`, `message_template` |
| `ac_units` | Registered AC units | `location_id`, `brand`, `model_number`, `next_service_due_date` |
| `push_subscriptions` | Web Push subscriptions | `user_id`, `endpoint`, `p256dh`, `auth` |

### 10.3 Custom Enums

| Enum | Values |
|------|--------|
| `order_status` | `PENDING`, `ASSIGNED`, `EN_ROUTE`, `IN_PROGRESS`, `COMPLETED`, `INVOICED`, `PAID`, `CANCELLED` |
| `service_type` | `CLEANING`, `REFILL_FREON`, `REPAIR`, `INSTALLATION`, `INSPECTION`, `MULTI_SERVICE`, `CHECKING`, `UNINSTALL`, `MAINTENANCE` |
| `role_type` | `SUPERADMIN`, `ADMIN`, `FINANCE`, `TECHNICIAN` |
| `ac_status` | `ACTIVE`, `INACTIVE`, `RETIRED` |
| `payment_method` | `CASH`, `TRANSFER`, `EWALLET`, `CARD` |
| `payment_status` | `UNPAID`, `PARTIAL`, `PAID`, `FAILED`, `REFUNDED` |

### 10.4 RLS Policy per Table

Pola umum:
- SUPERADMIN + ADMIN: FULL CRUD (select, insert, update, delete)
- FINANCE: SELECT read-only untuk data operasional, FULL untuk invoice/payment
- TECHNICIAN: SELECT own assignments, INSERT own transitions/reports

---

## 11. Real-time Subscriptions

Semua perubahan data dari teknisi (transisi status, report submission) perlu segera terlihat di dashboard admin. Menggunakan Supabase Realtime (Postgres Changes).

### Subscribed Channels

| Channel | Table | Events | Invalidates |
|---------|-------|--------|-------------|
| `orders` | `orders` | `*` | `['orders', 'dashboard-kpi']` |
| `payments` | `payments` | `*` | `['payments', 'dashboard-kpi']` |
| `service_records` | `service_records` | `*` | `['service-records', 'dashboard-kpi']` |
| `service_pricing` | `service_pricing` | `*` | `['service-pricing']` |
| `service_sla` | `service_sla` | `*` | `['service-sla']` |

### Architecture

```typescript
// Singleton pattern — cegah duplikasi WebSocket di StrictMode
const _activeChannels = new Map<string, RealtimeChannel>()

subscribeOrders(queryClient, onNewOrder?)
  └── supabase.channel('orders')
        └── .on('postgres_changes', ...)
              └── queryClient.invalidateQueries(['orders'])
              └── onNewOrder?.(payload)
```

---

## 12. Deployment

### 12.1 Environment Variables

```bash
# Required
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXTAUTH_SECRET=xxx
NEXTAUTH_URL=https://app.example.com

# Push Notification (VAPID)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=xxx
VAPID_PRIVATE_KEY=xxx
VAPID_EMAIL=admin@example.com

# Email
RESEND_API_KEY=re_xxx

# API Keys
API_KEY_SECRET=xxx

# Cron
CRON_SECRET=xxx
```

### 12.2 Build & Deploy

```bash
# Build
bun run build    # output: standalone

# Vercel
# Connect repo → set env vars → deploy

# Docker
docker build -t msn-erp .
docker run -p 3000:3000 msn-erp
```

### 12.3 Cron Job

```bash
# Setiap hari jam 08:00 WIB
curl -X POST https://app.example.com/api/admin/reminders/run \
  -H "Authorization: Bearer $CRON_SECRET"
```

### 12.4 Supabase Services

| Service | Usage |
|---------|-------|
| PostgreSQL | All data |
| Auth | Email/password authentication |
| Storage | Photos, signatures, company logo |
| Realtime | Live dashboard updates |

---

## Appendix A: Design Tokens

Design system ditentukan di `DESIGN.md` dan diimplementasikan via Tailwind CSS variables di `globals.css`. Dua token penting:

### Status Colors

| Entity | Amber | Blue | Indigo | Violet | Green | Cyan | Emerald | Red |
|--------|-------|------|--------|--------|-------|------|---------|-----|
| Order Status | PENDING | ASSIGNED | EN_ROUTE | IN_PROGRESS | COMPLETED | INVOICED | PAID | CANCELLED |
| Invoice Status | PARTIAL_PAID | SENT | — | — | — | — | PAID | OVERDUE / CANCELLED |

### Style Tokens

| Token | Value |
|-------|-------|
| Primary | `#2563eb` (brand blue) |
| Radius (lg) | `0.75rem` |
| Card padding | `24px` |
| Input height | `h-9` (36px) |
| Touch target (PWA) | `min 44px` |
| Skeleton | Pulse animation |

---

## Appendix B: Key Decisions & Trade-offs

### Yes, dua pattern data flow (Server Actions + REST API)

Server Actions untuk web (aman, otomatis session), REST API untuk mobile/external (standard contract). Iya ada duplikasi validasi, tapi trade-off dapat diterima karena masing-masing punya konsumen berbeda.

### Yes, AC Completion Contract dengan branching per source

AC source ditentukan oleh `order_items.ac_unit_id`. Tiga branch: existing complete AC → read-only, existing incomplete → fill missing, new AC → full input. Ditegakkan di RPC `technician_submit_report_v2()`. Test coverage via 5 dedicated test files.

### Yes, IndexedDB untuk offline queue (bukan localStorage)

IndexedDB bisa simpan blob (foto), punya kapasitas lebih besar, dan query by index. localStorage terbatas ke string 5-10MB.

### Yes, test framework aktif (Vitest + Playwright)

44+ test files: Vitest untuk unit test server actions, komponen, validasi schema. Playwright untuk E2E dan QA smoke test. `tsc --noEmit` sebagai type safety gate.