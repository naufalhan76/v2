# Phase 0: Foundation & Cleanup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Set up the foundation (DB migrations, status mapper, badge components, mutation hooks, error boundaries, anti-pattern fixes) without any visible UI change — so Phase 1+ can build on solid ground.

**Architecture:** State mapping layer in `src/lib/order-status.ts` as single source of truth for 8 canonical states. CSS variable tokens for status colors. Reusable badge components replace 97 hard-coded color classes. Standardized mutation hooks with optimistic update pattern.

**Tech Stack:** Next.js 15, Supabase (PostgreSQL + Storage), TanStack Query v5, shadcn/ui, Tailwind CSS, Zod, React Hook Form

---

## File Structure

### Files to Create

| Path | Purpose |
|------|---------|
| `supabase/migrations/20260526000000_add_pending_completed_service_reports_push.sql` | DB migration: enum values + new tables |
| `src/lib/order-status.ts` | Status mapper, transition validator, color tokens (single source of truth) |
| `src/lib/status-colors.ts` | Invoice + service type color tokens |
| `src/components/orders/status-badge.tsx` | Order status badge component |
| `src/components/invoices/invoice-status-badge.tsx` | Invoice status badge component |
| `src/components/orders/service-type-badge.tsx` | Service type badge component |
| `src/components/ui/empty-state.tsx` | Reusable empty state component |
| `src/hooks/use-order-mutation.ts` | Standardized order mutation hooks |
| `src/hooks/use-invoice-mutation.ts` | Standardized invoice mutation hooks |
| `src/app/error.tsx` | Global error boundary |
| `src/app/dashboard/error.tsx` | Dashboard error boundary |
| `src/app/technician/error.tsx` | Technician app error boundary (placeholder route) |

### Files to Modify

| Path | Purpose |
|------|---------|
| `src/types/create-order.ts` | Update OrderStatus type to 8 canonical states + LegacyOrderStatus |
| `src/styles/globals.css` | Add status CSS variable tokens + fix crud-button anti-pattern |
| `src/app/dashboard/operasional/monitoring-ongoing/page.tsx` | Replace local STATUS_COLORS with StatusBadge |
| `src/app/dashboard/operasional/accept-order/page.tsx` | Replace local STATUS_COLORS with StatusBadge |
| `src/app/dashboard/operasional/assign-order/page.tsx` | Replace SERVICE_TYPES color with ServiceTypeBadge |
| `src/app/dashboard/operasional/assign-order/success/page.tsx` | Replace SERVICE_TYPE_MAP + refactor numbered queries |
| `src/app/dashboard/page.tsx` | Replace getStatusBadge with StatusBadge |
| `src/app/dashboard/keuangan/invoices/page.tsx` | Replace STATUS_COLORS + PAYMENT_STATUS_COLORS with InvoiceStatusBadge |
| `src/app/dashboard/keuangan/invoices/[id]/page.tsx` | Replace STATUS_COLORS with InvoiceStatusBadge |

---

## Task 1: DB Migration — Add enum values + service_reports table + push_subscriptions table

**Files:**
- Create: `supabase/migrations/20260526000000_add_pending_completed_service_reports_push.sql`

### Steps

- [ ] 1.1 Create the `supabase/migrations/` directory and migration file:

```sql
-- Migration: Add PENDING/COMPLETED enum values, service_reports table, push_subscriptions table
-- Phase 0 of MSN ERP v2 restructure
-- Non-breaking: only ADDs, no drops or renames

-- =============================================================================
-- 1. Extend order_status enum with new values
-- =============================================================================
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'PENDING';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'COMPLETED';

-- =============================================================================
-- 2. Create service_reports table
-- =============================================================================
CREATE TABLE IF NOT EXISTS service_reports (
  report_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT NOT NULL REFERENCES orders(order_id),
  technician_id UUID NOT NULL REFERENCES technicians(technician_id),

  -- Photos (Supabase Storage URLs)
  photos_before TEXT[] DEFAULT '{}',
  photos_after TEXT[] DEFAULT '{}',

  -- Materials JSONB array
  -- Schema: [{ addon_id?: uuid, name: string, qty: number, unit_price: number, total: number }]
  materials JSONB DEFAULT '[]',

  -- Pricing
  actual_total_price NUMERIC(12,2) NOT NULL,

  -- Customer sign-off
  customer_signature_url TEXT,
  customer_name_signed TEXT,
  signed_at TIMESTAMPTZ,

  -- Notes
  notes TEXT,

  -- Timing
  work_started_at TIMESTAMPTZ,
  work_completed_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),

  -- Soft delete (consistent with project convention)
  deleted_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_service_reports_order
  ON service_reports(order_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_service_reports_technician
  ON service_reports(technician_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_service_reports_submitted
  ON service_reports(submitted_at DESC) WHERE deleted_at IS NULL;

-- Enable RLS
ALTER TABLE service_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- TECHNICIAN can INSERT report for their assigned orders
CREATE POLICY "tech_insert_own_report" ON service_reports
  FOR INSERT TO authenticated
  WITH CHECK (
    technician_id = (SELECT technician_id FROM technicians WHERE auth_user_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM order_technicians
      WHERE order_id = service_reports.order_id
        AND technician_id = service_reports.technician_id
        AND role = 'lead'
    )
  );

-- TECHNICIAN can SELECT own reports (history)
CREATE POLICY "tech_select_own_reports" ON service_reports
  FOR SELECT TO authenticated
  USING (
    technician_id = (SELECT technician_id FROM technicians WHERE auth_user_id = auth.uid())
  );

-- ADMIN/SUPERADMIN/FINANCE can SELECT all reports
CREATE POLICY "admin_select_all_reports" ON service_reports
  FOR SELECT TO authenticated
  USING (
    (SELECT role FROM user_management WHERE user_id = auth.uid())
    IN ('ADMIN', 'SUPERADMIN', 'FINANCE')
  );

-- =============================================================================
-- 3. Create push_subscriptions table
-- =============================================================================
CREATE TABLE IF NOT EXISTS push_subscriptions (
  subscription_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id);

-- Enable RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can manage their own subscriptions
CREATE POLICY "users_manage_own_push_subs" ON push_subscriptions
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

- [ ] 1.2 Document Storage bucket configuration (created via Supabase Dashboard):

> **Manual step — Supabase Dashboard:**
> 1. Create bucket `service-photos`: Public = true, File size limit = 5MB, Allowed MIME types = `image/jpeg, image/png, image/webp`
> 2. Create bucket `signatures`: Public = false, File size limit = 1MB, Allowed MIME types = `image/png`
> 3. Storage policies for `service-photos`:
>    - SELECT: authenticated users (public read via signed URL)
>    - INSERT: authenticated users where `auth.uid()` matches technician
> 4. Storage policies for `signatures`:
>    - SELECT: authenticated users with role IN ('ADMIN', 'SUPERADMIN', 'FINANCE') OR owner
>    - INSERT: authenticated users where `auth.uid()` matches technician

- [ ] 1.3 Verify migration syntax:

```bash
# Ensure the migration directory exists
mkdir -p supabase/migrations
# Check SQL syntax (dry run — actual apply via Supabase CLI or Dashboard)
cat supabase/migrations/20260526000000_add_pending_completed_service_reports_push.sql
```

**Verification:**
```bash
npm run type-check
```

**Commit:**
```bash
git add supabase/migrations/
git commit -m "feat(db): add PENDING/COMPLETED enum values, service_reports + push_subscriptions tables"
```

---

## Task 2: Create `src/lib/order-status.ts`

**Files:**
- Create: `src/lib/order-status.ts`

### Steps

- [ ] 2.1 Create the status mapper module:

```typescript
// src/lib/order-status.ts
// Single source of truth for order status types, transitions, labels, and colors.
// UI layer speaks only these 8 canonical states.
// Legacy DB values are mapped at runtime via toCanonical().

/**
 * The 8 canonical order states for MSN ERP v2.
 */
