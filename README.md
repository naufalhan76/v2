# AC Service Management Dashboard

## Overview

Comprehensive web-based management system for AC service operations. Built for service companies managing field technicians, customer orders, invoicing, and service scheduling. Features a full-featured admin dashboard and a Progressive Web App (PWA) for technicians in the field.

## Key Features

### Order Management
- **Complete Order Lifecycle**: PENDING → ASSIGNED → EN_ROUTE → IN_PROGRESS → COMPLETED → INVOICED → PAID
- **Kanban Board View**: Drag-and-drop interface for visual order management
- **List View**: Detailed table view with filtering, sorting, and search
- **Order Assignment**: Assign orders to technicians with automatic push notifications
- **Rescheduling**: Reschedule orders with automatic technician notifications
- **Reassignment**: Transfer orders between technicians
- **Real-time Updates**: Live order status updates via Supabase Realtime

### Technician Mobile App (PWA)
- **Offline-First Architecture**: Works without internet connection using IndexedDB
- **Job List**: View assigned jobs with status and customer details
- **Status Transitions**: Update job status (EN_ROUTE, IN_PROGRESS, COMPLETED)
- **Service Report Form**: Complete job reports with:
  - Photo upload (before/after with compression)
  - Material/addon entry with stock tracking
  - Digital signature capture
  - Service notes and findings
- **Push Notifications**: Receive job assignments and updates
- **Background Sync**: Automatic sync when connection restored

### Invoicing & Payments
- **Proforma Invoices**: Generate deposit invoices before service
- **Final Invoices**: Auto-populate from service reports with actual costs
- **Payment Recording**: Track full payments and installments
- **Payment Scenarios**:
  - Full payment upfront
  - Deposit + balance on completion
  - Installment plans for corporate clients
  - Contract-based billing
- **PDF Export**: Generate professional invoice PDFs
- **Email Sending**: Send invoices via Resend API

### Service Catalog & Pricing
- **Dynamic Pricing**: Configure prices by unit type, capacity, and service type
- **Service Catalog**: 300+ pre-configured service items
- **Addon Catalog**: Parts and materials inventory with stock tracking
- **Addon Request Workflow**: Technicians request new parts → Admin approves with pricing
- **Bulk Import**: Seed catalog from CSV/SQL

### Customer & Asset Management
- **Customer Database**: Contact info, billing address, service history
- **Location Management**: Multiple service locations per customer
- **AC Unit Tracking**: Serial numbers, installation dates, service history
- **Service History**: Complete audit trail per unit

### Service Reminders
- **Automated Reminders**: Generate reminders based on AC unit service due dates
- **Configurable Rules**: Set reminder intervals (e.g., 30 days before due)
- **Admin Queue**: Review and dispatch reminders manually
- **Cron Integration**: Daily generation via pg_cron, Vercel Cron, or systemd

### Dashboard & Analytics
- **KPI Cards**: Revenue, orders, completion rate, technician utilization
- **Revenue Charts**: Monthly trends with Recharts
- **Order Status Distribution**: Visual breakdown by status
- **Technician Performance**: Jobs completed, average time, customer ratings

### Role-Based Access Control (RBAC)
- **SUPERADMIN**: Full system access, user management
- **ADMIN**: Order management, customer management, invoicing
- **TECHNICIAN**: Mobile app access, job completion, service reports
- **FINANCE**: Invoice management, payment recording, financial reports

### Real-time Features
- **Live Order Updates**: Supabase Postgres Change subscriptions
- **Push Notifications**: Web Push API with VAPID for technicians
- **Optimistic Updates**: Instant UI feedback with TanStack Query

## Technology Stack

### Frontend
- **Framework**: Next.js 15 (App Router)
- **UI Library**: React 19
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 3.3 + shadcn/ui (New York style, zinc base)
- **State Management**: TanStack Query v5 (1-min stale time, no refetch on focus)
- **Tables**: TanStack Table v8
- **Forms**: React Hook Form + Zod validation
- **Charts**: Recharts

