# Technical Guide - AC Service Management Dashboard

## Table of Contents

1. [Introduction](#introduction)
2. [Technology Stack](#technology-stack)
3. [Architecture Overview](#architecture-overview)
4. [Data Flow Patterns](#data-flow-patterns)
5. [Order State Machine](#order-state-machine)
6. [Database Schema](#database-schema)
7. [API Patterns](#api-patterns)
8. [Authentication & Authorization](#authentication--authorization)
9. [Real-time Features](#real-time-features)
10. [Offline Architecture](#offline-architecture)
11. [Testing](#testing)
12. [Deployment](#deployment)
13. [Monitoring & Troubleshooting](#monitoring--troubleshooting)

---

## Introduction

This technical guide provides comprehensive documentation of the AC Service Management Dashboard architecture, technology stack, and implementation patterns. It is intended for developers, system administrators, and technical stakeholders.

**Target Audience:**
- Backend developers working on server actions and API routes
- Frontend developers working on React components and UI
- DevOps engineers managing deployment and infrastructure
- Technical leads reviewing architecture decisions

**Key Technical Concepts:**
- **Server Actions**: Next.js server-side functions for data mutations
- **REST API Routes**: HTTP endpoints for external/mobile clients
- **State Machine**: Strict order lifecycle with deterministic transitions
- **Clerk Auth**: External authentication with JWT + HTTP-only cookies
- **Offline-First**: IndexedDB queue for technician PWA

---

## Technology Stack

### Frontend Stack

**Framework & UI:**
- **Next.js 15** (App Router) - React framework with server-side rendering
- **React 19** - UI library with concurrent features
- **TypeScript 5** - Type-safe JavaScript with strict mode
- **Tailwind CSS 3.3** - Utility-first CSS framework
- **shadcn/ui** - Radix UI primitives with New York style, zinc base color

**State Management:**
- **TanStack Query v5** - Server state management
  - 1-minute stale time
  - No refetch on window focus
  - Optimistic updates for mutations
- **React Hook Form** - Form state management
- **Zod** - Schema validation

**Data Tables:**
- **TanStack Table v8** - Headless table library
  - Sorting, filtering, pagination
  - Column visibility, resizing
  - Server-side and client-side modes

**Charts & Visualization:**
- **Recharts** - React charting library
  - Line charts for revenue trends
  - Bar charts for order distribution
  - Pie charts for status breakdown

### Backend Stack

**Database & Auth:**
- **Supabase PostgreSQL** - Primary database
  - Postgres 15 with extensions (uuid-ossp, pgcrypto)
- **Clerk** - External authentication
  - Email/password authentication
  - Session management via HTTP-only cookies
  - Server-side: `auth()` from `@clerk/nextjs/server`
- **Supabase Realtime** - Postgres Change Data Capture (CDC)
  - WebSocket subscriptions for live updates

**API Layer:**
- **Next.js Server Actions** - Primary data access pattern
  - Type-safe, no API routes needed
  - Direct database access via Supabase client
  - Wrapped in TanStack Query for caching
- **Next.js API Routes** - Secondary pattern for external clients
  - REST endpoints with JSON responses
  - Bearer token or session cookie auth
  - Standard HTTP methods (GET, POST, PATCH, DELETE)

**Email & PDF:**
- **Resend API** - Transactional email sending
- **jsPDF** - Client-side PDF generation
- **html2canvas** - HTML to canvas conversion for PDF

### Infrastructure Stack

**Hosting:**
- **Docker** - Containerized deployment
  - Multi-stage build (builder + runner)
  - Node.js 18 Alpine base image
  - Health check endpoint (/api/health)
- **VPS** - Self-hosted on Ubuntu 22.04
  - Port: 127.0.0.1:3001 → 3000 (internal)
  - Reverse proxy: Cloudflare Tunnel
  - Domain: v2.nufnh.my.id

**Database:**
- **Supabase Cloud** - Managed PostgreSQL
  - Region: AWS ap-northeast-2 (Seoul)
  - Connection pooling enabled
  - Automatic backups (daily)

**Storage:**
- **Supabase Storage** - Object storage for files
  - Service report photos
  - Customer signatures
  - Invoice PDFs

**Monitoring:**
- **Docker health checks** - Container health monitoring
- **Supabase Dashboard** - Database metrics and logs
- **Next.js built-in logging** - Application logs

---

## Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Layer                             │
├─────────────────────────────────────────────────────────────┤
│  Admin Dashboard (Next.js)    │  Technician PWA (Next.js)   │
│  - Order management            │  - Job list                 │
│  - Customer management         │  - Service reports          │
│  - Invoicing                   │  - Offline queue            │
└─────────────────┬───────────────┴──────────────┬────────────┘
                  │                               │
                  │ Server Actions                │ REST API
                  │ (Primary)                     │ (Secondary)
                  ↓                               ↓
┌─────────────────────────────────────────────────────────────┐
│                   Application Layer                          │
├─────────────────────────────────────────────────────────────┤
│  Next.js Server (Node.js 18)                                │
│  - src/lib/actions/ (Server Actions)                        │
│  - src/app/api/ (REST API Routes)                           │
│  - Supabase Client (service role key)                       │
│  - Clerk Auth (JWT session)                                 │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  │ SQL Queries
                  ↓
┌─────────────────────────────────────────────────────────────┐
│                     Data Layer                               │
├─────────────────────────────────────────────────────────────┤
│  Supabase PostgreSQL (AWS ap-northeast-2)                   │
│  - Realtime subscriptions                                   │
│  - Storage buckets                                          │
└─────────────────────────────────────────────────────────────┘
```

### Architecture Patterns

**Layered Architecture:**
- **Presentation Layer**: React components, UI logic
- **Application Layer**: Server actions, API routes, business logic
- **Data Layer**: Supabase PostgreSQL

**Separation of Concerns:**
- **Server Actions** (`src/lib/actions/`): Domain-specific data operations (split files)
   - `orders-mutations-status.ts`, `orders-mutations-assign.ts`, `orders-mutations-schedule.ts`: Order state transitions
   - `orders-queries.ts`: Order reads
   - `invoices-create.ts`, `invoices-listing.ts`, `invoices-payments.ts`, `invoices-order.ts`: Invoice operations
   - `reminders-queue.ts`, `reminders-rules.ts`: Reminder generation and rules
   - `technicians.ts`: Technician management
   - `customers.ts`: Customer and location management
- **API Routes** (`src/app/api/`): External client endpoints
  - `/api/orders`: Order management for mobile app
  - `/api/technician`: Technician-specific endpoints
  - `/api/auth`: Authentication endpoints
- **Components** (`src/components/`): Reusable UI components
  - `ui/`: shadcn/ui primitives
  - `orders/`: Order-specific components
  - `technician/`: Technician app components

**Single Source of Truth:**
- **Order State Machine**: `src/lib/order-status.ts`
  - Canonical state definitions
  - State transition logic
  - Legacy state mapping (16 old states → 8 new states)
- **RBAC Logic**: `src/lib/rbac.ts`
  - Role hierarchy definitions
  - Permission checks
  - Access control helpers

---

## Data Flow Patterns

### Pattern 1: Server Actions (Primary)

**Use Case:** Dashboard pages, admin operations

**Flow:**
```
React Component
    ↓ (call server action)
TanStack Query Hook
    ↓ (execute on server)
Server Action (src/lib/actions/)
     ↓ (query database)
Supabase Client (service role key)
     ↓ (SQL query)
PostgreSQL Database
    ↓ (return data)
Server Action
    ↓ (return to client)
TanStack Query Cache
    ↓ (render)
React Component
```

**Example:**
```typescript
// Server Action (src/lib/actions/orders-queries.ts)
export async function getOrders(filters: OrderFilters) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('status', filters.status)
  return { data, error }
}

// React Component
import { useQuery } from '@tanstack/react-query'
import { getOrders } from '@/lib/actions/orders-queries'

function OrderList() {
  const { data } = useQuery({
    queryKey: ['orders', { status: 'PENDING' }],
    queryFn: () => getOrders({ status: 'PENDING' })
  })
  return <div>{/* render orders */}</div>
}
```

**Benefits:**
- Type-safe (TypeScript end-to-end)
- No API routes needed
- Automatic caching via TanStack Query
- Optimistic updates supported

### Pattern 2: REST API Routes (Secondary)

**Use Case:** Technician PWA, external clients, offline-first operations

**Flow:**
```
Mobile App (PWA)
    ↓ (HTTP request)
API Route (src/app/api/)
    ↓ (verify auth)
Auth Middleware
    ↓ (execute business logic)
API Route Handler
    ↓ (query database)
Supabase Client
    ↓ (SQL query)
PostgreSQL Database
    ↓ (return data)
API Route Handler
    ↓ (JSON response)
Mobile App (PWA)
```

**Example:**
```typescript
// API Route (src/app/api/orders/route.ts)
import { getAuth } from '@clerk/nextjs/server'

export async function GET(request: NextRequest) {
  const { userId } = getAuth(request)
  if (!userId) return unauthorizedResponse()
  
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('technician_id', userId)
  return jsonSuccess(data)
}

// Mobile App
const response = await fetch('/api/orders', {
  headers: { 'Authorization': `Bearer ${clerkToken}` }
})
const { data } = await response.json()
```

**Benefits:**
- Standard HTTP interface
- Works offline (queued requests)
- External client support
- Bearer token auth

---

## AC Completion Contract

### Source of Truth

The AC source is determined by `order_items.ac_unit_id`:

| `ac_unit_id` | Meaning | Behavior |
|---|---|---|
| Non-null (links to `ac_units`) | Existing AC unit | Identity fields pre-filled from DB |
| `null` | New AC (added during service) | All identity fields editable |

### Branching Behavior per AC Unit

The `AcUnitForm` component branches on AC source:

```
order_items.ac_unit_id
  ├── non-null → existing AC
  │     ├── ac_units.brand, model_number, etc. ALL non-null → READ-ONLY ✓
  │     └── any identity field null → WARNING + FILL MISSING ONLY
  └── null → new AC → ALL identity fields editable (brand, model, serial, type, PK)
```

**Key files:**
- Branching logic: `src/components/technician/ac-unit-form.tsx`
- Orchestration (3-phase wizard):
  - `src/components/technician/wizard-phase-a.tsx` — Foto Before + AC Identity
  - `src/components/technician/wizard-phase-b.tsx` — Timer with blocking
  - `src/components/technician/wizard-phase-c.tsx` — Detail entry + Foto After + Signature + Submit
- Draft guard: `hasRestoredRef` prevents fetched job context from overwriting saved drafts

### Backend Enforcement (RPC)

The `technician_submit_report_v2()` PostgreSQL function enforces:
- **Existing AC**: identity fields from payload are IGNORED — only DB values used
- **New AC**: identity fields must be non-empty
- **Idempotency**: re-submit returns existing report_id (no duplicates)
- **Status guard**: only allows transition `IN_PROGRESS → COMPLETED`

### Addon Catalog Linkage

- Catalog items: `addon_id` preserved in payload → `service_records.materials`
- Manual items (not in catalog): pending addon request created via `createPendingAddonRequest()`
- Request validation: handled by `material-input.tsx` (client) + `addon-requests.ts` (server action)

---

## Order State Machine

### State Definitions

**8 Canonical States:**
```typescript
type OrderStatus =
  | 'PENDING'      // Created, awaiting assignment
  | 'ASSIGNED'     // Technician assigned, awaiting dispatch
  | 'EN_ROUTE'     // Technician traveling to location
  | 'IN_PROGRESS'  // Service in progress
  | 'COMPLETED'    // Service completed, awaiting invoice
  | 'INVOICED'     // Invoice generated, awaiting payment
  | 'PAID'         // Payment received, order closed
  | 'CANCELLED'    // Order cancelled (terminal)
```

### State Transition Logic

**Implementation:** `src/lib/order-status.ts`

```typescript
// Allowed transitions (deterministic)
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['ASSIGNED', 'CANCELLED'],
  ASSIGNED: ['EN_ROUTE', 'CANCELLED'],
  EN_ROUTE: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: ['INVOICED', 'CANCELLED'],
  INVOICED: ['PAID', 'CANCELLED'],
  PAID: [],  // Terminal state
  CANCELLED: []  // Terminal state
}

// Validation function
export function canTransition(
  from: OrderStatus,
  to: OrderStatus
): boolean {
  return TRANSITIONS[from].includes(to)
}
```

**Transition Rules:**
1. **PENDING → ASSIGNED**: Admin assigns technician
   - Requires: `technician_id` not null
   - Triggers: Push notification to technician
   - Updates: `assigned_at` timestamp

2. **ASSIGNED → EN_ROUTE**: Technician starts travel
   - Requires: Technician authenticated
   - Triggers: Real-time update to admin dashboard
   - Updates: `en_route_at` timestamp

3. **EN_ROUTE → IN_PROGRESS**: Technician arrives on-site
   - Requires: Technician authenticated
   - Triggers: Real-time update to admin dashboard
   - Updates: `in_progress_at` timestamp

4. **IN_PROGRESS → COMPLETED**: Technician submits service report
   - Requires: Service report with photos, materials, signature
   - Triggers: Admin notification
   - Updates: `completed_at` timestamp, service report data

5. **COMPLETED → INVOICED**: Admin generates final invoice
   - Requires: Service report reviewed
   - Triggers: Invoice creation
   - Updates: `invoiced_at` timestamp, `invoice_id`

6. **INVOICED → PAID**: Finance records payment
   - Requires: Payment amount matches invoice total
   - Triggers: Order closure notification
   - Updates: `paid_at` timestamp, payment records

7. **Any → CANCELLED**: Admin cancels order
   - Requires: Cancellation reason
   - Triggers: Technician notification (if assigned)
   - Updates: `cancelled_at` timestamp, `cancellation_reason`

### Special Actions

**Reschedule:**
- **Purpose**: Change service date without changing technician
- **Current State**: Any state except PAID, CANCELLED
- **Action**: Resets order to PENDING
- **Preserves**: Technician assignment (`technician_id`)
- **Updates**: `scheduled_date`, `reschedule_reason`
- **Triggers**: Technician notification of new date
- **Use Case**: Customer requests date change, weather delay, technician unavailable

**Reassign:**
- **Purpose**: Change technician without changing date
- **Current State**: ASSIGNED only (before technician starts travel)
- **Action**: Updates `technician_id`
- **Updates**: `technician_id`, `reassignment_reason`
- **Triggers**: Notifications to both technicians (old and new)
- **Use Case**: Technician requests transfer, customer requests specific technician

---

## Database Schema

### Core Tables

**orders:**
```sql
CREATE TABLE orders (
  order_id          TEXT PRIMARY KEY DEFAULT ('ORD-' || to_char(floor(random() * 10000), 'FM0000')),
  customer_id       TEXT NOT NULL REFERENCES customers(customer_id),
  location_id       TEXT NOT NULL REFERENCES locations(location_id),
  ac_unit_id        TEXT REFERENCES ac_units(ac_unit_id),
  technician_id     TEXT REFERENCES technicians(technician_id),
  status            order_status NOT NULL DEFAULT 'PENDING',
  service_type      TEXT NOT NULL,
  scheduled_date    TIMESTAMPTZ NOT NULL,
  assigned_at       TIMESTAMPTZ,
  en_route_at       TIMESTAMPTZ,
  in_progress_at    TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  invoiced_at       TIMESTAMPTZ,
  paid_at           TIMESTAMPTZ,
  cancelled_at      TIMESTAMPTZ,
  cancellation_reason TEXT,
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);
```

**invoices:**
```sql
CREATE TABLE invoices (
  invoice_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          TEXT REFERENCES orders(order_id),
  invoice_number    TEXT UNIQUE NOT NULL,
  invoice_type      invoice_type NOT NULL, -- 'PROFORMA' or 'FINAL'
  status            invoice_status NOT NULL DEFAULT 'DRAFT',
  total_amount      NUMERIC(12,2) NOT NULL,
  paid_amount       NUMERIC(12,2) DEFAULT 0,
  due_date          DATE,
  payment_terms     TEXT,
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);
```

**service_reports:**
```sql
CREATE TABLE service_reports (
  report_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          TEXT UNIQUE REFERENCES orders(order_id),
  technician_id     TEXT REFERENCES technicians(technician_id),
  service_findings  TEXT,
  ac_condition      TEXT,
  recommendations   TEXT,
  next_service_due_date DATE,
  photos_before     TEXT[], -- Array of storage URLs
  photos_after      TEXT[], -- Array of storage URLs
  signature_url     TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);
```

**technicians:**
```sql
CREATE TABLE technicians (
  technician_id     TEXT PRIMARY KEY DEFAULT ('TECH' || lpad(nextval('technician_id_seq')::text, 4, '0')),
  technician_name   VARCHAR NOT NULL,
  company           VARCHAR,
  contact_number    VARCHAR,
  email             VARCHAR,
  auth_user_id      UUID UNIQUE REFERENCES auth.users(id),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);
```

**customers:**
```sql
CREATE TABLE customers (
  customer_id       TEXT PRIMARY KEY DEFAULT ('CS-' || to_char(floor(random() * 10000), 'FM0000')),
  customer_name     VARCHAR NOT NULL,
  primary_contact_person VARCHAR,
  email             VARCHAR,
  phone_number      VARCHAR,
  billing_address   TEXT,
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);
```

**user_management:**
```sql
CREATE TABLE user_management (
  user_id           TEXT PRIMARY KEY DEFAULT ('MSN' || lpad(nextval('user_id_seq')::text, 4, '0')),
  full_name         VARCHAR NOT NULL,
  email             VARCHAR NOT NULL,
  role              role_type NOT NULL, -- 'SUPERADMIN', 'ADMIN', 'TECHNICIAN', 'FINANCE'
  is_active         BOOLEAN DEFAULT TRUE,
  photo_url         TEXT,
  auth_user_id      UUID UNIQUE REFERENCES auth.users(id),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);
```

### Enums

```sql
CREATE TYPE order_status AS ENUM (
  'PENDING', 'ASSIGNED', 'EN_ROUTE', 'IN_PROGRESS',
  'COMPLETED', 'INVOICED', 'PAID', 'CANCELLED'
);

CREATE TYPE role_type AS ENUM (
  'SUPERADMIN', 'ADMIN', 'TECHNICIAN', 'FINANCE'
);

CREATE TYPE invoice_type AS ENUM ('PROFORMA', 'FINAL');
CREATE TYPE invoice_status AS ENUM ('DRAFT', 'PENDING', 'PAID', 'CANCELLED');
```

---

## API Patterns

### Response Format

All API routes return consistent JSON responses:

**Success Response:**
```typescript
{
  success: true,
  data: T,
  message?: string,
  pagination?: {
    total: number,
    page: number,
    limit: number,
    totalPages: number
  }
}
```

**Error Response:**
```typescript
{
  success: false,
  error: string,
  message?: string
}
```

### Helper Functions

**Implementation:** `src/app/api/utils.ts`

```typescript
// Data-shape helpers
export const successResponse = <T,>(data: T, pagination?) => ({
  success: true, data, ...(pagination && { pagination })
})
export const errorResponse = (error: string | Error, message?: string) => ({
  success: false, error: error instanceof Error ? error.message : error
})

// HTTP response helpers (return NextResponse.json)
export const jsonSuccess = <T,>(data: T, status = 200, pagination?) => { ... }
export const jsonError = (error: string | Error, status = 400, message?) => { ... }
export const handleApiError = (error: unknown) => { ... }
export const unauthorizedResponse = () => jsonError('Unauthorized...', 401)
export const forbiddenResponse = () => jsonError('Forbidden...', 403)
export const notFoundResponse = (resource: string) => jsonError(`${resource} not found`, 404)
```

### Authentication Middleware

**Implementation:** `src/app/api/middleware/auth.ts`

```typescript
import { getAuth } from '@clerk/nextjs/server'

export async function verifyAuth(request: NextRequest) {
  const { userId } = getAuth(request)
  if (!userId) return unauthorizedResponse()
  return { id: userId }
}

// Role check via user_management table
export async function checkRole(request: NextRequest, requiredRoles: string[]) {
  const { userId } = getAuth(request)
  if (!userId) return false

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('user_management')
    .select('role')
    .eq('auth_user_id', userId)
    .maybeSingle()

  if (error || !data?.role) return false
  return requiredRoles.includes(data.role)
}
```

### Example API Endpoints

**GET /api/orders:**
```typescript
export async function GET(request: NextRequest) {
  try {
    const { userId } = getAuth(request)
    if (!userId) return unauthorizedResponse()
    
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const supabase = await createClient()
    
    let query = supabase.from('orders').select('*')
    if (status) query = query.eq('status', status)
    
    const { data, error } = await query
    if (error) return jsonError(error.message)
    
    return jsonSuccess(data)
  } catch (error) {
    return jsonError('Unauthorized', 401)
  }
}
```

**POST /api/orders:**
```typescript
export async function POST(request: NextRequest) {
  try {
    const { userId } = getAuth(request)
    if (!userId) return unauthorizedResponse()
    
    const body = await request.json()
    const validated = createOrderSchema.parse(body)
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('orders')
      .insert(validated)
      .select()
      .single()
    
    if (error) return jsonError(error.message)
    
    return jsonSuccess(data, 201)
  } catch (error) {
    return jsonError((error as { message?: string })?.message || 'Bad request', 400)
  }
}
```

---

## Authentication & Authorization

### Authentication Flow

**Clerk JWT-Based Authentication:**
1. User logs in with email/password via Clerk sign-in page (`/sign-in`)
2. Clerk generates JWT token and manages session
3. Token stored in HTTP-only cookie (secure)
4. Token included in all requests (cookie or Bearer header)
5. Server verifies token via `auth()` from `@clerk/nextjs/server`

**Server-side auth pattern:**
```typescript
// src/lib/supabase-server.ts
import { auth } from '@clerk/nextjs/server'

export async function getUser() {
  const { userId } = await auth()
  if (!userId) return null

  const client = await createClient()
  const { data, error } = await client
    .from('user_management')
    .select('auth_user_id,email,full_name,role,is_active')
    .eq('auth_user_id', userId)
    .maybeSingle()

  if (error || !data) return null
  return { id: userId, email: data.email }
}

export async function getUserRole() {
  const { userId } = await auth()
  if (!userId) return null

  const client = await createClient()
  const { data, error } = await client
    .from('user_management')
    .select('role')
    .eq('auth_user_id', userId)
    .maybeSingle()

  if (error) return null
  return data?.role
}
```

**API route auth pattern:**
```typescript
// src/app/api/middleware/auth.ts
import { getAuth } from '@clerk/nextjs/server'

export async function verifyAuth(request: NextRequest) {
  const { userId } = getAuth(request)
  if (!userId) return unauthorizedResponse()
  return { id: userId }
}
```

### Authorization (RBAC)

**Role Hierarchy:**
```
SUPERADMIN (highest)
    ↓
  ADMIN
    ↓
TECHNICIAN / FINANCE (equal level)
```

**Permission Matrix:**

| Action | SUPERADMIN | ADMIN | TECHNICIAN | FINANCE |
|--------|------------|-------|------------|---------|
| Create users | ✅ | ❌ | ❌ | ❌ |
| Create orders | ✅ | ✅ | ❌ | ❌ |
| Assign orders | ✅ | ✅ | ❌ | ❌ |
| Update job status | ✅ | ✅ | ✅ | ❌ |
| Submit service report | ✅ | ✅ | ✅ | ❌ |
| Generate invoices | ✅ | ✅ | ❌ | ❌ |
| Record payments | ✅ | ✅ | ❌ | ✅ |
| View all orders | ✅ | ✅ | ❌ | ✅ |
| View assigned orders | ✅ | ✅ | ✅ | ❌ |

**RBAC Helpers:** `src/lib/rbac.ts`

```typescript
export async function isSuperAdmin(): Promise<boolean> {
  const role = await getUserRole()
  return role === 'SUPERADMIN'
}

export async function isAdmin(): Promise<boolean> {
  const role = await getUserRole()
  return role === 'ADMIN' || role === 'SUPERADMIN'
}

export async function isFinance(): Promise<boolean> {
  const role = await getUserRole()
  return role === 'FINANCE' || role === 'SUPERADMIN'
}

export function hasAccess(userRole: UserRole | null, requiredRole: UserRole): boolean {
  if (!userRole) return false
  const allowedRoles: Record<UserRole, UserRole[]> = {
    SUPERADMIN: ['SUPERADMIN'],
    ADMIN: ['SUPERADMIN', 'ADMIN'],
    TECHNICIAN: ['SUPERADMIN', 'ADMIN', 'TECHNICIAN'],
    FINANCE: ['SUPERADMIN', 'ADMIN', 'FINANCE'],
  }
  return allowedRoles[requiredRole].includes(userRole)
}
```

---

## Real-time Features

### Supabase Realtime Subscriptions

**Implementation:** `src/lib/realtime.ts`

**Order Status Updates:**
```typescript
export function subscribeToOrders(queryClient: QueryClient) {
  const supabase = createClient()
  
  const channel = supabase
    .channel('orders-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'orders'
      },
      (payload) => {
        // Invalidate orders query cache
        queryClient.invalidateQueries({ queryKey: ['orders'] })
      }
    )
    .subscribe()
  
  return () => {
    supabase.removeChannel(channel)
  }
}
```

**Payment Updates:**
```typescript
export function subscribeToPayments(queryClient: QueryClient) {
  const supabase = createClient()
  
  const channel = supabase
    .channel('payments-changes')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'payments'
      },
      (payload) => {
        queryClient.invalidateQueries({ queryKey: ['invoices'] })
        queryClient.invalidateQueries({ queryKey: ['orders'] })
      }
    )
    .subscribe()
  
  return () => {
    supabase.removeChannel(channel)
  }
}
```

**Usage in React:**
```typescript
function OrdersPage() {
  const queryClient = useQueryClient()
  
  useEffect(() => {
    const unsubscribe = subscribeToOrders(queryClient)
    return unsubscribe
  }, [queryClient])
  
  // Component renders with live data
}
```

---

## Offline Architecture

### Technician PWA Offline-First Strategy

**IndexedDB Queue:**

The technician mobile app uses IndexedDB to queue operations when offline.

**Implementation:** Service worker at `public/technician-sw.js`

**Queue Structure:**
```typescript
interface QueuedRequest {
  id: string
  url: string
  method: string
  body: any
  timestamp: number
  retryCount: number
}
```

**Sync Strategy:**
1. **Offline Detection**: App detects network status via `navigator.onLine`
2. **Queue Operations**: Failed requests stored in IndexedDB
3. **Background Sync**: Service worker syncs queue when online
4. **Retry Logic**: Exponential backoff for failed syncs
5. **Conflict Resolution**: Last-write-wins for conflicts

**Error Handling (422/403):**

File: `src/lib/offline/sync-manager.ts`

When the sync manager encounters a 422 or 403 response from the server, the queued report is now marked with a `needs-attention` status instead of being deleted. This prevents data loss when the server rejects a submission due to validation errors or permission issues. Technicians can see these reports in the UI and contact admin to resolve state conflicts manually.

**Persistent Work Timer:**

File: `src/lib/offline/timer.ts`

Technician work sessions are tracked using a persistent timer stored in localStorage:

```typescript
// Storage key pattern
const TIMER_KEY = `msn-tech-timer-${jobId}`

// Stored value
localStorage.setItem(TIMER_KEY, new Date().toISOString())
```

The timer survives page refreshes, app closures, and phone restarts. Only one active timer is allowed at a time (attempting to start a second job is blocked). During Phase B of the wizard, the UI reads the stored timestamp and calculates elapsed time, blocking progression until the minimum required duration is met. The timer is cleared from localStorage when the service report is successfully submitted.

**Service Worker Registration:**
```typescript
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/technician-sw.js')
}
```

**Queuing Failed Requests:**
```typescript
async function queueRequest(url: string, options: RequestInit) {
  const db = await openDB('offline-queue')
  await db.add('requests', {
    id: crypto.randomUUID(),
    url,
    method: options.method,
    body: options.body,
    timestamp: Date.now(),
    retryCount: 0
  })
}
```

**Background Sync:**
```typescript
self.addEventListener('sync', async (event) => {
  if (event.tag === 'sync-queue') {
    event.waitUntil(syncQueue())
  }
})

async function syncQueue() {
  const db = await openDB('offline-queue')
  const requests = await db.getAll('requests')
  
  for (const req of requests) {
    try {
      await fetch(req.url, {
        method: req.method,
        body: req.body
      })
      await db.delete('requests', req.id)
    } catch (error) {
      req.retryCount++
      await db.put('requests', req)
    }
  }
}
```

---

## Technician PWA Design

### 3-Phase Wizard Flow

The technician service completion workflow uses a 3-phase wizard structure:

**Phase A** (`wizard-phase-a.tsx`):
- Capture "before" photos
- Enter AC unit identity (brand, model, serial number, PK per unit)
- Branching behavior based on `order_items.ac_unit_id` (existing vs new AC)

**Phase B** (`wizard-phase-b.tsx`):
- Timer display with blocking mechanism
- Technicians must complete minimum required work duration before proceeding
- Timer persists across page refresh and app restarts

**Phase C** (`wizard-phase-c.tsx`):
- Detail entry (materials used, addons, notes)
- Capture "after" photos
- Digital signature
- Submit service report

**Job Detail Flow:**

The "Mulai Kerja" (Start Work) button now captures GPS coordinates immediately without an arrival photo modal. The flow is:

```
Click "Mulai Kerja" → GPS capture → transition to IN_PROGRESS → open Phase A
```

**Swipe-to-Action:**

File: `src/components/technician/swipe-to-action.tsx`

Swipe gestures are used only for the ASSIGNED → EN_ROUTE transition ("Berangkat" / departure). All other state transitions use regular buttons for clarity and reliability.

### Dark Mode

The technician PWA has its own dark mode implementation, separate from the admin dashboard:

| Aspect | Implementation |
|--------|----------------|
| Hook | `src/hooks/use-technician-theme.ts` |
| Storage | `localStorage` key: `msn-tech-theme` |
| Options | `light` / `dark` / `system` |
| CSS Variables | Defined in `globals.css` with `--tech-*` prefix |
| Scope | Only `/technician/*` routes |

**Design System:**
- Font: Lexend (loaded in technician layout)
- Color palette: Indigo Navy (`#0f0e1a` background, `#1a1833` cards)
- Touch targets: Minimum 44px for mobile accessibility

**Bottom Tab Bar:**

File: `src/components/technician/bottom-tab-bar.tsx`

The navigation bar provides 4 main tabs:
1. Home (today's jobs)
2. History (completed jobs)
3. Profile (settings, push notifications)

---

## Testing

The project has **100 test files** across two frameworks:

### Unit Tests (Vitest)

```bash
bun run test           # Run all unit tests
bun run test:ui        # Vitest UI mode
```

**Coverage areas:**
- Server actions (orders, invoices, customers, technicians, reminders, users)
- API routes (technician jobs, report RPC contract)
- Components (material-input, dashboard widgets, catalog)
- Utility functions (order-utils, dashboard-data, auth-guards)
- Form validation schemas
- Invoice creation flow

### E2E Tests (Playwright)

```bash
bun run test:e2e             # Headless
bun run test:e2e:headed      # Visible browser
bun run test:e2e:ui          # Playwright UI mode
bun run test:qa              # QA smoke tests
bun run test:qa:happy        # Happy path only
```

**Key test files for AC Completion Contract:**
| File | What it tests |
|------|--------------|
| `src/app/api/technician/jobs/[...id]/route.test.ts` | Full API route: AC identity hydration, transition state guards, payload validation |
| `src/app/api/technician/jobs/[...id]/report-rpc-contract.test.ts` | RPC fixture validation: existing complete (read-only), existing incomplete (fill missing), new AC (full input) |
| `src/components/technician/ac-completion-contract.test.ts` | Component-level branching: read-only vs editable identity fields |
| `src/components/technician/material-input.test.tsx` | Addon catalog linkage + manual addon request creation |
| `src/lib/actions/addon-requests.test.ts` | Server-side addon request workflow |

### Type Safety Gate

```bash
bun run type-check    # tsc --noEmit — must pass before deployment
```

---

## Deployment

### Docker Deployment

**Build and Deploy:**
```bash
# 1. Build Docker image
docker compose build

# 2. Start container
docker compose up -d

# 3. Check container status
docker ps --filter name=msn-erp-v2

# 4. View logs
docker compose logs -f msn-erp-v2

# 5. Restart container
docker compose restart msn-erp-v2

# 6. Stop container
docker compose down
```

**Health Check:**
```bash
# Check container health
docker inspect msn-erp-v2 --format='{{.State.Health.Status}}'

# Test health endpoint
curl http://127.0.0.1:3001/api/health
```

**Environment Setup:**
```bash
# Copy environment template
cp .env.example .env.local

# Edit environment variables
nano .env.local

# Rebuild with new environment
docker compose up -d --build
```

### Database Migrations

**Apply Migrations (all 17 files in order):**
```bash
for f in supabase/migrations/*.sql; do
  psql $POSTGRES_URL -f "$f"
done
```

Or individually:
```bash
psql $POSTGRES_URL -f supabase/migrations/00_v2_schema.sql
# ...through 09_technician_submit_report_rpc.sql
```

---

## Monitoring & Troubleshooting

### Common Technical Issues

**Issue: Container fails to start**

**Symptoms:**
- Docker container exits immediately
- Health check fails
- Port 3001 not accessible

**Solutions:**
1. Check logs: `docker compose logs msn-erp-v2`
2. Verify environment variables in `.env.local`
3. Check port 3001 is not in use: `lsof -i :3001`
4. Rebuild image: `docker compose up -d --build`

---

**Issue: Database connection fails**

**Symptoms:**
- "Failed to connect to database" errors
- Supabase queries timeout

**Solutions:**
1. Verify `POSTGRES_URL` in environment
2. Check Supabase project is active (not paused)
3. Test connection: `psql $POSTGRES_URL -c "SELECT 1"`
4. Verify `SUPABASE_SERVICE_ROLE_KEY` is correct

---

**Issue: Real-time subscriptions not working**

**Symptoms:**
- Orders not updating in real-time
- Kanban board not refreshing
- No live updates on dashboard

**Solutions:**
1. Verify Supabase Realtime is enabled for tables
2. Check WebSocket connection in browser DevTools
3. Verify subscription code in `src/lib/realtime.ts`
4. Check for subscription errors in console

---

**Issue: Technician push notifications not working**

**Symptoms:**
- Technicians not receiving job assignments
- No push notifications on mobile
- Service worker not registered

**Solutions:**
1. Verify VAPID keys in environment variables
2. Check service worker registration: `navigator.serviceWorker.ready`
3. Verify notification permission: `Notification.permission`
4. Re-subscribe in technician profile page

---

## Conclusion

This technical guide provides comprehensive documentation of the AC Service Management Dashboard architecture, technology stack, and implementation patterns.

**Key Technical Highlights:**

1. **Dual Data Flow**: Server Actions (primary) + REST API (secondary)
2. **State Machine**: Strict 8-state order lifecycle with deterministic transitions
3. **RBAC**: Role-based access control via `user_management` table + Clerk auth
4. **Real-time**: Supabase Postgres Change subscriptions for live updates
5. **Offline-First**: IndexedDB queue for technician PWA
6. **AC Completion Contract**: Source-of-truth `order_items.ac_unit_id` drives per-AC branching — existing complete (read-only), existing incomplete (fill missing), new AC (full input). Enforced via `technician_submit_report_v2()` RPC.
7. **Test Suite**: 100 Vitest unit tests + Playwright E2E, `tsc --noEmit` type gate

**For Business Documentation:**
- See [BUSINESS-GUIDE.md](BUSINESS-GUIDE.md) for order lifecycle and payment scenarios

**For Quick Start:**
- See [README.md](../README.md) for installation and setup

**For API Reference:**
- See [api.md](api.md) for REST endpoint documentation

---

**Document Version:** 1.2  
**Last Updated:** 2026-06-30  
**Maintained By:** Engineering Team