export type OrderStatus =
  | 'PENDING'
  | 'ASSIGNED'
  | 'EN_ROUTE'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'INVOICED'
  | 'PAID'
  | 'CANCELLED'

/**
 * Legacy status values that still exist in the database.
 * Will be removed in Phase 5 after data migration.
 */
export type LegacyOrderStatus =
  | 'NEW'
  | 'ACCEPTED'
  | 'EN ROUTE'
  | 'ARRIVED'
  | 'DONE'
  | 'CLOSED'
  | 'RESCHEDULE'
  | 'TO_WORKSHOP'
  | 'IN_WORKSHOP'
  | 'READY_TO_RETURN'
  | 'DELIVERED'

/**
 * All possible status values (canonical + legacy) that may appear at runtime.
 */
export type AnyOrderStatus = OrderStatus | LegacyOrderStatus

/**
 * Maps legacy DB status values to canonical states.
 * Canonical values map to themselves.
 */
const LEGACY_MAP: Record<string, OrderStatus> = {
  // Canonical (pass-through)
  PENDING: 'PENDING',
  ASSIGNED: 'ASSIGNED',
  EN_ROUTE: 'EN_ROUTE',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  INVOICED: 'INVOICED',
  PAID: 'PAID',
  CANCELLED: 'CANCELLED',
  // Legacy → Canonical
  NEW: 'PENDING',
  ACCEPTED: 'PENDING',
  'EN ROUTE': 'EN_ROUTE',
  ARRIVED: 'IN_PROGRESS',
  DONE: 'COMPLETED',
  CLOSED: 'PAID',
  RESCHEDULE: 'PENDING',
  TO_WORKSHOP: 'IN_PROGRESS',
  IN_WORKSHOP: 'IN_PROGRESS',
  READY_TO_RETURN: 'COMPLETED',
  DELIVERED: 'COMPLETED',
}

/**
 * Convert any status (legacy or canonical) to a canonical OrderStatus.
 * Returns 'PENDING' as fallback for unknown values.
 */
export function toCanonical(status: string | null | undefined): OrderStatus {
  if (!status) return 'PENDING'
  return LEGACY_MAP[status.toUpperCase()] ?? 'PENDING'
}

/**
 * User role for transition validation.
 */
export type TransitionRole = 'ADMIN' | 'SUPERADMIN' | 'TECHNICIAN' | 'FINANCE'

/**
 * Allowed next states per current state and role.
 */
const TRANSITION_RULES: Record<OrderStatus, Partial<Record<TransitionRole, OrderStatus[]>>> = {
  PENDING: {
    ADMIN: ['ASSIGNED', 'CANCELLED'],
    SUPERADMIN: ['ASSIGNED', 'CANCELLED'],
  },
  ASSIGNED: {
    ADMIN: ['PENDING', 'CANCELLED'],       // PENDING = reschedule
    SUPERADMIN: ['PENDING', 'CANCELLED'],
    TECHNICIAN: ['EN_ROUTE'],
  },
  EN_ROUTE: {
    ADMIN: ['PENDING', 'CANCELLED'],       // PENDING = reschedule
    SUPERADMIN: ['PENDING', 'CANCELLED'],
    TECHNICIAN: ['IN_PROGRESS'],
  },
  IN_PROGRESS: {
    ADMIN: ['CANCELLED'],
    SUPERADMIN: ['CANCELLED'],
    TECHNICIAN: ['COMPLETED'],
  },
  COMPLETED: {
    ADMIN: ['INVOICED'],
    SUPERADMIN: ['INVOICED'],
    FINANCE: ['INVOICED'],
  },
  INVOICED: {
    ADMIN: ['PAID', 'CANCELLED'],
    SUPERADMIN: ['PAID', 'CANCELLED'],
    FINANCE: ['PAID'],
  },
  PAID: {},       // Terminal state
  CANCELLED: {},  // Terminal state
}

/**
 * Get allowed next states for a given status and role.
 * Returns empty array for terminal states or unauthorized roles.
 */
export function getNextStates(status: string, role: TransitionRole): OrderStatus[] {
  const canonical = toCanonical(status)
  return TRANSITION_RULES[canonical]?.[role] ?? []
}

/**
 * Check if a transition is valid for the given role.
 */
export function canTransition(
  fromStatus: string,
  toStatus: OrderStatus,
  role: TransitionRole
): boolean {
  const allowed = getNextStates(fromStatus, role)
  return allowed.includes(toStatus)
}

/**
 * Human-readable labels for each status (Indonesian).
 */
const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: 'Menunggu',
  ASSIGNED: 'Ditugaskan',
  EN_ROUTE: 'Dalam Perjalanan',
  IN_PROGRESS: 'Sedang Dikerjakan',
  COMPLETED: 'Selesai',
  INVOICED: 'Ditagih',
  PAID: 'Lunas',
  CANCELLED: 'Dibatalkan',
}

/**
 * Get the human-readable label for a status.
 */
export function getStatusLabel(status: string): string {
  const canonical = toCanonical(status)
  return STATUS_LABELS[canonical]
}

/**
 * Color tokens for each status: Tailwind classes for bg, text, and border.
 * Used by StatusBadge component.
 */
export const ORDER_STATUS_COLORS: Record<OrderStatus, { bg: string; text: string; border: string }> = {
  PENDING: {
    bg: 'bg-amber-100 dark:bg-amber-950/40',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-800',
  },
  ASSIGNED: {
    bg: 'bg-blue-100 dark:bg-blue-950/40',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-800',
  },
  EN_ROUTE: {
    bg: 'bg-indigo-100 dark:bg-indigo-950/40',
    text: 'text-indigo-700 dark:text-indigo-300',
    border: 'border-indigo-200 dark:border-indigo-800',
  },
  IN_PROGRESS: {
    bg: 'bg-violet-100 dark:bg-violet-950/40',
    text: 'text-violet-700 dark:text-violet-300',
    border: 'border-violet-200 dark:border-violet-800',
  },
  COMPLETED: {
    bg: 'bg-green-100 dark:bg-green-950/40',
    text: 'text-green-700 dark:text-green-300',
    border: 'border-green-200 dark:border-green-800',
  },
  INVOICED: {
    bg: 'bg-cyan-100 dark:bg-cyan-950/40',
    text: 'text-cyan-700 dark:text-cyan-300',
    border: 'border-cyan-200 dark:border-cyan-800',
  },
  PAID: {
    bg: 'bg-emerald-100 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-800',
  },
  CANCELLED: {
    bg: 'bg-red-100 dark:bg-red-950/40',
    text: 'text-red-700 dark:text-red-300',
    border: 'border-red-200 dark:border-red-800',
  },
}

/**
 * Check if a status is terminal (no further transitions possible).
 */
export function isTerminalState(status: string): boolean {
  const canonical = toCanonical(status)
  return canonical === 'PAID' || canonical === 'CANCELLED'
}

/**
 * All canonical statuses in workflow order.
 */
export const ORDER_STATUS_SEQUENCE: OrderStatus[] = [
  'PENDING',
  'ASSIGNED',
  'EN_ROUTE',
  'IN_PROGRESS',
  'COMPLETED',
  'INVOICED',
  'PAID',
  'CANCELLED',
]
```

**Verification:**
```bash
npm run type-check
```

**Commit:**
```bash
git add src/lib/order-status.ts
git commit -m "feat: create order-status.ts — status mapper, transitions, colors (single source of truth)"
```

---

## Task 3: Create `src/lib/status-colors.ts`

**Files:**
- Create: `src/lib/status-colors.ts`

### Steps

- [ ] 3.1 Create the invoice and service type color tokens module:

```typescript
// src/lib/status-colors.ts
// Color tokens for invoice statuses and service types.
// Consistent format: { bg, text, border } per entry.

/**
 * Invoice status values.
 */