### Backend
- **Database**: Supabase PostgreSQL with Row-Level Security (RLS)
- **Authentication**: Supabase JWT auth
- **Real-time**: Supabase Realtime (Postgres Change subscriptions)
- **API**: Next.js Server Actions + REST API routes
- **Email**: Resend API
- **PDF Generation**: jsPDF + html2canvas

### Infrastructure
- **Hosting**: Docker on VPS (127.0.0.1:3001)
- **Reverse Proxy**: Cloudflare Tunnel (v2.nufnh.my.id)
- **Database**: Supabase Cloud (AWS ap-northeast-2)
- **Storage**: Supabase Storage (service reports, photos)

## Quick Start

### Prerequisites
- Node.js 18+ and npm
- Supabase account and project
- Docker (optional, for deployment)

### Installation

```bash
# 1. Clone repository
git clone <repository-url>
cd webpanel

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# 4. Run database migrations
# Execute SQL files in supabase/migrations/ against your Supabase project
# Order: 00_v2_schema.sql → 01_rls_policies.sql → 02_seed_dimensions.sql → 03_seed_catalog_*.sql → 04_realtime.sql → 05_identity_and_addon_requests.sql

# 5. Start development server
npm run dev
```

Open http://localhost:3000 and log in with your Supabase credentials.

## Project Structure

