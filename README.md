# AC Service Management Dashboard

Web-based management system for AC service operations. Includes admin dashboard (order management, invoicing, customer management) and Progressive Web App for field technicians. Built with Next.js 15, React 19, Supabase, and shadcn/ui.

## Features

### Order Management
- **8-State Lifecycle**: PENDING → ASSIGNED → EN_ROUTE → IN_PROGRESS → COMPLETED → INVOICED → PAID, plus CANCELLED
- **Kanban Board View**: Drag-and-drop order management with real-time updates
- **List View**: Detailed table with filtering, sorting, search
- **Assignment**: Assign/reassign technicians with push notifications
- **Rescheduling**: Change dates, auto-notify technicians

### Technician Mobile App (PWA)
- Offline-first with IndexedDB queue (works without internet)
- Job list with status and customer details
- Service report form: before/after photos, materials entry, digital signature
- Push notifications for new jobs and updates
- **AC Completion Contract**: Branch behavior per-AC unit — existing complete AC (read-only identity), existing incomplete (fill missing fields), new AC (full input). Source of truth: `order_items.ac_unit_id`.

### Invoicing & Payments
- Proforma invoices (deposit before service)
- Final invoices (auto-populated from service reports)
- Payment scenarios: full payment, deposit + balance, installment, contract-based
- PDF export and email sending via Resend

### Service & Addon Catalog
- 300+ pre-configured service items with dynamic pricing
- Parts inventory with stock tracking
- Technician part-request → admin approval workflow

### Customer & Asset Management
- Customer database with billing info and service history
- Multiple locations per customer
- AC unit tracking (serial numbers, service history)

### Automation & Monitoring
- Automated service reminders based on AC unit due dates
- KPI dashboard: revenue charts, order distribution, technician performance
- Real-time updates via Supabase Realtime subscriptions

### Role-Based Access
| Role | Access |
|------|--------|
| **SUPERADMIN** | Full access, user management, system config |
| **ADMIN** | Order management, customers, invoicing |
| **TECHNICIAN** | Mobile app, assigned jobs only |
| **FINANCE** | Invoice management, payment recording |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 15 (App Router) |
| **UI** | React 19, TypeScript, Tailwind CSS, shadcn/ui |
| **State** | TanStack Query v5, TanStack Table v8 |
| **Forms** | React Hook Form + Zod |
| **Database** | Supabase PostgreSQL (RLS enabled) |
| **Auth** | Supabase JWT + HTTP-only cookies |
| **Realtime** | Supabase Realtime (CDC subscriptions) |
| **API** | Next.js Server Actions + REST API routes |
| **Email** | Resend API |
| **PDF** | jsPDF + html2canvas |
| **Testing** | Vitest (unit) + Playwright (E2E) |
| **Hosting** | Docker (VPS), Cloudflare Tunnel |
| **Storage** | Supabase Storage |

## Project Structure

```
src/
├── app/                   # Next.js App Router
│   ├── (auth)/            # Login, confirm email
│   ├── api/               # REST API endpoints
│   ├── dashboard/         # Admin pages (orders, customers, invoices)
│   └── technician/        # Technician PWA routes
├── components/            # React components
│   ├── ui/                # shadcn/ui primitives
│   └── ...                # Domain components
├── hooks/                 # Custom React hooks
├── lib/
│   ├── actions/           # Server actions per domain
│   └── ...                # Clients, utils, state machine
├── types/                 # TypeScript types
└── styles/                # Global CSS
supabase/migrations/       # Database migrations (run in order)
docs/                      # Documentation
scripts/                   # Seed scripts, utilities
```

## Deployment

### Prerequisites
- Bun 1.1+ (or Node.js with Bun 1.1+)
- Supabase project (URL + anon key + service role key)
- Docker (optional, for container deployment)

### 1. Environment Setup

```bash
cp .env.example .env.local
```

Edit `.env.local` with your Supabase credentials:
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key (server only)

### 2. Database Setup

Run migrations against your Supabase project in order:

```bash
for f in supabase/migrations/*.sql; do
  psql $POSTGRES_URL -f "$f"
done
```

Or run individually (in order):
```bash
psql $POSTGRES_URL -f supabase/migrations/00_v2_schema.sql
psql $POSTGRES_URL -f supabase/migrations/01_v2_rls.sql
# ...all files through 09_technician_submit_report_rpc.sql
```

### 3. Run (Development)

```bash
bun install
bun run dev
```

Open http://localhost:3000.

### 4. Docker (Production)

```bash
docker compose build
docker compose up -d
```

Container runs on `127.0.0.1:3001`. Configure reverse proxy (Cloudflare Tunnel, Nginx, etc.) for public access.

### 5. Vercel (Alternative)

Connect repo to Vercel, set environment variables, deploy. Configure Vercel Cron for reminder generation.

## Testing

```bash
bun run test           # Vitest unit tests (44+ test files)
bun run test:ui        # Vitest UI mode
bun run type-check     # tsc --noEmit (type safety gate)
bun run test:e2e       # Playwright E2E (headed)
```

## Scripts

| Command | Purpose |
|---------|---------|
| `bun run dev` | Development server |
| `bun run build` | Production build |
| `bun run lint` | ESLint |
| `bun run type-check` | TypeScript check |
| `bun run clean` | Remove `.next` cache |
| `bun run test` | Vitest unit tests |
| `bun run test:e2e` | Playwright E2E tests |

## Documentation

| Doc | Description |
|-----|------------|
| [docs/BUSINESS-GUIDE.md](docs/BUSINESS-GUIDE.md) | Order lifecycle, payment scenarios, do's & don'ts |
| [docs/TECHNICAL-GUIDE.md](docs/TECHNICAL-GUIDE.md) | Architecture, data flow, state machine, API patterns, AC completion contract |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System architecture and database schema |
| [docs/api.md](docs/api.md) | REST API reference |
| [docs/PRD.md](docs/PRD.md) | Product requirements (Indonesian) |
| [docs/REMINDER-SYSTEM.md](docs/REMINDER-SYSTEM.md) | Service reminder pipeline |
| [docs/CRON-SETUP.md](docs/CRON-SETUP.md) | Cron configuration |
| [docs/V1-vs-V2-comparison.md](docs/V1-vs-V2-comparison.md) | Migration diff from V1 production to V2 |

## License

Private. All rights reserved.