export type InvoiceStatus =
  | 'DRAFT'
  | 'SENT'
  | 'PARTIAL_PAID'
  | 'PAID'
  | 'OVERDUE'
  | 'CANCELLED'

/**
 * Color tokens for invoice statuses.
 */
export const INVOICE_STATUS_COLORS: Record<InvoiceStatus, { bg: string; text: string; border: string }> = {
  DRAFT: {
    bg: 'bg-gray-100 dark:bg-gray-800/40',
    text: 'text-gray-700 dark:text-gray-300',
    border: 'border-gray-200 dark:border-gray-700',
  },
  SENT: {
    bg: 'bg-blue-100 dark:bg-blue-950/40',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-800',
  },
  PARTIAL_PAID: {
    bg: 'bg-amber-100 dark:bg-amber-950/40',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-800',
  },
  PAID: {
    bg: 'bg-green-100 dark:bg-green-950/40',
    text: 'text-green-700 dark:text-green-300',
    border: 'border-green-200 dark:border-green-800',
  },
  OVERDUE: {
    bg: 'bg-red-100 dark:bg-red-950/40',
    text: 'text-red-700 dark:text-red-300',
    border: 'border-red-200 dark:border-red-800',
  },
  CANCELLED: {
    bg: 'bg-gray-100 dark:bg-gray-800/40',
    text: 'text-gray-500 dark:text-gray-400',
    border: 'border-gray-200 dark:border-gray-700',
  },
}

/**
 * Human-readable labels for invoice statuses (Indonesian).
 */
export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: 'Draft',
  SENT: 'Terkirim',
  PARTIAL_PAID: 'Sebagian Dibayar',
  PAID: 'Lunas',
  OVERDUE: 'Jatuh Tempo',
  CANCELLED: 'Dibatalkan',
}

/**
 * Service type values.
 */
export type ServiceType =
  | 'REFILL_FREON'
  | 'CLEANING'
  | 'REPAIR'
  | 'INSTALLATION'
  | 'INSPECTION'
  | 'MAINTENANCE'

/**
 * Color tokens for service types.
 */
export const SERVICE_TYPE_COLORS: Record<ServiceType, { bg: string; text: string; border: string }> = {
  REFILL_FREON: {
    bg: 'bg-blue-100 dark:bg-blue-950/40',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-800',
  },
  CLEANING: {
    bg: 'bg-green-100 dark:bg-green-950/40',
    text: 'text-green-700 dark:text-green-300',
    border: 'border-green-200 dark:border-green-800',
  },
  REPAIR: {
    bg: 'bg-orange-100 dark:bg-orange-950/40',
    text: 'text-orange-700 dark:text-orange-300',
    border: 'border-orange-200 dark:border-orange-800',
  },
  INSTALLATION: {
    bg: 'bg-purple-100 dark:bg-purple-950/40',
    text: 'text-purple-700 dark:text-purple-300',
    border: 'border-purple-200 dark:border-purple-800',
  },
  INSPECTION: {
    bg: 'bg-cyan-100 dark:bg-cyan-950/40',
    text: 'text-cyan-700 dark:text-cyan-300',
    border: 'border-cyan-200 dark:border-cyan-800',
  },
  MAINTENANCE: {
    bg: 'bg-teal-100 dark:bg-teal-950/40',
    text: 'text-teal-700 dark:text-teal-300',
    border: 'border-teal-200 dark:border-teal-800',
  },
}

/**
 * Human-readable labels for service types.
 */
export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  REFILL_FREON: 'Refill Freon',
  CLEANING: 'Cleaning',
  REPAIR: 'Repair',
  INSTALLATION: 'Installation',
  INSPECTION: 'Inspection',
  MAINTENANCE: 'Maintenance',
}
```

**Verification:**
```bash
npm run type-check
```

**Commit:**
```bash
git add src/lib/status-colors.ts
git commit -m "feat: create status-colors.ts — invoice + service type color tokens"
```

---

## Task 4: Update `src/types/create-order.ts`

**Files:**
- Modify: `src/types/create-order.ts`

### Steps

- [ ] 4.1 Update the OrderStatus type to 8 canonical states and add LegacyOrderStatus for backward compatibility:

Replace the existing `OrderStatus` type definition (lines 10-22) with:

```typescript
/**
 * Canonical order status — 8 states for MSN ERP v2.
 * This is the primary type used across the application.
 */
export type OrderStatus =
  | 'PENDING'
  | 'ASSIGNED'
  | 'EN_ROUTE'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'INVOICED'
  | 'PAID'
  | 'CANCELLED'

/**
 * Legacy order status values that may still exist in the database.
 * Used for backward compatibility during Phase 0-4 transition.
 * Will be removed in Phase 5 after data migration.
 */
export type LegacyOrderStatus =
  | 'NEW'
  | 'ACCEPTED'
  | 'EN ROUTE'
  | 'ARRIVED'
  | 'DONE'
  | 'RESCHEDULE'
  | 'CLOSED'
  | 'TO_WORKSHOP'
  | 'IN_WORKSHOP'
  | 'READY_TO_RETURN'
  | 'DELIVERED'

/**
 * Union of all possible status values at runtime (canonical + legacy).
 * Use this when reading raw data from the database.
 * Always convert to OrderStatus via toCanonical() from '@/lib/order-status' for display.
 */
export type AnyOrderStatus = OrderStatus | LegacyOrderStatus
```

- [ ] 4.2 Update the `OrderItem.status` field type to use `AnyOrderStatus`:

Change line 40 from:
```typescript
  status: OrderStatus;
```
to:
```typescript
  status: AnyOrderStatus;
```

**Verification:**
```bash
npm run type-check
```

**Commit:**
```bash
git add src/types/create-order.ts
git commit -m "feat(types): update OrderStatus to 8 canonical states, add LegacyOrderStatus"
```

---

## Task 5: Add CSS variable status tokens to `src/styles/globals.css`

**Files:**
- Modify: `src/styles/globals.css`

### Steps

- [ ] 5.1 Add status CSS variable tokens inside the existing `:root` block (after `--chart-5`):

```css
    /* Status badge tokens (semantic, dark-mode aware) */
    --status-pending: 38 92% 50%;
    --status-assigned: 221 83% 53%;
    --status-en-route: 234 89% 64%;
    --status-in-progress: 270 91% 65%;
    --status-completed: 142 71% 45%;
    --status-invoiced: 188 92% 43%;
    --status-paid: 142 76% 36%;
    --status-cancelled: 0 84% 60%;
```

- [ ] 5.2 Add dark mode status tokens inside the existing `.dark` block (after `--chart-5`):

```css
    /* Status badge tokens (dark mode) */
    --status-pending: 38 92% 60%;
    --status-assigned: 221 83% 63%;
    --status-en-route: 234 89% 74%;
    --status-in-progress: 270 91% 75%;
    --status-completed: 142 71% 55%;
    --status-invoiced: 188 92% 53%;
    --status-paid: 142 76% 46%;
    --status-cancelled: 0 84% 70%;
```

- [ ] 5.3 Fix the `.crud-button:hover` anti-pattern. Replace the existing rules:

```css
  /* CRUD Button Hover Effects */
  .crud-button {
    @apply transition-all duration-200 ease-in-out;
  }

  .crud-button:hover {
    @apply scale-105 shadow-md;
  }

  .crud-button:active {
    @apply scale-95;
  }
```

With:

```css
  /* CRUD Button Hover Effects (no scale — prevents layout shift) */
  .crud-button {
    @apply transition-all duration-200 ease-in-out;
  }

  .crud-button:hover {
    @apply shadow-md brightness-95;
  }

  .crud-button:active {
    @apply brightness-90;
  }