```
webpanel/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── (auth)/               # Auth routes (login, confirm email)
│   │   ├── api/                  # REST API endpoints
│   │   ├── dashboard/            # Admin dashboard pages
│   │   │   ├── orders/           # Order management (Kanban + List)
│   │   │   ├── manajemen/        # Master data (customers, technicians, users)
│   │   │   ├── keuangan/         # Invoicing and payments
│   │   │   ├── konfigurasi/      # Service catalog, addons, pricing
│   │   │   ├── reminders/        # Service reminder queue
│   │   │   └── settings/         # System configuration
│   │   └── technician/           # Technician PWA routes
│   ├── components/               # React components
│   │   ├── ui/                   # shadcn/ui components
│   │   ├── orders/               # Order-specific components
│   │   ├── technician/           # Technician app components
│   │   └── ...                   # Other domain components
│   ├── hooks/                    # Custom React hooks
│   │   ├── use-order-mutation.ts # Order state mutations
│   │   ├── use-realtime.ts       # Realtime subscriptions
│   │   └── ...
│   ├── lib/                      # Core utilities
│   │   ├── actions/              # Server actions (by domain)
│   │   ├── supabase-server.ts    # Server-side Supabase client
│   │   ├── supabase-admin.ts     # Admin Supabase client (bypasses RLS)
│   │   ├── order-status.ts       # Order state machine logic
│   │   ├── rbac.ts               # Role-based access control helpers
│   │   └── ...
│   ├── types/                    # TypeScript type definitions
│   └── styles/                   # Global CSS
├── supabase/
│   └── migrations/               # Database migrations (run in order)
├── docs/                         # Documentation
│   ├── ARCHITECTURE.md           # Technical architecture
│   ├── BUSINESS-GUIDE.md         # Business process guide
│   ├── api.md                    # REST API reference
│   └── ...
├── public/                       # Static assets
│   └── technician-sw.js          # Service worker for technician PWA
├── tests/                        # Test suites
│   └── e2e/                      # End-to-end tests
└── docker-compose.yml            # Docker deployment config
```

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start development server (http://localhost:3000) |
| `npm run build` | Production build (outputs to `.next/`) |
| `npm run start` | Run production build |
| `npm run lint` | Run ESLint checks |
| `npm run lint:fix` | Run ESLint with auto-fix |
| `npm run type-check` | TypeScript type checking (`tsc --noEmit`) |
| `npm run clean` | Remove `.next/` and Next.js cache |

## Environment Variables

### Required Variables

Create `.env.local` with the following:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# NextAuth Configuration
NEXTAUTH_SECRET=your-secret-key
NEXTAUTH_URL=http://localhost:3000

# Web Push Notifications (VAPID)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_PRIVATE_KEY=your-vapid-private-key

# Cron Secret (for reminder generation)
CRON_SECRET=your-cron-secret
```

### Optional Variables

```bash
# Email (Resend API)
RESEND_API_KEY=re_your_api_key

# API Key Authentication
API_KEY_SECRET=your-hmac-secret
```

### Generating VAPID Keys

For web push notifications:

```bash
npx web-push generate-vapid-keys
```

Copy the public key to `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and private key to `VAPID_PRIVATE_KEY`.

## Architecture Overview

### Data Flow Patterns

The application uses **two parallel data flow patterns**:

1. **Server Actions** (`src/lib/actions/`) - Primary pattern for mutations and reads
   - Used by dashboard pages
   - Wrapped in TanStack Query for caching and invalidation
   - Direct database access via Supabase client
   - Type-safe with Zod validation

2. **REST API Routes** (`src/app/api/`) - Secondary pattern for external/mobile clients
   - Used by technician PWA (offline-first)
   - Standard HTTP endpoints with JSON responses
   - Authentication via Bearer tokens or session cookies
   - Documented in `docs/api.md`

### Order State Machine

Orders follow a strict 8-state lifecycle:

```
PENDING → ASSIGNED → EN_ROUTE → IN_PROGRESS → COMPLETED → INVOICED → PAID
                                                    ↓
                                                CANCELLED (terminal)
```

**State Transitions:**
- `PENDING → ASSIGNED`: Admin assigns technician
- `ASSIGNED → EN_ROUTE`: Technician starts travel
- `EN_ROUTE → IN_PROGRESS`: Technician arrives on-site
- `IN_PROGRESS → COMPLETED`: Technician submits service report
- `COMPLETED → INVOICED`: Admin generates final invoice
- `INVOICED → PAID`: Finance records payment
- `Any → CANCELLED`: Admin cancels order

**Special Actions:**
- **Reschedule**: Resets order to PENDING (preserves assignment)
- **Reassign**: Changes technician while in ASSIGNED state

State machine logic is centralized in `src/lib/order-status.ts` (single source of truth).

### Authentication & Authorization

**Authentication:**
- Supabase JWT auth with email/password
- Session stored in HTTP-only cookies
- Server-side verification via `createClient()` in `src/lib/supabase-server.ts`

**Authorization (RBAC):**
- 4 roles: `SUPERADMIN > ADMIN > TECHNICIAN / FINANCE`
- Role hierarchy enforced in `src/lib/rbac.ts`
- Helper functions: `isSuperAdmin()`, `isAdmin()`, `hasAccess()`
- Row-Level Security (RLS) policies in database

**Admin Client:**
- `createAdminClient()` in `src/lib/supabase-admin.ts` bypasses RLS
- Use ONLY when intentional (e.g., user creation, system operations)

### Real-time Subscriptions

Supabase Postgres Change subscriptions in `src/lib/realtime.ts`:
- **Orders**: Live status updates, assignment changes
- **Payments**: Payment recording notifications
- **Service Records**: Technician report submissions
- **Pricing**: Catalog price updates
- **SLA**: Service level agreement changes

On change, subscriptions call `queryClient.invalidateQueries()` to refresh TanStack Query cache.

## Deployment

### Docker Deployment (Production)

The application is configured for Docker deployment with `docker-compose.yml`.

**Build and Deploy:**

```bash
# 1. Build Docker image
docker compose build

# 2. Start container
docker compose up -d

# 3. Check container health
docker ps --filter name=msn-erp-v2

# 4. View logs
docker compose logs -f
```

**Container Configuration:**
- **Port**: 127.0.0.1:3001 → 3000 (internal)
- **Reverse Proxy**: Cloudflare Tunnel (v2.nufnh.my.id)
- **Health Check**: HTTP GET /api/health every 30s
- **Restart Policy**: unless-stopped

**Environment Variables:**
- Mount `.env.local` or pass via `docker-compose.yml`
- Ensure `NEXTAUTH_URL` matches your domain

### Vercel Deployment (Alternative)

1. Connect repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy (automatic on push to main)

**Vercel-Specific Configuration:**
- Set `NEXTAUTH_URL` to your Vercel domain
- Configure Vercel Cron for reminder generation (see `docs/CRON-SETUP.md`)

### Database Migrations

**Initial Setup:**

```bash
# Run migrations in order against your Supabase project
psql $POSTGRES_URL -f supabase/migrations/00_v2_schema.sql
psql $POSTGRES_URL -f supabase/migrations/01_rls_policies.sql
psql $POSTGRES_URL -f supabase/migrations/02_seed_dimensions.sql
psql $POSTGRES_URL -f supabase/migrations/03_seed_catalog_ac_service.sql
psql $POSTGRES_URL -f supabase/migrations/03_seed_catalog_addons.sql
psql $POSTGRES_URL -f supabase/migrations/03_seed_catalog_refrigerant.sql
psql $POSTGRES_URL -f supabase/migrations/03_seed_catalog_spareparts.sql
psql $POSTGRES_URL -f supabase/migrations/04_realtime.sql
psql $POSTGRES_URL -f supabase/migrations/05_identity_and_addon_requests.sql
```

**Applying New Migrations:**

```bash
# Always backup before migrating
pg_dump $POSTGRES_URL > backup_$(date +%Y%m%d).sql

# Apply new migration
psql $POSTGRES_URL -f supabase/migrations/XX_new_migration.sql
```

## API Reference

REST API endpoints are documented in [`docs/api.md`](docs/api.md).

**Key Endpoints:**
- `POST /api/auth/login` - User authentication
- `GET /api/orders` - List orders with filtering
- `POST /api/orders` - Create new order
- `PATCH /api/orders/:id` - Update order status
- `POST /api/invoices` - Generate invoice
- `POST /api/payments` - Record payment
- `GET /api/technician/jobs` - Technician job list
- `POST /api/technician/reports` - Submit service report

## Documentation

### Technical Documentation
- **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** - System architecture, data flow, state machine, database schema
- **[api.md](docs/api.md)** - REST API reference with request/response schemas
- **[STAGING.md](docs/STAGING.md)** - V2 staging deployment guide (Docker + Cloudflare)
- **[REMINDER-SYSTEM.md](docs/REMINDER-SYSTEM.md)** - Service reminder pipeline and cron setup
- **[CRON-SETUP.md](docs/CRON-SETUP.md)** - Daily reminder generation cron configuration

### Business Documentation
- **[BUSINESS-GUIDE.md](docs/BUSINESS-GUIDE.md)** - Order lifecycle, payment scenarios, do's & don'ts
- **[PRD.md](docs/PRD.md)** - Product Requirements Document (Indonesian)
- **[V1-vs-V2-comparison.md](docs/V1-vs-V2-comparison.md)** - Feature comparison for QA/stakeholders

### Design Documentation
- **[PRODUCT.md](PRODUCT.md)** - User personas, brand personality, design principles
- **[DESIGN.md](DESIGN.md)** - Design tokens (colors, typography, spacing, shadows)

## Troubleshooting

### Common Issues

**Issue: "Failed to fetch" errors in browser**
- Check Supabase URL and anon key in `.env.local`
- Verify Supabase project is active (not paused)
- Check browser console for CORS errors

**Issue: Orders not updating in real-time**
- Verify Supabase Realtime is enabled for `orders` table
- Check `docs/ARCHITECTURE.md` for realtime subscription setup
- Inspect browser console for subscription errors

**Issue: Technician push notifications not working**
- Generate VAPID keys: `npx web-push generate-vapid-keys`
- Add keys to `.env.local`
- Re-subscribe in technician profile page
- Check service worker registration in browser DevTools

**Issue: Invoice PDF generation fails**
- Check browser console for jsPDF errors
- Verify invoice data is complete (no null values)
- Try reducing invoice item count (large invoices may timeout)

**Issue: Database migration fails**
- Check migration order (run in sequence: 00 → 01 → 02 → 03 → 04 → 05)
- Verify Supabase connection string
- Check for existing tables (migrations are idempotent but may conflict)

**Issue: Docker container unhealthy**
- Check logs: `docker compose logs msn-erp-v2`
- Verify environment variables are set
- Check port 3001 is not in use: `lsof -i :3001`
- Restart container: `docker compose restart`

## License

Private. All rights reserved.

---

**For detailed technical documentation, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).**

**For business process guide, see [docs/BUSINESS-GUIDE.md](docs/BUSINESS-GUIDE.md).**