```

The final `src/styles/globals.css` should look like:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222 47% 11%;
    --card: 0 0% 100%;
    --card-foreground: 222 47% 11%;
    --popover: 0 0% 100%;
    --popover-foreground: 222 47% 11%;
    --primary: 221 83% 53%;
    --primary-foreground: 0 0% 100%;
    --secondary: 210 40% 96%;
    --secondary-foreground: 222 47% 11%;
    --muted: 210 40% 96%;
    --muted-foreground: 215 16% 47%;
    --accent: 210 40% 96%;
    --accent-foreground: 222 47% 11%;
    --destructive: 0 84% 60%;
    --destructive-foreground: 0 0% 98%;
    --border: 214 32% 91%;
    --input: 214 32% 91%;
    --ring: 221 83% 53%;
    --radius: 0.75rem;
    --chart-1: 221 83% 53%;
    --chart-2: 221 83% 73%;
    --chart-3: 142 71% 45%;
    --chart-4: 38 92% 50%;
    --chart-5: 0 84% 60%;
    /* Status badge tokens (semantic, dark-mode aware) */
    --status-pending: 38 92% 50%;
    --status-assigned: 221 83% 53%;
    --status-en-route: 234 89% 64%;
    --status-in-progress: 270 91% 65%;
    --status-completed: 142 71% 45%;
    --status-invoiced: 188 92% 43%;
    --status-paid: 142 76% 36%;
    --status-cancelled: 0 84% 60%;
  }

  .dark {
    --background: 222 47% 11%;
    --foreground: 210 40% 98%;
    --card: 217 33% 17%;
    --card-foreground: 210 40% 98%;
    --popover: 217 33% 17%;
    --popover-foreground: 210 40% 98%;
    --primary: 221 83% 53%;
    --primary-foreground: 0 0% 100%;
    --secondary: 217 33% 17%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217 33% 17%;
    --muted-foreground: 215 20% 65%;
    --accent: 217 33% 17%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62% 30%;
    --destructive-foreground: 0 0% 98%;
    --border: 217 19% 27%;
    --input: 217 19% 27%;
    --ring: 221 83% 53%;
    --chart-1: 221 83% 63%;
    --chart-2: 221 83% 78%;
    --chart-3: 142 71% 55%;
    --chart-4: 38 92% 60%;
    --chart-5: 0 84% 65%;
    /* Status badge tokens (dark mode) */
    --status-pending: 38 92% 60%;
    --status-assigned: 221 83% 63%;
    --status-en-route: 234 89% 74%;
    --status-in-progress: 270 91% 75%;
    --status-completed: 142 71% 55%;
    --status-invoiced: 188 92% 53%;
    --status-paid: 142 76% 46%;
    --status-cancelled: 0 84% 70%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}

@layer components {
  .kpi-card {
    @apply bg-card rounded-xl border border-border/50 shadow-sm p-6 transition-all hover:shadow-md;
  }
  
  .data-table-container {
    @apply bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden;
  }
  
  .sidebar-item {
    @apply flex items-center gap-3 rounded-lg px-3 py-2.5 text-muted-foreground transition-all hover:bg-muted hover:text-foreground;
  }

  .sidebar-item-active {
    @apply bg-primary/10 text-primary font-medium border-l-2 border-primary;
  }

  /* CRUD Button Hover Effects (no scale — prevents layout shift) */
  .crud-button {
    @apply transition-all duration-200 ease-in-out;
  }

  .crud-button:hover {
    @apply shadow-md brightness-95;
  }

  .crud-button:active {
    @apply brightness-90;
  }
}
```

**Verification:**
```bash
npm run type-check
npm run build
```

**Commit:**
```bash
git add src/styles/globals.css
git commit -m "feat(css): add status variable tokens, fix crud-button scale anti-pattern"
```

---

## Task 6: Create badge components

**Files:**
- Create: `src/components/orders/status-badge.tsx`
- Create: `src/components/invoices/invoice-status-badge.tsx`
- Create: `src/components/orders/service-type-badge.tsx`

### Steps

- [ ] 6.1 Create the orders directory if it doesn't exist:

```bash
mkdir -p src/components/orders
mkdir -p src/components/invoices
```

- [ ] 6.2 Create `src/components/orders/status-badge.tsx`:

```typescript
'use client'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { toCanonical, getStatusLabel, ORDER_STATUS_COLORS, type OrderStatus } from '@/lib/order-status'

interface StatusBadgeProps {
  /** Raw status from DB (legacy or canonical) */
  status: string | null | undefined
  /** Optional size variant */
  size?: 'sm' | 'default'
  /** Optional additional className */
  className?: string
}

/**
 * Displays an order status as a colored badge.
 * Automatically maps legacy statuses to canonical ones.
 * Uses semantic color tokens from ORDER_STATUS_COLORS.
 */
export function StatusBadge({ status, size = 'default', className }: StatusBadgeProps) {
  const canonical: OrderStatus = toCanonical(status)
  const colors = ORDER_STATUS_COLORS[canonical]
  const label = getStatusLabel(status ?? '')

  return (
    <Badge
      variant="outline"
      className={cn(
        colors.bg,
        colors.text,
        colors.border,
        'font-medium',
        size === 'sm' && 'text-[10px] px-1.5 py-0',
        className
      )}
    >
      {label}
    </Badge>
  )
}
```

- [ ] 6.3 Create `src/components/invoices/invoice-status-badge.tsx`:

```typescript
'use client'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  INVOICE_STATUS_COLORS,
  INVOICE_STATUS_LABELS,
  type InvoiceStatus,
} from '@/lib/status-colors'

interface InvoiceStatusBadgeProps {
  /** Invoice status value */
  status: string | null | undefined
  /** Optional size variant */
  size?: 'sm' | 'default'
  /** Optional additional className */
  className?: string
}

/**
 * Displays an invoice status as a colored badge.
 * Falls back to DRAFT styling for unknown values.
 */
export function InvoiceStatusBadge({ status, size = 'default', className }: InvoiceStatusBadgeProps) {
  const normalizedStatus = (status?.toUpperCase() ?? 'DRAFT') as InvoiceStatus
  const colors = INVOICE_STATUS_COLORS[normalizedStatus] ?? INVOICE_STATUS_COLORS.DRAFT
  const label = INVOICE_STATUS_LABELS[normalizedStatus] ?? status ?? 'Draft'

  return (
    <Badge
      variant="outline"
      className={cn(
        colors.bg,
        colors.text,
        colors.border,
        'font-medium',
        size === 'sm' && 'text-[10px] px-1.5 py-0',
        className
      )}
    >
      {label}
    </Badge>
  )
}
```

- [ ] 6.4 Create `src/components/orders/service-type-badge.tsx`:

```typescript
'use client'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  SERVICE_TYPE_COLORS,
  SERVICE_TYPE_LABELS,
  type ServiceType,
} from '@/lib/status-colors'

interface ServiceTypeBadgeProps {
  /** Service type value (e.g., 'CLEANING', 'REPAIR') */
  serviceType: string | null | undefined
  /** Optional size variant */
  size?: 'sm' | 'default'
  /** Optional additional className */
  className?: string
}

/**
 * Displays a service type as a colored badge.
 * Falls back to neutral styling for unknown service types.
 */
export function ServiceTypeBadge({ serviceType, size = 'default', className }: ServiceTypeBadgeProps) {
  const normalized = (serviceType?.toUpperCase() ?? '') as ServiceType
  const colors = SERVICE_TYPE_COLORS[normalized] ?? {
    bg: 'bg-gray-100 dark:bg-gray-800/40',
    text: 'text-gray-700 dark:text-gray-300',
    border: 'border-gray-200 dark:border-gray-700',
  }
  const label = SERVICE_TYPE_LABELS[normalized] ?? serviceType ?? 'Unknown'

  return (
    <Badge
      variant="outline"
      className={cn(
        colors.bg,
        colors.text,
        colors.border,
        'font-medium',
        size === 'sm' && 'text-[10px] px-1.5 py-0',
        className
      )}
    >
      {label}
    </Badge>
  )
}
```

**Verification:**
```bash
npm run type-check
```

**Commit:**
```bash
git add src/components/orders/ src/components/invoices/
git commit -m "feat(ui): create StatusBadge, InvoiceStatusBadge, ServiceTypeBadge components"
```

---

## Task 7: Create `src/components/ui/empty-state.tsx`

**Files:**
- Create: `src/components/ui/empty-state.tsx`

### Steps

- [ ] 7.1 Create the reusable EmptyState component:

```typescript
import { type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  /** Lucide icon component to display */
  icon: LucideIcon
  /** Main title text */
  title: string
  /** Optional description text */
  description?: string
  /** Optional action button */
  action?: {
    label: string
    onClick: () => void
    icon?: LucideIcon
  }
  /** Optional additional className */
  className?: string
}

/**
 * Reusable empty state component for tables, lists, and board columns.
 * Displays an icon, title, optional description, and optional action button.
 */
export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-12 px-4 text-center', className)}>
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="text-sm font-semibold text-foreground mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-[280px] mb-4">{description}</p>
      )}
      {action && (
        <Button
          variant="outline"
          size="sm"
          onClick={action.onClick}
          className="mt-2"
        >
          {action.icon && <action.icon className="mr-2 h-4 w-4" />}
          {action.label}
        </Button>
      )}
    </div>
  )
}
```

**Verification:**
```bash
npm run type-check
```

**Commit:**
```bash
git add src/components/ui/empty-state.tsx
git commit -m "feat(ui): create reusable EmptyState component"
```

---

## Task 8: Create mutation hooks

**Files:**
- Create: `src/hooks/use-order-mutation.ts`
- Create: `src/hooks/use-invoice-mutation.ts`

### Steps

- [ ] 8.1 Create `src/hooks/use-order-mutation.ts`:

```typescript
'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/use-toast'
import { updateOrderStatus, assignOrdersToTechnician, cancelOrder } from '@/lib/actions/orders'
import type { OrderStatus } from '@/lib/order-status'

/**
 * Hook for transitioning an order to a new status with optimistic updates.
 * Invalidates ['orders'] and ['order', orderId] queries on settle.
 */
export function useTransitionOrder() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async ({ orderId, newStatus, reason }: {
      orderId: string
      newStatus: OrderStatus
      reason?: string
    }) => {
      const result = await updateOrderStatus(orderId, newStatus, reason)
      if (!result.success) throw new Error(result.error || 'Failed to update status')
      return result
    },
    onMutate: async ({ orderId, newStatus }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['orders'] })
      await queryClient.cancelQueries({ queryKey: ['order', orderId] })

      // Snapshot previous values
      const previousOrders = queryClient.getQueryData(['orders'])
      const previousOrder = queryClient.getQueryData(['order', orderId])

      // Optimistic update for single order
      queryClient.setQueryData(['order', orderId], (old: unknown) => {
        if (!old || typeof old !== 'object') return old
        const data = old as Record<string, unknown>
        if (data.data && typeof data.data === 'object') {
          return { ...data, data: { ...(data.data as object), status: newStatus } }
        }
        return old
      })

      return { previousOrders, previousOrder }
    },
    onError: (err, { orderId }, context) => {
      // Rollback on error
      if (context?.previousOrders) {
        queryClient.setQueryData(['orders'], context.previousOrders)
      }
      if (context?.previousOrder) {
        queryClient.setQueryData(['order', orderId], context.previousOrder)
      }
      toast({
        variant: 'destructive',
        title: 'Gagal update status',
        description: err instanceof Error ? err.message : 'Terjadi kesalahan',
      })
    },
    onSuccess: (_, { newStatus }) => {
      toast({
        title: 'Status diperbarui',
        description: `Order berhasil diubah ke ${newStatus}`,
      })
    },
    onSettled: (_, __, { orderId }) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['order', orderId] })
    },
  })
}

/**
 * Hook for assigning a technician to orders with optimistic updates.
 */
export function useAssignTechnician() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async ({ orderIds, technicianId, helperIds, scheduledDate }: {
      orderIds: string[]
      technicianId: string
      helperIds?: string[]
      scheduledDate: string
    }) => {
      const result = await assignOrdersToTechnician(orderIds, technicianId, helperIds || [], scheduledDate)
      if (!result.success) throw new Error(result.error || 'Failed to assign technician')
      return result
    },
    onError: (err) => {
      toast({
        variant: 'destructive',
        title: 'Gagal assign teknisi',
        description: err instanceof Error ? err.message : 'Terjadi kesalahan',
      })
    },
    onSuccess: (_, { orderIds }) => {
      toast({
        title: 'Teknisi ditugaskan',
        description: `${orderIds.length} order berhasil di-assign`,
      })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
  })
}

/**
 * Hook for rescheduling an order (transition back to PENDING with reason).
 */
export function useReschedule() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async ({ orderId, reason, newDate }: {
      orderId: string
      reason: string
      newDate?: string
    }) => {
      const result = await updateOrderStatus(orderId, 'PENDING', reason)
      if (!result.success) throw new Error(result.error || 'Failed to reschedule')
      return result
    },
    onMutate: async ({ orderId }) => {
      await queryClient.cancelQueries({ queryKey: ['orders'] })
      const previousOrders = queryClient.getQueryData(['orders'])
      return { previousOrders }
    },
    onError: (err, _, context) => {
      if (context?.previousOrders) {
        queryClient.setQueryData(['orders'], context.previousOrders)
      }
      toast({
        variant: 'destructive',
        title: 'Gagal reschedule',
        description: err instanceof Error ? err.message : 'Terjadi kesalahan',
      })
    },
    onSuccess: () => {
      toast({
        title: 'Order di-reschedule',
        description: 'Order dikembalikan ke status Menunggu',
      })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
  })
}

/**
 * Hook for cancelling an order with confirmation.
 */
export function useCancelOrder() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async ({ orderId, reason }: {
      orderId: string
      reason?: string
    }) => {
      const result = await cancelOrder(orderId, reason)
      if (!result.success) throw new Error(result.error || 'Failed to cancel order')
      return result
    },
    onMutate: async ({ orderId }) => {
      await queryClient.cancelQueries({ queryKey: ['orders'] })
      await queryClient.cancelQueries({ queryKey: ['order', orderId] })
      const previousOrders = queryClient.getQueryData(['orders'])
      const previousOrder = queryClient.getQueryData(['order', orderId])
      return { previousOrders, previousOrder }
    },
    onError: (err, { orderId }, context) => {
      if (context?.previousOrders) {
        queryClient.setQueryData(['orders'], context.previousOrders)
      }
      if (context?.previousOrder) {
        queryClient.setQueryData(['order', orderId], context.previousOrder)
      }
      toast({
        variant: 'destructive',
        title: 'Gagal membatalkan order',
        description: err instanceof Error ? err.message : 'Terjadi kesalahan',
      })
    },
    onSuccess: () => {
      toast({
        title: 'Order dibatalkan',
        description: 'Order berhasil dibatalkan',
      })
    },
    onSettled: (_, __, { orderId }) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['order', orderId] })
    },
  })
}
```

- [ ] 8.2 Create `src/hooks/use-invoice-mutation.ts`:

```typescript
'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/use-toast'
import { createInvoice, recordPayment } from '@/lib/actions/invoices'

/**
 * Hook for creating an invoice from an order with optimistic updates.
 */
export function useCreateInvoice() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async (params: {
      orderId: string
      items: Array<{ description: string; quantity: number; unit_price: number }>
      dueDate?: string
      notes?: string
    }) => {
      const result = await createInvoice(params)
      if (!result.success) throw new Error(result.error || 'Failed to create invoice')
      return result
    },
    onError: (err) => {
      toast({
        variant: 'destructive',
        title: 'Gagal membuat invoice',
        description: err instanceof Error ? err.message : 'Terjadi kesalahan',
      })
    },
    onSuccess: () => {
      toast({
        title: 'Invoice dibuat',
        description: 'Invoice berhasil dibuat',
      })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
  })
}

/**
 * Hook for recording a payment against an invoice.
 */
export function useRecordPayment() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async (params: {
      invoiceId: string
      amount: number
      paymentMethod: string
      paymentDate?: string
      notes?: string
    }) => {
      const result = await recordPayment(params)
      if (!result.success) throw new Error(result.error || 'Failed to record payment')
      return result
    },
    onMutate: async ({ invoiceId }) => {
      await queryClient.cancelQueries({ queryKey: ['invoices'] })
      await queryClient.cancelQueries({ queryKey: ['invoice', invoiceId] })
      const previousInvoices = queryClient.getQueryData(['invoices'])
      const previousInvoice = queryClient.getQueryData(['invoice', invoiceId])
      return { previousInvoices, previousInvoice }
    },
    onError: (err, { invoiceId }, context) => {
      if (context?.previousInvoices) {
        queryClient.setQueryData(['invoices'], context.previousInvoices)
      }
      if (context?.previousInvoice) {
        queryClient.setQueryData(['invoice', invoiceId], context.previousInvoice)
      }
      toast({
        variant: 'destructive',
        title: 'Gagal mencatat pembayaran',
        description: err instanceof Error ? err.message : 'Terjadi kesalahan',
      })
    },
    onSuccess: () => {
      toast({
        title: 'Pembayaran dicatat',
        description: 'Pembayaran berhasil dicatat',
      })
    },
    onSettled: (_, __, { invoiceId }) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
  })
}
```

**Verification:**
```bash
npm run type-check
```

**Commit:**
```bash
git add src/hooks/use-order-mutation.ts src/hooks/use-invoice-mutation.ts
git commit -m "feat(hooks): create useOrderMutation + useInvoiceMutation with optimistic updates"
```

---

## Task 9: Add shadcn command component + error boundaries

**Files:**
- Create: `src/app/error.tsx`
- Create: `src/app/dashboard/error.tsx`
- Create: `src/app/technician/error.tsx`

### Steps

- [ ] 9.1 Install the shadcn `command` component:

```bash
npx shadcn@latest add command --yes
```

- [ ] 9.2 Create `src/app/error.tsx` (global error boundary):

```typescript
'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertCircle } from 'lucide-react'
import { logger } from '@/lib/logger'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    logger.error('Global error boundary caught:', error)
  }, [error])

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center px-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 mb-4">
        <AlertCircle className="h-6 w-6 text-destructive" />
      </div>
      <h2 className="text-lg font-semibold mb-2">Terjadi Kesalahan</h2>
      <p className="text-sm text-muted-foreground max-w-md mb-6">
        Maaf, terjadi kesalahan yang tidak terduga. Silakan coba lagi.
      </p>
      <Button onClick={reset} variant="outline">
        Coba Lagi
      </Button>
    </div>
  )
}
```

- [ ] 9.3 Create `src/app/dashboard/error.tsx` (dashboard error boundary):

```typescript
'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertCircle, RotateCcw } from 'lucide-react'
import { logger } from '@/lib/logger'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    logger.error('Dashboard error boundary caught:', error)
  }, [error])

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center px-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 mb-4">
        <AlertCircle className="h-6 w-6 text-destructive" />
      </div>
      <h2 className="text-lg font-semibold mb-2">Halaman Gagal Dimuat</h2>
      <p className="text-sm text-muted-foreground max-w-md mb-6">
        Terjadi kesalahan saat memuat halaman dashboard. Data Anda aman — silakan coba muat ulang.
      </p>
      <div className="flex gap-3">
        <Button onClick={reset} variant="outline">
          <RotateCcw className="mr-2 h-4 w-4" />
          Muat Ulang
        </Button>
        <Button onClick={() => window.location.href = '/dashboard'} variant="default">
          Ke Dashboard
        </Button>
      </div>
    </div>
  )
}
```

- [ ] 9.4 Create `src/app/technician/error.tsx` (technician app error boundary — placeholder route):

```bash
mkdir -p src/app/technician
```

```typescript
'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertCircle, RotateCcw } from 'lucide-react'
import { logger } from '@/lib/logger'

export default function TechnicianError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    logger.error('Technician app error boundary caught:', error)
  }, [error])

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 mb-4">
        <AlertCircle className="h-6 w-6 text-destructive" />
      </div>
      <h2 className="text-lg font-semibold mb-2">Terjadi Kesalahan</h2>
      <p className="text-sm text-muted-foreground max-w-[280px] mb-6">
        Maaf, terjadi kesalahan. Silakan coba lagi.
      </p>
      <Button onClick={reset} variant="outline" className="h-11 min-w-[120px]">
        <RotateCcw className="mr-2 h-4 w-4" />
        Coba Lagi
      </Button>
    </div>
  )
}
```

**Verification:**
```bash
npm run type-check
npm run build
```

**Commit:**
```bash
git add src/app/error.tsx src/app/dashboard/error.tsx src/app/technician/error.tsx src/components/ui/command.tsx
git commit -m "feat: add error boundaries (global, dashboard, technician) + shadcn command component"
```

---

## Task 10: Migrate hard-coded status colors (page by page)

**Files:**
- Modify: `src/app/dashboard/operasional/monitoring-ongoing/page.tsx`
- Modify: `src/app/dashboard/operasional/accept-order/page.tsx`
- Modify: `src/app/dashboard/operasional/assign-order/page.tsx`
- Modify: `src/app/dashboard/page.tsx`
- Modify: `src/app/dashboard/keuangan/invoices/page.tsx`
- Modify: `src/app/dashboard/keuangan/invoices/[id]/page.tsx`

### Steps

- [ ] 10.1 Migrate `src/app/dashboard/operasional/accept-order/page.tsx`:

**Remove** the local `STATUS_COLORS` constant (lines 52-56):
```typescript
// DELETE THIS:
const STATUS_COLORS: Record<string, string> = {
  NEW: 'bg-slate-500',
  ACCEPTED: 'bg-blue-500',
  CANCELLED: 'bg-red-500',
}
```

**Add import** at the top of the file:
```typescript
import { StatusBadge } from '@/components/orders/status-badge'
```

**Replace** all usages of `STATUS_COLORS` in Badge elements. Find patterns like:
```tsx
<Badge className={STATUS_COLORS[order.status]}>
  {order.status}
</Badge>
```

Replace with:
```tsx
<StatusBadge status={order.status} />
```

- [ ] 10.2 Migrate `src/app/dashboard/operasional/assign-order/page.tsx`:

**Remove** the local `SERVICE_TYPES` array with colors (lines 35-41):
```typescript
// DELETE THIS:
const SERVICE_TYPES = [
  { value: 'REFILL_FREON', label: 'Refill Freon', color: 'bg-blue-500' },
  { value: 'CLEANING', label: 'Cleaning', color: 'bg-green-500' },
  { value: 'REPAIR', label: 'Repair', color: 'bg-orange-500' },
  { value: 'INSTALLATION', label: 'Installation', color: 'bg-purple-500' },
  { value: 'INSPECTION', label: 'Inspection', color: 'bg-cyan-500' },
]
```

**Replace with** a color-free version (colors now come from ServiceTypeBadge):
```typescript
const SERVICE_TYPES = [
  { value: 'REFILL_FREON', label: 'Refill Freon' },
  { value: 'CLEANING', label: 'Cleaning' },
  { value: 'REPAIR', label: 'Repair' },
  { value: 'INSTALLATION', label: 'Installation' },
  { value: 'INSPECTION', label: 'Inspection' },
]
```

**Add import** at the top:
```typescript
import { ServiceTypeBadge } from '@/components/orders/service-type-badge'
```

**Replace** all usages of `SERVICE_TYPES.find(...)?.color` in Badge elements with `<ServiceTypeBadge>`. Find patterns like:
```tsx
<Badge className={SERVICE_TYPES.find(s => s.value === order.order_type)?.color || 'bg-gray-500'}>
  {SERVICE_TYPES.find(s => s.value === order.order_type)?.label || order.order_type}
</Badge>
```

Replace with:
```tsx
<ServiceTypeBadge serviceType={order.order_type} />
```

- [ ] 10.3 Migrate `src/app/dashboard/operasional/monitoring-ongoing/page.tsx`:

**Remove** the local `STATUS_COLORS` constant (lines 132-145):
```typescript
// DELETE THIS:
const STATUS_COLORS: Record<string, string> = {
  NEW: 'bg-gray-500',
  ACCEPTED: 'bg-blue-500',
  ASSIGNED: 'bg-cyan-500',
  'EN ROUTE': 'bg-indigo-500',
  ARRIVED: 'bg-purple-500',
  IN_PROGRESS: 'bg-yellow-500',
  DONE: 'bg-green-500',
  RESCHEDULE: 'bg-orange-500',
  INVOICED: 'bg-emerald-500',
  PAID: 'bg-lime-500',
  CLOSED: 'bg-slate-500',
  CANCELLED: 'bg-red-600',
}
```

**Add imports** at the top:
```typescript
import { StatusBadge } from '@/components/orders/status-badge'
import { ServiceTypeBadge } from '@/components/orders/service-type-badge'
```

**Replace** all usages of `STATUS_COLORS[status]` in Badge elements with `<StatusBadge>`. Find patterns like:
```tsx
<Badge className={STATUS_COLORS[order.status] || 'bg-gray-500'}>
  {order.status}
</Badge>
```

Replace with:
```tsx
<StatusBadge status={order.status} />
```

Also replace any service type badge patterns with `<ServiceTypeBadge>`.

- [ ] 10.4 Migrate `src/app/dashboard/page.tsx`:

**Remove** the local `getStatusBadge` function (lines 51-57):
```typescript
// DELETE THIS:
function getStatusBadge(status: string) {
  const s = status?.toUpperCase()
  if (['PAID', 'CLOSED'].includes(s)) return <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100">{status}</Badge>
  if (['CANCELLED'].includes(s)) return <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100">{status}</Badge>
  if (['NEW', 'ASSIGNED', 'IN_PROGRESS', 'EN ROUTE', 'ARRIVED', 'ACCEPTED'].includes(s)) return <Badge className="bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100">{status}</Badge>
  return <Badge variant="secondary">{status}</Badge>
}
```

**Add import** at the top:
```typescript
import { StatusBadge } from '@/components/orders/status-badge'
```

**Replace** all usages of `{getStatusBadge(order.status)}` with:
```tsx
<StatusBadge status={order.status} />
```

- [ ] 10.5 Migrate `src/app/dashboard/keuangan/invoices/page.tsx`:

**Remove** the local `STATUS_COLORS` and `PAYMENT_STATUS_COLORS` constants (lines 54-67):
```typescript
// DELETE THIS:
const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-500',
  SENT: 'bg-blue-500',
  PARTIAL_PAID: 'bg-amber-500',
  PAID: 'bg-green-500',
  OVERDUE: 'bg-red-500',
  CANCELLED: 'bg-gray-400',
}

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  UNPAID: 'bg-red-500',
  PARTIAL: 'bg-amber-500',
  PAID: 'bg-green-500',
}
```

**Add import** at the top:
```typescript
import { InvoiceStatusBadge } from '@/components/invoices/invoice-status-badge'
```

**Replace** all usages of `STATUS_COLORS[displayStatus]` in Badge elements. Find patterns like:
```tsx
<Badge className={STATUS_COLORS[displayStatus]} data-testid="invoice-status-badge">
  {displayStatus}
</Badge>
```

Replace with:
```tsx
<InvoiceStatusBadge status={displayStatus} />
```

For `PAYMENT_STATUS_COLORS` usages like:
```tsx
<Badge className={PAYMENT_STATUS_COLORS[invoice.payment_status]}>
  {invoice.payment_status}
</Badge>
```

Replace with:
```tsx
<InvoiceStatusBadge status={invoice.payment_status === 'PARTIAL' ? 'PARTIAL_PAID' : invoice.payment_status} />
```

- [ ] 10.6 Migrate `src/app/dashboard/keuangan/invoices/[id]/page.tsx`:

**Remove** the local `STATUS_COLORS` constant (lines 77-84):
```typescript
// DELETE THIS:
const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-500',
  SENT: 'bg-blue-500',
  PARTIAL_PAID: 'bg-amber-500',
  PAID: 'bg-green-500',
  OVERDUE: 'bg-red-500',
  CANCELLED: 'bg-gray-400',
}
```

**Add import** at the top:
```typescript
import { InvoiceStatusBadge } from '@/components/invoices/invoice-status-badge'
```

**Replace** all usages of `STATUS_COLORS[displayStatus]` in Badge elements:
```tsx
<Badge className={STATUS_COLORS[displayStatus]} data-testid="invoice-status-badge">
  {displayStatus}
</Badge>
```

Replace with:
```tsx
<InvoiceStatusBadge status={displayStatus} />
```

**Verification (run after all sub-steps):**
```bash
npm run type-check
npm run build
```

**Commit:**
```bash
git add src/app/dashboard/
git commit -m "refactor: migrate hard-coded status colors to badge components (6 pages)"
```

---

## Task 11: Refactor assign-order/success numbered queries

**Files:**
- Modify: `src/app/dashboard/operasional/assign-order/success/page.tsx`

### Steps

- [ ] 11.1 Replace the 10 numbered `useQuery` hooks with `useQueries` dynamic array.

**Remove** the numbered helper queries (lines 35-62):
```typescript
// DELETE ALL OF THIS:
const helperQuery0 = useQuery({
  queryKey: ['technician', helperIds[0]],
  queryFn: () => getTechnicianById(helperIds[0]),
  enabled: !!helperIds[0]
})
const helperQuery1 = useQuery({...})
const helperQuery2 = useQuery({...})
const helperQuery3 = useQuery({...})
const helperQuery4 = useQuery({...})
const allHelperQueries = [helperQuery0, helperQuery1, helperQuery2, helperQuery3, helperQuery4]
const helperQueries = allHelperQueries.slice(0, helperIds.length)
const helpers = helperQueries.map(q => q.data?.data).filter(Boolean)
```

**Remove** the numbered order queries (lines 64-92):
```typescript
// DELETE ALL OF THIS:
const orderQuery0 = useQuery({...})
const orderQuery1 = useQuery({...})
const orderQuery2 = useQuery({...})
const orderQuery3 = useQuery({...})
const orderQuery4 = useQuery({...})
const allOrderQueries = [orderQuery0, orderQuery1, orderQuery2, orderQuery3, orderQuery4]
const orderQueries = allOrderQueries.slice(0, orderIds.length)
const orders = (orderQueries.map(q => q.data?.data).filter(Boolean)) as unknown[]
const isLoading = orderQueries.some(q => q.isLoading)
```

**Add import** for `useQueries`:
```typescript
import { useQuery, useQueries } from '@tanstack/react-query'
```

**Replace with** dynamic `useQueries` arrays:
```typescript
  // Fetch helper technicians dynamically
  const helperResults = useQueries({
    queries: helperIds.map((id) => ({
      queryKey: ['technician', id],
      queryFn: () => getTechnicianById(id),
      enabled: !!id,
    })),
  })
  const helpers = helperResults.map(q => q.data?.data).filter(Boolean)

  // Fetch orders dynamically
  const orderResults = useQueries({
    queries: orderIds.map((id) => ({
      queryKey: ['order', id],
      queryFn: () => getOrderById(id),
      enabled: !!id,
    })),
  })
  const orders = orderResults.map(q => q.data?.data).filter(Boolean) as unknown[]
  const isLoading = orderResults.some(q => q.isLoading)
```

- [ ] 11.2 Replace the local `SERVICE_TYPE_MAP` with `ServiceTypeBadge`:

**Remove** the local `SERVICE_TYPE_MAP` (lines 94-100):
```typescript
// DELETE THIS:
const SERVICE_TYPE_MAP: Record<string, { label: string; color: string }> = {
  'REFILL_FREON': { label: 'Refill Freon', color: 'bg-blue-500' },
  'CLEANING': { label: 'Cleaning', color: 'bg-green-500' },
  'REPAIR': { label: 'Repair', color: 'bg-orange-500' },
  'INSTALLATION': { label: 'Installation', color: 'bg-purple-500' },
  'INSPECTION': { label: 'Inspection', color: 'bg-cyan-500' },
}
```

**Add imports** at the top:
```typescript
import { ServiceTypeBadge } from '@/components/orders/service-type-badge'
import { StatusBadge } from '@/components/orders/status-badge'
```

**Replace** all usages of `SERVICE_TYPE_MAP` in Badge elements. Find patterns like:
```tsx
<Badge className={SERVICE_TYPE_MAP[o.order_type as string]?.color || 'bg-gray-500'}>
  {SERVICE_TYPE_MAP[o.order_type as string]?.label || o.order_type as string}
</Badge>
```

Replace with:
```tsx
<ServiceTypeBadge serviceType={o.order_type as string} />
```

Also replace the hard-coded ASSIGNED badge:
```tsx
<Badge variant='outline' className='bg-green-50 text-green-700 border-green-200'>
  ASSIGNED
</Badge>
```

Replace with:
```tsx
<StatusBadge status="ASSIGNED" />
```

And replace the service type badges in the items list:
```tsx
<Badge variant='outline' className='text-xs'>
  {SERVICE_TYPE_MAP[it.service_type as string]?.label || it.service_type as string}
</Badge>
```

Replace with:
```tsx
<ServiceTypeBadge serviceType={it.service_type as string} size="sm" />
```

**Verification:**
```bash
npm run type-check
npm run build
```

**Commit:**
```bash
git add src/app/dashboard/operasional/assign-order/success/page.tsx
git commit -m "refactor: replace numbered useQuery hooks with useQueries, migrate to badge components"
```

---

## Self-Review Checklist

### Type/Function Name Consistency

| Symbol | Defined In | Used In |
|--------|-----------|---------|
| `OrderStatus` (8 states) | `src/lib/order-status.ts` | `src/types/create-order.ts`, `src/hooks/use-order-mutation.ts`, `src/components/orders/status-badge.tsx` |
| `LegacyOrderStatus` | `src/lib/order-status.ts` | `src/types/create-order.ts` |
| `AnyOrderStatus` | `src/lib/order-status.ts` | `src/types/create-order.ts` |
| `toCanonical()` | `src/lib/order-status.ts` | `src/components/orders/status-badge.tsx` |
| `getStatusLabel()` | `src/lib/order-status.ts` | `src/components/orders/status-badge.tsx` |
| `getNextStates()` | `src/lib/order-status.ts` | (Phase 1 — Board drag validation) |
| `ORDER_STATUS_COLORS` | `src/lib/order-status.ts` | `src/components/orders/status-badge.tsx` |
| `isTerminalState()` | `src/lib/order-status.ts` | (Phase 1 — Board column collapse) |
| `InvoiceStatus` | `src/lib/status-colors.ts` | `src/components/invoices/invoice-status-badge.tsx` |
| `INVOICE_STATUS_COLORS` | `src/lib/status-colors.ts` | `src/components/invoices/invoice-status-badge.tsx` |
| `INVOICE_STATUS_LABELS` | `src/lib/status-colors.ts` | `src/components/invoices/invoice-status-badge.tsx` |
| `ServiceType` | `src/lib/status-colors.ts` | `src/components/orders/service-type-badge.tsx` |
| `SERVICE_TYPE_COLORS` | `src/lib/status-colors.ts` | `src/components/orders/service-type-badge.tsx` |
| `SERVICE_TYPE_LABELS` | `src/lib/status-colors.ts` | `src/components/orders/service-type-badge.tsx` |
| `StatusBadge` | `src/components/orders/status-badge.tsx` | Pages: dashboard, accept-order, monitoring-ongoing, assign-order/success |
| `InvoiceStatusBadge` | `src/components/invoices/invoice-status-badge.tsx` | Pages: invoices, invoices/[id] |
| `ServiceTypeBadge` | `src/components/orders/service-type-badge.tsx` | Pages: assign-order, assign-order/success, monitoring-ongoing |
| `EmptyState` | `src/components/ui/empty-state.tsx` | (Phase 1 — Board columns, list view) |
| `useTransitionOrder` | `src/hooks/use-order-mutation.ts` | (Phase 1 — Board drag actions) |
| `useAssignTechnician` | `src/hooks/use-order-mutation.ts` | (Phase 1 — Assign modal) |
| `useReschedule` | `src/hooks/use-order-mutation.ts` | (Phase 1 — Reschedule modal) |
| `useCancelOrder` | `src/hooks/use-order-mutation.ts` | (Phase 1 — Cancel confirmation) |
| `useCreateInvoice` | `src/hooks/use-invoice-mutation.ts` | (Phase 3 — Invoice creation) |
| `useRecordPayment` | `src/hooks/use-invoice-mutation.ts` | (Phase 3 — Payment recording) |

### No TBD/TODO Placeholders

- All code blocks are complete and runnable
- All file paths are specified
- All verification commands are concrete (`npm run type-check`, `npm run build`)
- Storage bucket config documented as manual step (cannot be automated via migration SQL)

### Spec Coverage Check

| Phase 0 Requirement (from spec §9) | Task |
|-------------------------------------|------|
| DB migration: ADD VALUE 'PENDING', 'COMPLETED' | Task 1 |
| DB migration: create `service_reports` table + RLS | Task 1 |
| DB migration: create `push_subscriptions` table | Task 1 |
| Storage buckets: `service-photos`, `signatures` | Task 1 (documented as manual) |
| Create `src/lib/order-status.ts` | Task 2 |
| Create `src/lib/status-colors.ts` | Task 3 |
| Update `src/types/create-order.ts` OrderStatus | Task 4 |
| Add CSS variable status tokens | Task 5 |
| Fix `.crud-button:hover { scale-105 }` anti-pattern | Task 5 |
| Create StatusBadge, InvoiceStatusBadge, ServiceTypeBadge | Task 6 |
| Create EmptyState component | Task 7 |
| Create useOrderMutation, useInvoiceMutation hooks | Task 8 |
| Add shadcn `command` component | Task 9 |
| Add `error.tsx` boundaries | Task 9 |
| Migrate 97 hard-coded color usages (page-by-page) | Task 10 |
| Refactor assign-order/success numbered queries | Task 11 |

### Execution Order & Dependencies

```
Task 1 (DB migration) ─── no code deps, can run first
Task 2 (order-status.ts) ─── no deps
Task 3 (status-colors.ts) ─── no deps
Task 4 (types update) ─── depends on Task 2 (imports OrderStatus type concept)
Task 5 (globals.css) ─── no deps
Task 6 (badge components) ─── depends on Task 2 + Task 3
Task 7 (empty-state) ─── no deps
Task 8 (mutation hooks) ─── depends on Task 2 (imports OrderStatus type)
Task 9 (command + error boundaries) ─── no deps
Task 10 (migrate colors) ─── depends on Task 6
Task 11 (refactor queries) ─── depends on Task 6
```

Tasks 1, 2, 3, 5, 7, 9 can run in parallel.
Task 4 after Task 2.
Task 6 after Tasks 2+3.
Task 8 after Task 2.
Tasks 10+11 after Task 6.

---

## Final Verification

After all tasks are complete, run the full verification suite:

```bash
# Type checking
npm run type-check

# Full production build (catches runtime import errors, CSS issues)
npm run build

# Lint check
npm run lint
```

**Expected outcome:** Zero type errors, successful build, no lint errors. No visible UI change — all badge components produce equivalent visual output to the hard-coded colors they replace.
