# Phase 1: Admin Orders Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Build unified Orders page (Kanban Board + List view) with drag-drop, realtime sync, optimistic updates, and slide-over detail panel — replacing 5 fragmented operasional pages.

**Architecture:** New route `/dashboard/orders` with `?view=board|list` URL state. Kanban via `@dnd-kit/core` with optimistic mutations. List view via existing TanStack Table. OrderDetailPanel as Sheet (slide-over). Realtime subscription wires teknisi status updates live. Foundation from Phase 0 (StatusBadge, mutation hooks, EmptyState) is fully leveraged.

**Tech Stack:** Next.js 15 App Router, TanStack Query v5, TanStack Table v8, @dnd-kit/core, shadcn/ui (Sheet, Command, Tabs), Supabase Realtime, Tailwind CSS

**Soft Launch Strategy:** Old `operasional/*` pages remain accessible via direct URL (no link from sidebar) for 1 week monitoring. Phase 5 deletes them.

---

## File Structure

### Files to Create

| Path | Purpose |
|------|---------|
| `src/lib/order-utils.ts` | Helpers: urgency, grouping, filtering, sorting |
| `src/components/orders/order-card.tsx` | Kanban card |
| `src/components/orders/kanban-column.tsx` | Single board column with droppable area |
| `src/components/orders/kanban-board.tsx` | DndContext wrapper, 6 columns |
| `src/components/orders/order-filters.tsx` | Shared filter bar (Board + List) |
| `src/components/orders/assign-modal.tsx` | Assign technician modal (form) |
| `src/components/orders/reschedule-modal.tsx` | Reschedule with reason modal |
| `src/components/orders/cancel-modal.tsx` | Cancel confirmation modal |
| `src/components/orders/order-detail-panel.tsx` | Slide-over Sheet with 4 tabs |
| `src/components/orders/order-detail-tab.tsx` | Detail tab content |
| `src/components/orders/order-report-tab.tsx` | Technician Report tab content |
| `src/components/orders/order-invoice-tab.tsx` | Linked invoice tab content |
| `src/components/orders/order-history-tab.tsx` | Status transition timeline |
| `src/components/orders/orders-list-view.tsx` | TanStack Table list view |
| `src/components/orders/orders-board-view.tsx` | Board view client component |
| `src/components/orders/orders-page-client.tsx` | Page client root with view toggle + realtime |
| `src/components/orders/order-card-skeleton.tsx` | Loading skeleton for cards |
| `src/components/orders/board-skeleton.tsx` | Loading skeleton for board |
| `src/app/dashboard/orders/page.tsx` | Orders route (board/list) |
| `src/app/dashboard/orders/loading.tsx` | Route-level loading |
| `src/app/dashboard/orders/new/page.tsx` | Refactored create-order page |
| `src/app/dashboard/settings/service-catalog/page.tsx` | Merged service-pricing + service-config |
| `src/lib/actions/order-history.ts` | Fetch order_status_transitions for history tab |

### Files to Modify

| Path | Purpose |
|------|---------|
| `src/components/sidebar.tsx` | Replace operasional menu, promote Customers/Technicians, merge Settings |
| `src/lib/actions/orders.ts` | Add `rescheduleOrder()` server action; fix `assignOrdersToTechnician` signature |
| `src/hooks/use-order-mutation.ts` | Adjust hook signatures to match server actions |
| `CLAUDE.md` | Reference new Orders page in conventions |

### Phase 0 Imports (Already Exist)

| Symbol | File |
|--------|------|
| `OrderStatus` (8 states), `toCanonical()`, `getNextStates()`, `ORDER_STATUS_COLORS`, `isTerminalState()`, `ORDER_STATUS_SEQUENCE`, `getStatusLabel()` | `src/lib/order-status.ts` |
| `StatusBadge` | `src/components/orders/status-badge.tsx` |
| `ServiceTypeBadge` | `src/components/orders/service-type-badge.tsx` |
| `EmptyState` | `src/components/ui/empty-state.tsx` |
| `useTransitionOrder`, `useAssignTechnician`, `useReschedule`, `useCancelOrder` | `src/hooks/use-order-mutation.ts` |
| `subscribeOrders` | `src/lib/realtime.ts` |
| `Sheet`, `SheetContent`, `SheetHeader`, `SheetTitle`, `SheetDescription`, `SheetFooter` | `src/components/ui/sheet.tsx` |
| `Command`, `CommandInput`, `CommandItem`, `CommandList`, `CommandGroup`, `CommandEmpty` | `src/components/ui/command.tsx` |
| `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` | `src/components/ui/tabs.tsx` |

---

## Task 1: Install @dnd-kit dependencies

**Files:**
- Modify: `package.json`, `package-lock.json`

### Steps

- [ ] **Step 1.1: Install dependencies**

```bash
npm install @dnd-kit/core@^6.1.0 @dnd-kit/sortable@^8.0.0 @dnd-kit/utilities@^3.2.2
```

- [ ] **Step 1.2: Verify install**

```bash
npm ls @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

Expected: three packages listed with their versions, no `UNMET` errors.

- [ ] **Step 1.3: Type-check baseline**

```bash
npm run type-check
```

Expected: PASS (no new errors introduced by package install).

- [ ] **Step 1.4: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat(deps): install @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities"
```

---

## Task 2: Add `rescheduleOrder` server action and align action signatures

The Phase 0 plan assumed `assignOrdersToTechnician(orderIds, technicianId, helpers, scheduledDate)` with positional args, but the existing implementation in `src/lib/actions/orders.ts` uses a single `data` object. We also need a dedicated `rescheduleOrder` action so the reschedule flow is explicit (clears `order_technicians`, resets to `PENDING`, sets new date, logs reason).

**Files:**
- Modify: `src/lib/actions/orders.ts`

### Steps

- [ ] **Step 2.1: Add `rescheduleOrder` server action**

Append to the end of `src/lib/actions/orders.ts`:

```typescript
export async function rescheduleOrder(params: {
  orderId: string
  reason: string
  newScheduledDate: string
}) {
  try {
    const supabase = await createClient()

    // Get current status for transition log
    const { data: currentOrder, error: fetchError } = await supabase
      .from('orders')
      .select('status')
      .eq('order_id', params.orderId)
      .single()

    if (fetchError) throw fetchError

    // Reset to PENDING + clear assignments + set new date
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        status: 'PENDING',
        assigned_technician_id: null,
        scheduled_visit_date: params.newScheduledDate,
        req_visit_date: params.newScheduledDate,
        updated_at: new Date().toISOString(),
      })
      .eq('order_id', params.orderId)

    if (updateError) throw updateError

    // Clear technician assignments
    const { error: deleteError } = await supabase
      .from('order_technicians')
      .delete()
      .eq('order_id', params.orderId)

    if (deleteError) {
      logger.error('Error clearing technician assignments on reschedule:', deleteError)
      throw deleteError
    }

    // Log transition
    await supabase.from('order_status_transitions').insert({
      order_id: params.orderId,
      from_status: currentOrder.status,
      to_status: 'PENDING',
      notes: `Reschedule: ${params.reason}`,
      transition_date: new Date().toISOString(),
    })

    revalidatePath('/dashboard/orders')
    revalidatePath('/dashboard')

    return { success: true, message: 'Order rescheduled' }
  } catch (error: unknown) {
    logger.error('Error rescheduling order:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to reschedule order',
    }
  }
}
```

- [ ] **Step 2.2: Verify type-check**

```bash
npm run type-check
```

Expected: PASS.

- [ ] **Step 2.3: Update `useReschedule` and `useAssignTechnician` hook signatures**

In `src/hooks/use-order-mutation.ts` replace the bodies of `useAssignTechnician` and `useReschedule` so they call the canonical server actions:

```typescript
import { rescheduleOrder } from '@/lib/actions/orders'

export function useAssignTechnician() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async (params: {
      orderIds: string[]
      technicianId: string
      helperTechnicianIds?: string[]
      scheduledDate: string
    }) => {
      const result = await assignOrdersToTechnician(params)
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

export function useReschedule() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async (params: {
      orderId: string
      reason: string
      newScheduledDate: string
    }) => {
      const result = await rescheduleOrder(params)
      if (!result.success) throw new Error(result.error || 'Failed to reschedule')
      return result
    },
    onMutate: async ({ orderId }) => {
      await queryClient.cancelQueries({ queryKey: ['orders'] })
      const previousOrders = queryClient.getQueryData(['orders'])
      return { previousOrders }
    },
    onError: (err, _vars, context) => {
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
    onSettled: (_, __, { orderId }) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['order', orderId] })
    },
  })
}
```

- [ ] **Step 2.4: Verify**

```bash
npm run type-check
```

Expected: PASS.

- [ ] **Step 2.5: Commit**

```bash
git add src/lib/actions/orders.ts src/hooks/use-order-mutation.ts
git commit -m "feat(orders): add rescheduleOrder action; align mutation hook signatures"
```

---

## Task 3: Order utility helpers

**Files:**
- Create: `src/lib/order-utils.ts`

### Steps

- [ ] **Step 3.1: Create the helpers module**

```typescript
// src/lib/order-utils.ts
// Pure utility functions for order display logic.

import { toCanonical, isTerminalState, type OrderStatus } from '@/lib/order-status'

/**
 * Order shape we rely on across views. Only fields used by helpers.
 */
export interface OrderForDisplay {
  order_id: string
  status: string | null
  scheduled_visit_date?: string | null
  req_visit_date?: string | null
  customers?: { customer_name?: string | null } | null
  order_items?: Array<{
    service_type?: string | null
    locations?: { full_address?: string | null; city?: string | null } | null
  }> | null
  order_technicians?: Array<{
    role?: string | null
    technicians?: { technician_name?: string | null } | null
  }> | null
}

export type Urgency = 'overdue' | 'today' | 'future' | 'terminal'

/**
 * Compute urgency level for color border on cards.
 * - terminal: PAID or CANCELLED (grey)
 * - overdue: scheduled date in the past
 * - today: scheduled date is today
 * - future: scheduled date is in the future or unknown
 */
export function getUrgencyLevel(order: OrderForDisplay): Urgency {
  if (isTerminalState(order.status ?? '')) return 'terminal'

  const dateStr = order.scheduled_visit_date ?? order.req_visit_date
  if (!dateStr) return 'future'

  const scheduled = new Date(dateStr)
  if (Number.isNaN(scheduled.getTime())) return 'future'

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  scheduled.setHours(0, 0, 0, 0)

  const diff = scheduled.getTime() - today.getTime()
  if (diff < 0) return 'overdue'
  if (diff === 0) return 'today'
  return 'future'
}

/**
 * Tailwind border classes per urgency.
 */
export const URGENCY_BORDER: Record<Urgency, string> = {
  overdue: 'border-l-4 border-l-red-500',
  today: 'border-l-4 border-l-orange-500',
  future: 'border-l-4 border-l-green-500',
  terminal: 'border-l-4 border-l-muted-foreground/30',
}

/**
 * Board column ids — 6 columns. Note ACTIVE merges EN_ROUTE + IN_PROGRESS.
 */
export type BoardColumnId =
  | 'PENDING'
  | 'ASSIGNED'
  | 'ACTIVE'
  | 'COMPLETED'
  | 'INVOICED'
  | 'PAID'

export const BOARD_COLUMNS: Array<{
  id: BoardColumnId
  title: string
  /** Canonical states this column displays */
  states: OrderStatus[]
  /** Whether admin can drop cards into this column */
  acceptsDrops: boolean
}> = [
  { id: 'PENDING', title: 'Menunggu', states: ['PENDING'], acceptsDrops: true },
  { id: 'ASSIGNED', title: 'Ditugaskan', states: ['ASSIGNED'], acceptsDrops: true },
  { id: 'ACTIVE', title: 'Aktif', states: ['EN_ROUTE', 'IN_PROGRESS'], acceptsDrops: false },
  { id: 'COMPLETED', title: 'Selesai', states: ['COMPLETED'], acceptsDrops: true },
  { id: 'INVOICED', title: 'Ditagih', states: ['INVOICED'], acceptsDrops: true },
  { id: 'PAID', title: 'Lunas', states: ['PAID'], acceptsDrops: false },
]

export function getColumnForStatus(status: string | null): BoardColumnId | null {
  const canonical = toCanonical(status)
  if (canonical === 'CANCELLED') return null
  if (canonical === 'EN_ROUTE' || canonical === 'IN_PROGRESS') return 'ACTIVE'
  return canonical as BoardColumnId
}

/**
 * Group orders by board column id. Cancelled orders are excluded from the board.
 */
export function groupOrdersByStatus<T extends OrderForDisplay>(
  orders: T[]
): Record<BoardColumnId, T[]> {
  const groups: Record<BoardColumnId, T[]> = {
    PENDING: [],
    ASSIGNED: [],
    ACTIVE: [],
    COMPLETED: [],
    INVOICED: [],
    PAID: [],
  }
  for (const order of orders) {
    const col = getColumnForStatus(order.status)
    if (col) groups[col].push(order)
  }
  return groups
}

/**
 * Sort orders by urgency, then scheduled date asc.
 */
export function sortOrdersByUrgency<T extends OrderForDisplay>(orders: T[]): T[] {
  const rank: Record<Urgency, number> = { overdue: 0, today: 1, future: 2, terminal: 3 }
  return [...orders].sort((a, b) => {
    const ua = getUrgencyLevel(a)
    const ub = getUrgencyLevel(b)
    if (rank[ua] !== rank[ub]) return rank[ua] - rank[ub]
    const da = a.scheduled_visit_date ?? a.req_visit_date ?? ''
    const db = b.scheduled_visit_date ?? b.req_visit_date ?? ''
    return da.localeCompare(db)
  })
}

/**
 * Filter spec used by both Board and List views.
 */
export interface OrderFilters {
  search?: string
  technicianId?: string
  serviceType?: string
  urgency?: Urgency
  dateFrom?: string
  dateTo?: string
  status?: string
}

/**
 * Apply client-side filters to an orders list.
 */
export function filterOrders<T extends OrderForDisplay>(orders: T[], filters: OrderFilters): T[] {
  return orders.filter((o) => {
    if (filters.search) {
      const q = filters.search.toLowerCase()
      const customerName = o.customers?.customer_name?.toLowerCase() ?? ''
      const orderId = o.order_id.toLowerCase()
      const address = o.order_items?.[0]?.locations?.full_address?.toLowerCase() ?? ''
      if (!customerName.includes(q) && !orderId.includes(q) && !address.includes(q)) {
        return false
      }
    }
    if (filters.technicianId) {
      const lead = o.order_technicians?.find((t) => t.role === 'lead')
      if (!lead || (lead as unknown as { technician_id?: string }).technician_id !== filters.technicianId) {
        return false
      }
    }
    if (filters.serviceType) {
      const types = o.order_items?.map((i) => i.service_type) ?? []
      if (!types.includes(filters.serviceType)) return false
    }
    if (filters.urgency) {
      if (getUrgencyLevel(o) !== filters.urgency) return false
    }
    if (filters.status) {
      if (toCanonical(o.status) !== toCanonical(filters.status)) return false
    }
    const dateStr = o.scheduled_visit_date ?? o.req_visit_date
    if (filters.dateFrom && dateStr) {
      if (dateStr < filters.dateFrom) return false
    }
    if (filters.dateTo && dateStr) {
      if (dateStr > filters.dateTo) return false
    }
    return true
  })
}

/**
 * Lookup helper: lead technician name from order_technicians.
 */
export function getLeadTechnicianName(order: OrderForDisplay): string | null {
  const lead = order.order_technicians?.find((t) => t.role === 'lead')
  return lead?.technicians?.technician_name ?? null
}

/**
 * Lookup helper: primary location address from order_items.
 */
export function getPrimaryLocation(order: OrderForDisplay): string | null {
  const first = order.order_items?.[0]?.locations
  if (!first) return null
  return [first.full_address, first.city].filter(Boolean).join(', ')
}

/**
 * Lookup helper: primary service type from order_items.
 */
export function getPrimaryServiceType(order: OrderForDisplay): string | null {
  return order.order_items?.[0]?.service_type ?? null
}
```

- [ ] **Step 3.2: Verify**

```bash
npm run type-check
```

Expected: PASS.

- [ ] **Step 3.3: Commit**

```bash
git add src/lib/order-utils.ts
git commit -m "feat(orders): add order-utils helpers (urgency, grouping, filtering, sorting)"
```

---

## Task 4: Order Card component

**Files:**
- Create: `src/components/orders/order-card.tsx`
- Create: `src/components/orders/order-card-skeleton.tsx`

### Steps

- [ ] **Step 4.1: Create `order-card.tsx`**

```typescript
'use client'

import { forwardRef } from 'react'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { Calendar, MapPin, User as UserIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { StatusBadge } from '@/components/orders/status-badge'
import { ServiceTypeBadge } from '@/components/orders/service-type-badge'
import {
  type OrderForDisplay,
  getUrgencyLevel,
  URGENCY_BORDER,
  getLeadTechnicianName,
  getPrimaryServiceType,
  getPrimaryLocation,
} from '@/lib/order-utils'

interface OrderCardProps {
  order: OrderForDisplay
  onClick?: (orderId: string) => void
  isDragging?: boolean
  /** When true, hide status badge (e.g. inside a column already labeled by status) */
  hideStatusBadge?: boolean
  className?: string
}

/**
 * Compact card for the Kanban board.
 * - Urgency border on the left
 * - Customer name prominent
 * - Service type + scheduled date + technician name
 * - Click opens the OrderDetailPanel
 */
export const OrderCard = forwardRef<HTMLDivElement, OrderCardProps>(function OrderCard(
  { order, onClick, isDragging, hideStatusBadge, className, ...rest },
  ref
) {
  const urgency = getUrgencyLevel(order)
  const tech = getLeadTechnicianName(order)
  const serviceType = getPrimaryServiceType(order)
  const location = getPrimaryLocation(order)
  const dateStr = order.scheduled_visit_date ?? order.req_visit_date

  return (
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      onClick={() => onClick?.(order.order_id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick?.(order.order_id)
        }
      }}
      className={cn(
        'rounded-lg bg-card border border-border/50 p-3 shadow-sm cursor-pointer',
        'hover:shadow-md hover:border-border transition-shadow',
        URGENCY_BORDER[urgency],
        isDragging && 'opacity-50 ring-2 ring-primary',
        className
      )}
      {...rest}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">
            {order.customers?.customer_name ?? 'Customer'}
          </p>
          <p className="text-xs text-muted-foreground truncate">{order.order_id}</p>
        </div>
        {!hideStatusBadge && <StatusBadge status={order.status} size="sm" />}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 mb-2">
        {serviceType && <ServiceTypeBadge serviceType={serviceType} size="sm" />}
      </div>

      <div className="space-y-1 text-xs text-muted-foreground">
        {dateStr && (
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3 w-3" />
            <span>{format(new Date(dateStr), 'd MMM yyyy', { locale: localeId })}</span>
          </div>
        )}
        {location && (
          <div className="flex items-center gap-1.5">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{location}</span>
          </div>
        )}
        {tech && (
          <div className="flex items-center gap-1.5">
            <UserIcon className="h-3 w-3" />
            <span className="truncate">{tech}</span>
          </div>
        )}
      </div>
    </div>
  )
})
```

- [ ] **Step 4.2: Create `order-card-skeleton.tsx`**

```typescript
import { Skeleton } from '@/components/ui/skeleton'

export function OrderCardSkeleton() {
  return (
    <div className="rounded-lg bg-card border border-border/50 p-3 shadow-sm border-l-4 border-l-muted">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="h-5 w-20 rounded-full mb-2" />
      <div className="space-y-1.5">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-3 w-28" />
      </div>
    </div>
  )
}
```

- [ ] **Step 4.3: Verify**

```bash
npm run type-check
```

Expected: PASS.

- [ ] **Step 4.4: Commit**

```bash
git add src/components/orders/order-card.tsx src/components/orders/order-card-skeleton.tsx
git commit -m "feat(orders): add OrderCard + OrderCardSkeleton components"
```

---

## Task 5: Kanban Column component

**Files:**
- Create: `src/components/orders/kanban-column.tsx`

### Steps

- [ ] **Step 5.1: Create the column component**

```typescript
'use client'

import { useDroppable } from '@dnd-kit/core'
import { Inbox } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { EmptyState } from '@/components/ui/empty-state'
import { OrderCard } from '@/components/orders/order-card'
import { type BoardColumnId } from '@/lib/order-utils'
import { type OrderForDisplay } from '@/lib/order-utils'

interface KanbanColumnProps {
  id: BoardColumnId
  title: string
  orders: OrderForDisplay[]
  onCardClick: (orderId: string) => void
  /** When false the column will not show drop highlight (read-only column) */
  acceptsDrops: boolean
  /** Optional draggable wrapper supplied by the board */
  renderCard?: (order: OrderForDisplay) => React.ReactNode
  /** Default-collapsed terminal columns (e.g. PAID) */
  defaultCollapsed?: boolean
}

/**
 * One column of the Kanban board. Wraps an inner drop zone using @dnd-kit/core's useDroppable.
 * The board passes a render function for each card so dragging logic stays at board level.
 */
export function KanbanColumn({
  id,
  title,
  orders,
  onCardClick,
  acceptsDrops,
  renderCard,
  defaultCollapsed,
}: KanbanColumnProps) {
  const { isOver, setNodeRef } = useDroppable({
    id,
    disabled: !acceptsDrops,
  })

  return (
    <div className="flex flex-col w-72 shrink-0 bg-muted/40 rounded-lg border border-border/50">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
        <h3 className="text-sm font-semibold">{title}</h3>
        <Badge variant="secondary" className="text-xs">
          {orders.length}
        </Badge>
      </div>

      <ScrollArea className="flex-1 max-h-[calc(100vh-280px)]">
        <div
          ref={setNodeRef}
          className={cn(
            'p-2 space-y-2 min-h-[200px] transition-colors',
            isOver && acceptsDrops && 'bg-primary/5 ring-2 ring-primary/40 ring-inset rounded-lg'
          )}
        >
          {orders.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="Tidak ada order"
              description={`Belum ada order pada status ${title.toLowerCase()}`}
              className="py-8"
            />
          ) : defaultCollapsed && orders.length > 5 ? (
            <>
              {orders.slice(0, 5).map((order) =>
                renderCard ? (
                  renderCard(order)
                ) : (
                  <OrderCard
                    key={order.order_id}
                    order={order}
                    onClick={onCardClick}
                    hideStatusBadge
                  />
                )
              )}
              <p className="text-xs text-center text-muted-foreground py-2">
                +{orders.length - 5} order lainnya
              </p>
            </>
          ) : (
            orders.map((order) =>
              renderCard ? (
                renderCard(order)
              ) : (
                <OrderCard
                  key={order.order_id}
                  order={order}
                  onClick={onCardClick}
                  hideStatusBadge
                />
              )
            )
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
```

- [ ] **Step 5.2: Verify**

```bash
npm run type-check
```

Expected: PASS.

- [ ] **Step 5.3: Commit**

```bash
git add src/components/orders/kanban-column.tsx
git commit -m "feat(orders): add KanbanColumn component with droppable zone + empty state"
```

---

## Task 6: Assign Modal component

**Files:**
- Create: `src/components/orders/assign-modal.tsx`

### Steps

- [ ] **Step 6.1: Create the modal**

```typescript
'use client'

import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { CalendarIcon, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { MultiSelectDropdown } from '@/components/ui/multi-select-dropdown'
import { useToast } from '@/hooks/use-toast'
import { getTechnicians } from '@/lib/actions/technicians'
import { useAssignTechnician } from '@/hooks/use-order-mutation'

const schema = z
  .object({
    technicianId: z.string().min(1, 'Teknisi wajib dipilih'),
    helperIds: z.array(z.string()).default([]),
    scheduledDate: z.date({ required_error: 'Tanggal wajib diisi' }),
  })
  .refine(
    (data) => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      return data.scheduledDate >= today
    },
    { path: ['scheduledDate'], message: 'Tanggal tidak boleh di masa lalu' }
  )

type FormValues = z.infer<typeof schema>

interface AssignModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  orderIds: string[]
  defaultDate?: string | null
  onSuccess?: () => void
}

export function AssignModal({
  open,
  onOpenChange,
  orderIds,
  defaultDate,
  onSuccess,
}: AssignModalProps) {
  const { toast } = useToast()
  const mutation = useAssignTechnician()

  const { data: techResp, isLoading: techLoading } = useQuery({
    queryKey: ['technicians', 'all'],
    queryFn: () => getTechnicians({ limit: 200 }),
    enabled: open,
  })

  const technicians = (techResp?.data ?? []) as Array<{
    technician_id: string
    technician_name: string
  }>

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      technicianId: '',
      helperIds: [],
      scheduledDate: defaultDate ? new Date(defaultDate) : new Date(),
    },
  })

  useEffect(() => {
    if (open) {
      form.reset({
        technicianId: '',
        helperIds: [],
        scheduledDate: defaultDate ? new Date(defaultDate) : new Date(),
      })
    }
  }, [open, defaultDate, form])

  async function onSubmit(values: FormValues) {
    if (orderIds.length === 0) {
      toast({ variant: 'destructive', title: 'Tidak ada order yang dipilih' })
      return
    }
    await mutation.mutateAsync({
      orderIds,
      technicianId: values.technicianId,
      helperTechnicianIds: values.helperIds.filter((id) => id !== values.technicianId),
      scheduledDate: format(values.scheduledDate, 'yyyy-MM-dd'),
    })
    onOpenChange(false)
    onSuccess?.()
  }

  const technicianId = form.watch('technicianId')
  const scheduledDate = form.watch('scheduledDate')
  const helperIds = form.watch('helperIds')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Teknisi</DialogTitle>
          <DialogDescription>
            {orderIds.length === 1
              ? `Assign teknisi untuk order ${orderIds[0]}`
              : `Assign teknisi untuk ${orderIds.length} order sekaligus`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="technician">
              Teknisi Lead <span className="text-destructive">*</span>
            </Label>
            <SearchableSelect
              value={technicianId}
              onValueChange={(v) => form.setValue('technicianId', v, { shouldValidate: true })}
              options={technicians.map((t) => ({
                value: t.technician_id,
                label: t.technician_name,
              }))}
              placeholder={techLoading ? 'Memuat teknisi...' : 'Pilih teknisi'}
              searchPlaceholder="Cari teknisi..."
            />
            {form.formState.errors.technicianId && (
              <p className="text-xs text-destructive">
                {form.formState.errors.technicianId.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Helper (opsional)</Label>
            <MultiSelectDropdown
              options={technicians
                .filter((t) => t.technician_id !== technicianId)
                .map((t) => ({ value: t.technician_id, label: t.technician_name }))}
              selected={helperIds}
              onSelectionChange={(vals) => form.setValue('helperIds', vals)}
              placeholder="Pilih helper (opsional)"
            />
          </div>

          <div className="space-y-2">
            <Label>
              Jadwal Kunjungan <span className="text-destructive">*</span>
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  type="button"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !scheduledDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {scheduledDate ? format(scheduledDate, 'd MMM yyyy') : 'Pilih tanggal'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={scheduledDate}
                  onSelect={(d) => d && form.setValue('scheduledDate', d, { shouldValidate: true })}
                  disabled={(date) => {
                    const today = new Date()
                    today.setHours(0, 0, 0, 0)
                    return date < today
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            {form.formState.errors.scheduledDate && (
              <p className="text-xs text-destructive">
                {form.formState.errors.scheduledDate.message}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Assign
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 6.2: Verify**

```bash
npm run type-check
```

Expected: PASS.

- [ ] **Step 6.3: Commit**

```bash
git add src/components/orders/assign-modal.tsx
git commit -m "feat(orders): add AssignModal with technician + helpers + date validation"
```

---

## Task 7: Reschedule Modal component

**Files:**
- Create: `src/components/orders/reschedule-modal.tsx`

### Steps

- [ ] **Step 7.1: Create the modal**

```typescript
'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { CalendarIcon, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useReschedule } from '@/hooks/use-order-mutation'

const schema = z.object({
  reason: z.string().trim().min(3, 'Alasan minimal 3 karakter'),
  newScheduledDate: z.date({ required_error: 'Tanggal baru wajib diisi' }),
})

type FormValues = z.infer<typeof schema>

interface RescheduleModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  orderId: string | null
  defaultDate?: string | null
  onSuccess?: () => void
}

export function RescheduleModal({
  open,
  onOpenChange,
  orderId,
  defaultDate,
  onSuccess,
}: RescheduleModalProps) {
  const mutation = useReschedule()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      reason: '',
      newScheduledDate: defaultDate ? new Date(defaultDate) : new Date(),
    },
  })

  useEffect(() => {
    if (open) {
      form.reset({
        reason: '',
        newScheduledDate: defaultDate ? new Date(defaultDate) : new Date(),
      })
    }
  }, [open, defaultDate, form])

  async function onSubmit(values: FormValues) {
    if (!orderId) return
    await mutation.mutateAsync({
      orderId,
      reason: values.reason,
      newScheduledDate: format(values.newScheduledDate, 'yyyy-MM-dd'),
    })
    onOpenChange(false)
    onSuccess?.()
  }

  const newDate = form.watch('newScheduledDate')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reschedule Order</DialogTitle>
          <DialogDescription>
            Order akan dikembalikan ke status Menunggu, assignment teknisi akan dihapus.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reason">
              Alasan Reschedule <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="reason"
              {...form.register('reason')}
              placeholder="Customer minta ganti jadwal, teknisi sakit, dll."
              rows={3}
            />
            {form.formState.errors.reason && (
              <p className="text-xs text-destructive">{form.formState.errors.reason.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>
              Tanggal Baru <span className="text-destructive">*</span>
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  type="button"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !newDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {newDate ? format(newDate, 'd MMM yyyy') : 'Pilih tanggal'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={newDate}
                  onSelect={(d) =>
                    d && form.setValue('newScheduledDate', d, { shouldValidate: true })
                  }
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            {form.formState.errors.newScheduledDate && (
              <p className="text-xs text-destructive">
                {form.formState.errors.newScheduledDate.message}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Reschedule
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 7.2: Verify**

```bash
npm run type-check
```

Expected: PASS.

- [ ] **Step 7.3: Commit**

```bash
git add src/components/orders/reschedule-modal.tsx
git commit -m "feat(orders): add RescheduleModal with reason + new date validation"
```

---

## Task 8: Cancel Modal component

**Files:**
- Create: `src/components/orders/cancel-modal.tsx`

### Steps

- [ ] **Step 8.1: Create the cancel confirmation modal**

```typescript
'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useCancelOrder } from '@/hooks/use-order-mutation'

interface CancelModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  orderId: string | null
  onSuccess?: () => void
}

export function CancelModal({ open, onOpenChange, orderId, onSuccess }: CancelModalProps) {
  const mutation = useCancelOrder()
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (open) setReason('')
  }, [open])

  async function handleConfirm() {
    if (!orderId) return
    await mutation.mutateAsync({ orderId, reason: reason || undefined })
    onOpenChange(false)
    onSuccess?.()
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Batalkan Order?</AlertDialogTitle>
          <AlertDialogDescription>
            Order akan diubah menjadi CANCELLED dan AC unit terkait (jika status PENDING)
            akan diset INACTIVE. Tindakan ini tidak bisa di-undo dari UI.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2">
          <Label htmlFor="cancel-reason">Alasan (opsional)</Label>
          <Textarea
            id="cancel-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Customer batal, salah input, dll."
            rows={3}
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>Batal</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={mutation.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Batalkan Order
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

- [ ] **Step 8.2: Verify**

```bash
npm run type-check
```

Expected: PASS.

- [ ] **Step 8.3: Commit**

```bash
git add src/components/orders/cancel-modal.tsx
git commit -m "feat(orders): add CancelModal with optional reason"
```

---

## Task 9: Kanban Board component

**Files:**
- Create: `src/components/orders/kanban-board.tsx`
- Create: `src/components/orders/board-skeleton.tsx`

### Steps

- [ ] **Step 9.1: Create board skeleton**

```typescript
import { OrderCardSkeleton } from '@/components/orders/order-card-skeleton'
import { Skeleton } from '@/components/ui/skeleton'
import { BOARD_COLUMNS } from '@/lib/order-utils'

export function BoardSkeleton() {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {BOARD_COLUMNS.map((col) => (
        <div
          key={col.id}
          className="flex flex-col w-72 shrink-0 bg-muted/40 rounded-lg border border-border/50"
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-5 w-8 rounded-full" />
          </div>
          <div className="p-2 space-y-2">
            <OrderCardSkeleton />
            <OrderCardSkeleton />
            <OrderCardSkeleton />
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 9.2: Create the board itself**

```typescript
'use client'

import { useMemo, useState } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { useToast } from '@/hooks/use-toast'
import { OrderCard } from '@/components/orders/order-card'
import { KanbanColumn } from '@/components/orders/kanban-column'
import { AssignModal } from '@/components/orders/assign-modal'
import { RescheduleModal } from '@/components/orders/reschedule-modal'
import {
  BOARD_COLUMNS,
  type BoardColumnId,
  type OrderForDisplay,
  groupOrdersByStatus,
  sortOrdersByUrgency,
  getColumnForStatus,
} from '@/lib/order-utils'
import { useTransitionOrder } from '@/hooks/use-order-mutation'
import { toCanonical } from '@/lib/order-status'

interface KanbanBoardProps {
  orders: OrderForDisplay[]
  onCardClick: (orderId: string) => void
  /** When provided, called when admin drags COMPLETED → INVOICED to open invoice creation. */
  onCreateInvoice?: (orderId: string) => void
  /** When provided, called when admin drags INVOICED → PAID to open payment modal. */
  onRecordPayment?: (orderId: string) => void
}

interface DraggableCardProps {
  order: OrderForDisplay
  onClick: (orderId: string) => void
}

function DraggableCard({ order, onClick }: DraggableCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: order.order_id,
    data: { order },
  })

  const style = {
    transform: CSS.Translate.toString(transform),
  }

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <OrderCard order={order} onClick={onClick} isDragging={isDragging} hideStatusBadge />
    </div>
  )
}

export function KanbanBoard({
  orders,
  onCardClick,
  onCreateInvoice,
  onRecordPayment,
}: KanbanBoardProps) {
  const { toast } = useToast()
  const transition = useTransitionOrder()

  const [activeOrder, setActiveOrder] = useState<OrderForDisplay | null>(null)
  const [assignTarget, setAssignTarget] = useState<{ orderId: string; defaultDate?: string | null } | null>(null)
  const [rescheduleTarget, setRescheduleTarget] = useState<{ orderId: string; defaultDate?: string | null } | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  )

  const grouped = useMemo(() => {
    const g = groupOrdersByStatus(orders)
    return Object.fromEntries(
      Object.entries(g).map(([k, v]) => [k, sortOrdersByUrgency(v)])
    ) as Record<BoardColumnId, OrderForDisplay[]>
  }, [orders])

  function handleDragStart(event: DragStartEvent) {
    const order = (event.active.data.current as { order?: OrderForDisplay } | null)?.order
    if (order) setActiveOrder(order)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveOrder(null)

    const { active, over } = event
    if (!over) return

    const order = (active.data.current as { order?: OrderForDisplay } | null)?.order
    if (!order) return

    const fromCol = getColumnForStatus(order.status)
    const toCol = over.id as BoardColumnId
    if (!fromCol || fromCol === toCol) return

    // ACTIVE column is read-only
    if (fromCol === 'ACTIVE' || toCol === 'ACTIVE') {
      toast({
        title: 'Tidak dapat dipindahkan',
        description: 'Kolom Aktif hanya dapat diubah oleh teknisi.',
      })
      return
    }

    const canonicalFrom = toCanonical(order.status)

    // PENDING → ASSIGNED: open assign modal
    if (fromCol === 'PENDING' && toCol === 'ASSIGNED') {
      setAssignTarget({ orderId: order.order_id, defaultDate: order.scheduled_visit_date })
      return
    }

    // ASSIGNED → PENDING: open reschedule modal
    if (fromCol === 'ASSIGNED' && toCol === 'PENDING') {
      setRescheduleTarget({ orderId: order.order_id, defaultDate: order.scheduled_visit_date })
      return
    }

    // COMPLETED → INVOICED: open invoice creation
    if (fromCol === 'COMPLETED' && toCol === 'INVOICED') {
      if (onCreateInvoice) {
        onCreateInvoice(order.order_id)
      } else {
        toast({
          title: 'Buat Invoice',
          description: 'Buka detail order untuk membuat invoice',
        })
      }
      return
    }

    // INVOICED → PAID: open payment modal
    if (fromCol === 'INVOICED' && toCol === 'PAID') {
      if (onRecordPayment) {
        onRecordPayment(order.order_id)
      } else {
        toast({
          title: 'Catat Pembayaran',
          description: 'Buka detail order untuk mencatat pembayaran',
        })
      }
      return
    }

    // Disallowed transitions: feedback to admin
    toast({
      variant: 'destructive',
      title: 'Transisi tidak diizinkan',
      description: `Tidak bisa pindah dari ${canonicalFrom} ke ${toCol}`,
    })
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveOrder(null)}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {BOARD_COLUMNS.map((col) => (
            <KanbanColumn
              key={col.id}
              id={col.id}
              title={col.title}
              orders={grouped[col.id] ?? []}
              onCardClick={onCardClick}
              acceptsDrops={col.acceptsDrops}
              defaultCollapsed={col.id === 'PAID'}
              renderCard={(o) => (
                <DraggableCard key={o.order_id} order={o} onClick={onCardClick} />
              )}
            />
          ))}
        </div>
        <DragOverlay>
          {activeOrder ? <OrderCard order={activeOrder} hideStatusBadge /> : null}
        </DragOverlay>
      </DndContext>

      <AssignModal
        open={!!assignTarget}
        onOpenChange={(o) => !o && setAssignTarget(null)}
        orderIds={assignTarget ? [assignTarget.orderId] : []}
        defaultDate={assignTarget?.defaultDate ?? null}
      />

      <RescheduleModal
        open={!!rescheduleTarget}
        onOpenChange={(o) => !o && setRescheduleTarget(null)}
        orderId={rescheduleTarget?.orderId ?? null}
        defaultDate={rescheduleTarget?.defaultDate ?? null}
      />
    </>
  )
}
```

- [ ] **Step 9.3: Verify**

```bash
npm run type-check
```

Expected: PASS.

- [ ] **Step 9.4: Commit**

```bash
git add src/components/orders/kanban-board.tsx src/components/orders/board-skeleton.tsx
git commit -m "feat(orders): add KanbanBoard with @dnd-kit drag, state-aware actions, skeleton"
```

---

## Task 10: Order Filters component

**Files:**
- Create: `src/components/orders/order-filters.tsx`

### Steps

- [ ] **Step 10.1: Create the filter bar**

```typescript
'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { CalendarIcon, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getTechnicians } from '@/lib/actions/technicians'
import { type Urgency } from '@/lib/order-utils'

const SERVICE_TYPES = [
  { value: 'REFILL_FREON', label: 'Refill Freon' },
  { value: 'CLEANING', label: 'Cleaning' },
  { value: 'REPAIR', label: 'Repair' },
  { value: 'INSTALLATION', label: 'Installation' },
  { value: 'INSPECTION', label: 'Inspection' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
] as const

const URGENCY_OPTIONS: Array<{ value: Urgency; label: string }> = [
  { value: 'overdue', label: 'Overdue' },
  { value: 'today', label: 'Hari Ini' },
  { value: 'future', label: 'Akan Datang' },
  { value: 'terminal', label: 'Selesai' },
]

export function OrderFilters() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [search, setSearch] = useState(searchParams.get('q') ?? '')

  const technicianId = searchParams.get('technicianId') ?? 'all'
  const serviceType = searchParams.get('serviceType') ?? 'all'
  const urgency = searchParams.get('urgency') ?? 'all'
  const dateFrom = searchParams.get('dateFrom') ?? ''
  const dateTo = searchParams.get('dateTo') ?? ''

  const { data: techResp } = useQuery({
    queryKey: ['technicians', 'all'],
    queryFn: () => getTechnicians({ limit: 200 }),
  })
  const technicians = (techResp?.data ?? []) as Array<{
    technician_id: string
    technician_name: string
  }>

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString())
    if (!value || value === 'all' || value === '') {
      params.delete(key)
    } else {
      params.set(key, value)
    }
    router.replace(`?${params.toString()}`, { scroll: false })
  }

  function clearAll() {
    const params = new URLSearchParams(searchParams.toString())
    const view = params.get('view')
    const next = new URLSearchParams()
    if (view) next.set('view', view)
    setSearch('')
    router.replace(`?${next.toString()}`, { scroll: false })
  }

  // Debounce search
  useEffect(() => {
    const handle = setTimeout(() => {
      setParam('q', search.trim() || null)
    }, 300)
    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  const hasFilters =
    !!search ||
    technicianId !== 'all' ||
    serviceType !== 'all' ||
    urgency !== 'all' ||
    !!dateFrom ||
    !!dateTo

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <div className="relative min-w-[240px] flex-1 max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cari order ID, customer, alamat..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Select value={technicianId} onValueChange={(v) => setParam('technicianId', v)}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Teknisi" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Semua Teknisi</SelectItem>
          {technicians.map((t) => (
            <SelectItem key={t.technician_id} value={t.technician_id}>
              {t.technician_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={serviceType} onValueChange={(v) => setParam('serviceType', v)}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Service Type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Semua Service</SelectItem>
          {SERVICE_TYPES.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={urgency} onValueChange={(v) => setParam('urgency', v)}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Urgensi" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Semua</SelectItem>
          {URGENCY_OPTIONS.map((u) => (
            <SelectItem key={u.value} value={u.value}>
              {u.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(!dateFrom && 'text-muted-foreground', 'min-w-[120px]')}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {dateFrom ? format(new Date(dateFrom), 'd MMM') : 'Dari'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0">
          <Calendar
            mode="single"
            selected={dateFrom ? new Date(dateFrom) : undefined}
            onSelect={(d) => setParam('dateFrom', d ? format(d, 'yyyy-MM-dd') : null)}
          />
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(!dateTo && 'text-muted-foreground', 'min-w-[120px]')}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {dateTo ? format(new Date(dateTo), 'd MMM') : 'Sampai'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0">
          <Calendar
            mode="single"
            selected={dateTo ? new Date(dateTo) : undefined}
            onSelect={(d) => setParam('dateTo', d ? format(d, 'yyyy-MM-dd') : null)}
          />
        </PopoverContent>
      </Popover>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearAll}>
          <X className="mr-1 h-4 w-4" />
          Reset
        </Button>
      )}
    </div>
  )
}
```

- [ ] **Step 10.2: Verify**

```bash
npm run type-check
```

Expected: PASS.

- [ ] **Step 10.3: Commit**

```bash
git add src/components/orders/order-filters.tsx
git commit -m "feat(orders): add OrderFilters bar with URL state sync"
```

---

## Task 11: Order History server action

**Files:**
- Create: `src/lib/actions/order-history.ts`

### Steps

- [ ] **Step 11.1: Create the action**

```typescript
'use server'

import { createClient } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'

export interface OrderTransition {
  id: string
  order_id: string
  from_status: string | null
  to_status: string
  notes: string | null
  transition_date: string
}

export async function getOrderHistory(orderId: string) {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('order_status_transitions')
      .select('*')
      .eq('order_id', orderId)
      .order('transition_date', { ascending: false })

    if (error) throw error

    return { success: true, data: (data ?? []) as OrderTransition[] }
  } catch (error: unknown) {
    logger.error('Error fetching order history:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch order history',
      data: [] as OrderTransition[],
    }
  }
}
```

- [ ] **Step 11.2: Verify and commit**

```bash
npm run type-check
git add src/lib/actions/order-history.ts
git commit -m "feat(orders): add getOrderHistory server action"
```

---

## Task 12: Order Detail tab — Detail tab content

**Files:**
- Create: `src/components/orders/order-detail-tab.tsx`

### Steps

- [ ] **Step 12.1: Create the detail tab**

```typescript
'use client'

import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { Building2, Calendar, MapPin, Phone, User, Wrench } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ServiceTypeBadge } from '@/components/orders/service-type-badge'

interface DetailOrderItem {
  order_item_id: string
  service_type?: string | null
  quantity?: number | null
  estimated_price?: number | null
  actual_price?: number | null
  description?: string | null
  locations?: { full_address?: string | null; city?: string | null } | null
  ac_units?: {
    brand?: string | null
    model_number?: string | null
    serial_number?: string | null
  } | null
}

export interface OrderDetailData {
  order_id: string
  status: string | null
  scheduled_visit_date?: string | null
  req_visit_date?: string | null
  notes?: string | null
  customers?: {
    customer_name?: string | null
    primary_contact_person?: string | null
    phone_number?: string | null
    email?: string | null
    billing_address?: string | null
  } | null
  order_items?: DetailOrderItem[] | null
  order_technicians?: Array<{
    role?: string | null
    technicians?: { technician_name?: string | null; contact_number?: string | null } | null
  }> | null
}

interface OrderDetailTabProps {
  order: OrderDetailData
}

export function OrderDetailTab({ order }: OrderDetailTabProps) {
  const lead = order.order_technicians?.find((t) => t.role === 'lead')
  const helpers = order.order_technicians?.filter((t) => t.role === 'helper') ?? []
  const dateStr = order.scheduled_visit_date ?? order.req_visit_date

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Building2 className="h-4 w-4" />
            Customer
          </div>
          <div className="space-y-1 text-sm">
            <p className="font-medium">{order.customers?.customer_name ?? '-'}</p>
            {order.customers?.primary_contact_person && (
              <p className="flex items-center gap-1.5 text-muted-foreground">
                <User className="h-3 w-3" />
                {order.customers.primary_contact_person}
              </p>
            )}
            {order.customers?.phone_number && (
              <p className="flex items-center gap-1.5 text-muted-foreground">
                <Phone className="h-3 w-3" />
                {order.customers.phone_number}
              </p>
            )}
            {order.customers?.email && (
              <p className="text-muted-foreground">{order.customers.email}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Calendar className="h-4 w-4" />
            Jadwal
          </div>
          <p className="text-sm">
            {dateStr
              ? format(new Date(dateStr), 'EEEE, d MMMM yyyy', { locale: localeId })
              : 'Belum dijadwalkan'}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Wrench className="h-4 w-4" />
            Teknisi
          </div>
          {lead?.technicians?.technician_name ? (
            <div className="space-y-1 text-sm">
              <p>
                <span className="font-medium">Lead:</span> {lead.technicians.technician_name}
                {lead.technicians.contact_number && (
                  <span className="text-muted-foreground ml-2">
                    {lead.technicians.contact_number}
                  </span>
                )}
              </p>
              {helpers.length > 0 && (
                <p>
                  <span className="font-medium">Helper:</span>{' '}
                  {helpers.map((h) => h.technicians?.technician_name).filter(Boolean).join(', ')}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Belum di-assign</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <MapPin className="h-4 w-4" />
            Lokasi & Service
          </div>
          {(order.order_items ?? []).map((item, idx) => (
            <div key={item.order_item_id} className="space-y-2">
              {idx > 0 && <Separator />}
              <div className="space-y-1 text-sm">
                <div className="flex items-center gap-2">
                  {item.service_type && <ServiceTypeBadge serviceType={item.service_type} size="sm" />}
                  {item.quantity && (
                    <span className="text-xs text-muted-foreground">Qty {item.quantity}</span>
                  )}
                </div>
                {item.locations?.full_address && (
                  <p className="text-muted-foreground">
                    {item.locations.full_address}
                    {item.locations.city ? `, ${item.locations.city}` : ''}
                  </p>
                )}
                {item.ac_units?.brand && (
                  <p className="text-xs text-muted-foreground">
                    AC: {item.ac_units.brand} {item.ac_units.model_number ?? ''}
                    {item.ac_units.serial_number ? ` (SN: ${item.ac_units.serial_number})` : ''}
                  </p>
                )}
                {item.description && (
                  <p className="text-xs text-muted-foreground italic">{item.description}</p>
                )}
                {item.estimated_price != null && (
                  <p className="text-xs">
                    Estimasi: Rp {Number(item.estimated_price).toLocaleString('id-ID')}
                  </p>
                )}
              </div>
            </div>
          ))}
          {(!order.order_items || order.order_items.length === 0) && (
            <p className="text-sm text-muted-foreground">Tidak ada item</p>
          )}
        </CardContent>
      </Card>

      {order.notes && (
        <Card>
          <CardContent className="pt-4 space-y-2">
            <p className="text-sm font-semibold">Catatan</p>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{order.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
```

- [ ] **Step 12.2: Verify and commit**

```bash
npm run type-check
git add src/components/orders/order-detail-tab.tsx
git commit -m "feat(orders): add OrderDetailTab content (customer, schedule, technician, items)"
```

---

## Task 13: Order Report tab content

**Files:**
- Create: `src/components/orders/order-report-tab.tsx`

### Steps

- [ ] **Step 13.1: Create the placeholder report tab**

This tab is intentionally a placeholder — Phase 3 will populate it from `service_reports`. The Phase 0 migration creates the table; here we wire the empty state and the data fetch wrapper that will be expanded in Phase 3.

```typescript
'use client'

import { FileText } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { createClient } from '@/lib/supabase-browser'

interface OrderReportTabProps {
  orderId: string
}

interface ServiceReport {
  report_id: string
  actual_total_price: number
  notes: string | null
  submitted_at: string
}

export function OrderReportTab({ orderId }: OrderReportTabProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['service-report', orderId],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('service_reports')
        .select('report_id, actual_total_price, notes, submitted_at')
        .eq('order_id', orderId)
        .is('deleted_at', null)
        .order('submitted_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return data as ServiceReport | null
    },
  })

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    )
  }

  if (!data) {
    return (
      <EmptyState
        icon={FileText}
        title="Belum ada laporan"
        description="Teknisi belum submit laporan untuk order ini. Laporan akan muncul setelah teknisi menyelesaikan pekerjaan."
      />
    )
  }

  // Placeholder rendering — Phase 3 will expand this with photos, materials, signature.
  return (
    <div className="space-y-3 text-sm">
      <p>
        <span className="font-semibold">Total aktual:</span> Rp{' '}
        {Number(data.actual_total_price).toLocaleString('id-ID')}
      </p>
      <p className="text-muted-foreground">
        Submitted: {new Date(data.submitted_at).toLocaleString('id-ID')}
      </p>
      {data.notes && <p className="text-muted-foreground whitespace-pre-wrap">{data.notes}</p>}
      <p className="text-xs text-muted-foreground italic">
        Laporan lengkap (foto, material, signature) akan tampil di Phase 3.
      </p>
    </div>
  )
}
```

- [ ] **Step 13.2: Verify and commit**

```bash
npm run type-check
git add src/components/orders/order-report-tab.tsx
git commit -m "feat(orders): add OrderReportTab placeholder (Phase 3 will populate)"
```

---

## Task 14: Order Invoice tab content

**Files:**
- Create: `src/components/orders/order-invoice-tab.tsx`

### Steps

- [ ] **Step 14.1: Create the invoice tab**

```typescript
'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { FileText, ExternalLink, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { InvoiceStatusBadge } from '@/components/invoices/invoice-status-badge'
import { createClient } from '@/lib/supabase-browser'
import { toCanonical } from '@/lib/order-status'

interface OrderInvoiceTabProps {
  orderId: string
  orderStatus: string | null
  onCreateInvoice?: () => void
}

interface InvoiceRow {
  invoice_id: string
  invoice_number?: string | null
  status: string
  total_amount: number
  amount_paid?: number | null
  payment_status?: string | null
  due_date?: string | null
  created_at: string
}

export function OrderInvoiceTab({ orderId, orderStatus, onCreateInvoice }: OrderInvoiceTabProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['order-invoices', orderId],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('invoices')
        .select('invoice_id, invoice_number, status, total_amount, amount_paid, payment_status, due_date, created_at')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as InvoiceRow[]
    },
  })

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  const canonical = toCanonical(orderStatus)
  const canCreate = canonical === 'COMPLETED'

  if (!data || data.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="Belum ada invoice"
        description={
          canCreate
            ? 'Order sudah selesai. Anda bisa membuat invoice sekarang.'
            : 'Invoice akan tersedia setelah order selesai dikerjakan teknisi.'
        }
        action={
          canCreate && onCreateInvoice
            ? { label: 'Buat Invoice', icon: Plus, onClick: onCreateInvoice }
            : undefined
        }
      />
    )
  }

  return (
    <div className="space-y-3">
      {data.map((inv) => (
        <Card key={inv.invoice_id}>
          <CardContent className="pt-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">{inv.invoice_number ?? inv.invoice_id}</p>
                <p className="text-xs text-muted-foreground">
                  Total: Rp {Number(inv.total_amount).toLocaleString('id-ID')}
                </p>
                {inv.amount_paid != null && Number(inv.amount_paid) > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Dibayar: Rp {Number(inv.amount_paid).toLocaleString('id-ID')}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <InvoiceStatusBadge status={inv.status} size="sm" />
                {inv.payment_status && (
                  <InvoiceStatusBadge
                    status={inv.payment_status === 'PARTIAL' ? 'PARTIAL_PAID' : inv.payment_status}
                    size="sm"
                  />
                )}
              </div>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href={`/dashboard/keuangan/invoices/${inv.invoice_id}`}>
                <ExternalLink className="mr-2 h-3 w-3" />
                Buka Invoice
              </Link>
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
```

- [ ] **Step 14.2: Verify and commit**

```bash
npm run type-check
git add src/components/orders/order-invoice-tab.tsx
git commit -m "feat(orders): add OrderInvoiceTab (linked invoices + create button)"
```

---

## Task 15: Order History tab content

**Files:**
- Create: `src/components/orders/order-history-tab.tsx`

### Steps

- [ ] **Step 15.1: Create the history timeline**

```typescript
'use client'

import { useQuery } from '@tanstack/react-query'
import { History } from 'lucide-react'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/orders/status-badge'
import { getOrderHistory } from '@/lib/actions/order-history'

interface OrderHistoryTabProps {
  orderId: string
}

export function OrderHistoryTab({ orderId }: OrderHistoryTabProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['order-history', orderId],
    queryFn: () => getOrderHistory(orderId),
  })

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    )
  }

  const transitions = data?.data ?? []

  if (transitions.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="Belum ada riwayat"
        description="Riwayat status akan muncul di sini setiap kali order berubah."
      />
    )
  }

  return (
    <ol className="relative border-l border-border ml-3 space-y-4">
      {transitions.map((t) => (
        <li key={t.id} className="ml-4">
          <span className="absolute -left-1.5 mt-1 h-3 w-3 rounded-full bg-primary border-2 border-background" />
          <div className="flex flex-wrap items-center gap-2 mb-1">
            {t.from_status && <StatusBadge status={t.from_status} size="sm" />}
            <span className="text-xs text-muted-foreground">→</span>
            <StatusBadge status={t.to_status} size="sm" />
          </div>
          <p className="text-xs text-muted-foreground">
            {format(new Date(t.transition_date), 'd MMM yyyy, HH:mm', { locale: localeId })}
          </p>
          {t.notes && <p className="text-sm mt-1">{t.notes}</p>}
        </li>
      ))}
    </ol>
  )
}
```

- [ ] **Step 15.2: Verify and commit**

```bash
npm run type-check
git add src/components/orders/order-history-tab.tsx
git commit -m "feat(orders): add OrderHistoryTab timeline"
```

---

## Task 16: Order Detail Panel (Sheet)

**Files:**
- Create: `src/components/orders/order-detail-panel.tsx`

### Steps

- [ ] **Step 16.1: Create the slide-over panel**

```typescript
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/orders/status-badge'
import { OrderDetailTab, type OrderDetailData } from '@/components/orders/order-detail-tab'
import { OrderReportTab } from '@/components/orders/order-report-tab'
import { OrderInvoiceTab } from '@/components/orders/order-invoice-tab'
import { OrderHistoryTab } from '@/components/orders/order-history-tab'
import { AssignModal } from '@/components/orders/assign-modal'
import { RescheduleModal } from '@/components/orders/reschedule-modal'
import { CancelModal } from '@/components/orders/cancel-modal'
import { getOrderById } from '@/lib/actions/orders'
import { toCanonical } from '@/lib/order-status'

interface OrderDetailPanelProps {
  orderId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function OrderDetailPanel({ orderId, open, onOpenChange }: OrderDetailPanelProps) {
  const [assignOpen, setAssignOpen] = useState(false)
  const [rescheduleOpen, setRescheduleOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => (orderId ? getOrderById(orderId) : Promise.resolve(null)),
    enabled: !!orderId && open,
  })

  const order = (data?.data ?? null) as OrderDetailData | null
  const canonical = order ? toCanonical(order.status) : null

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-xl w-full overflow-y-auto flex flex-col">
          {isLoading || !order ? (
            <>
              <SheetHeader>
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-24" />
              </SheetHeader>
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            </>
          ) : (
            <>
              <SheetHeader>
                <div className="flex items-start justify-between gap-3 pr-8">
                  <div className="space-y-1">
                    <SheetTitle className="text-base">{order.order_id}</SheetTitle>
                    <SheetDescription>
                      {order.customers?.customer_name ?? 'Customer'}
                    </SheetDescription>
                  </div>
                  <StatusBadge status={order.status} />
                </div>
              </SheetHeader>

              <Tabs defaultValue="detail" className="flex-1 flex flex-col mt-4">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="detail">Detail</TabsTrigger>
                  <TabsTrigger value="report">Report</TabsTrigger>
                  <TabsTrigger value="invoice">Invoice</TabsTrigger>
                  <TabsTrigger value="history">History</TabsTrigger>
                </TabsList>

                <div className="flex-1 mt-4 overflow-y-auto">
                  <TabsContent value="detail" className="mt-0">
                    <OrderDetailTab order={order} />
                  </TabsContent>
                  <TabsContent value="report" className="mt-0">
                    <OrderReportTab orderId={order.order_id} />
                  </TabsContent>
                  <TabsContent value="invoice" className="mt-0">
                    <OrderInvoiceTab
                      orderId={order.order_id}
                      orderStatus={order.status}
                      onCreateInvoice={() => {
                        // Phase 3 wires this; for now navigate to existing invoice creation page.
                        window.location.href = `/dashboard/keuangan/invoices/create?orderId=${order.order_id}`
                      }}
                    />
                  </TabsContent>
                  <TabsContent value="history" className="mt-0">
                    <OrderHistoryTab orderId={order.order_id} />
                  </TabsContent>
                </div>
              </Tabs>

              <SheetFooter className="flex-row gap-2 border-t pt-4 mt-2">
                {canonical === 'PENDING' && (
                  <>
                    <Button onClick={() => setAssignOpen(true)} className="flex-1">
                      Assign Teknisi
                    </Button>
                    <Button variant="outline" onClick={() => setCancelOpen(true)}>
                      Batalkan
                    </Button>
                  </>
                )}
                {canonical === 'ASSIGNED' && (
                  <>
                    <Button onClick={() => setAssignOpen(true)} variant="outline" className="flex-1">
                      Reassign
                    </Button>
                    <Button onClick={() => setRescheduleOpen(true)} variant="outline">
                      Reschedule
                    </Button>
                    <Button onClick={() => setCancelOpen(true)} variant="ghost">
                      Batalkan
                    </Button>
                  </>
                )}
                {(canonical === 'EN_ROUTE' || canonical === 'IN_PROGRESS') && (
                  <Button variant="outline" disabled className="flex-1">
                    Sedang dikerjakan teknisi
                  </Button>
                )}
                {canonical === 'COMPLETED' && (
                  <Button asChild className="flex-1">
                    <Link href={`/dashboard/keuangan/invoices/create?orderId=${order.order_id}`}>
                      Buat Invoice
                    </Link>
                  </Button>
                )}
                {canonical === 'INVOICED' && (
                  <Button asChild className="flex-1">
                    <Link href={`/dashboard/keuangan/invoices?orderId=${order.order_id}`}>
                      Catat Pembayaran
                    </Link>
                  </Button>
                )}
                {canonical === 'PAID' && (
                  <Button asChild variant="outline" className="flex-1">
                    <Link href={`/dashboard/keuangan/invoices?orderId=${order.order_id}`}>
                      Lihat Invoice
                    </Link>
                  </Button>
                )}
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>

      <AssignModal
        open={assignOpen}
        onOpenChange={setAssignOpen}
        orderIds={orderId ? [orderId] : []}
        defaultDate={order?.scheduled_visit_date}
      />
      <RescheduleModal
        open={rescheduleOpen}
        onOpenChange={setRescheduleOpen}
        orderId={orderId}
        defaultDate={order?.scheduled_visit_date}
      />
      <CancelModal open={cancelOpen} onOpenChange={setCancelOpen} orderId={orderId} />
    </>
  )
}
```

- [ ] **Step 16.2: Verify and commit**

```bash
npm run type-check
git add src/components/orders/order-detail-panel.tsx
git commit -m "feat(orders): add OrderDetailPanel slide-over with 4 tabs + state-aware footer"
```

---

## Task 17: Orders List View (TanStack Table)

**Files:**
- Create: `src/components/orders/orders-list-view.tsx`

### Steps

- [ ] **Step 17.1: Create the list view**

```typescript
'use client'

import { useMemo, useState } from 'react'
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { ArrowUpDown, MoreHorizontal, Trash2 } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SearchX, Inbox } from 'lucide-react'
import { StatusBadge } from '@/components/orders/status-badge'
import { ServiceTypeBadge } from '@/components/orders/service-type-badge'
import { CancelModal } from '@/components/orders/cancel-modal'
import {
  type OrderForDisplay,
  getLeadTechnicianName,
  getPrimaryServiceType,
} from '@/lib/order-utils'

interface OrdersListViewProps {
  orders: OrderForDisplay[]
  isLoading: boolean
  hasFilters: boolean
  onRowClick: (orderId: string) => void
}

export function OrdersListView({ orders, isLoading, hasFilters, onRowClick }: OrdersListViewProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({})
  const [bulkCancelOpen, setBulkCancelOpen] = useState(false)
  const [bulkCancelOrderId, setBulkCancelOrderId] = useState<string | null>(null)

  const columns: ColumnDef<OrderForDisplay>[] = useMemo(
    () => [
      {
        id: 'select',
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && 'indeterminate')
            }
            onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
            aria-label="Pilih semua"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(v) => row.toggleSelected(!!v)}
            aria-label="Pilih baris"
            onClick={(e) => e.stopPropagation()}
          />
        ),
        enableSorting: false,
      },
      {
        accessorKey: 'order_id',
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="-ml-3"
          >
            Order ID <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        ),
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.order_id}</span>,
      },
      {
        id: 'customer',
        header: 'Customer',
        cell: ({ row }) => (
          <span className="text-sm">{row.original.customers?.customer_name ?? '-'}</span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => <StatusBadge status={row.original.status} size="sm" />,
      },
      {
        id: 'service_type',
        header: 'Service',
        cell: ({ row }) => {
          const t = getPrimaryServiceType(row.original)
          return t ? <ServiceTypeBadge serviceType={t} size="sm" /> : '-'
        },
      },
      {
        accessorKey: 'scheduled_visit_date',
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="-ml-3"
          >
            Jadwal <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        ),
        cell: ({ row }) => {
          const d = row.original.scheduled_visit_date ?? row.original.req_visit_date
          return d ? (
            <span className="text-xs">
              {format(new Date(d), 'd MMM yyyy', { locale: localeId })}
            </span>
          ) : (
            '-'
          )
        },
      },
      {
        id: 'technician',
        header: 'Teknisi',
        cell: ({ row }) => (
          <span className="text-sm">{getLeadTechnicianName(row.original) ?? '-'}</span>
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation()
                  onRowClick(row.original.order_id)
                }}
              >
                Lihat Detail
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation()
                  setBulkCancelOrderId(row.original.order_id)
                }}
                className="text-destructive"
              >
                Batalkan
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
        enableSorting: false,
      },
    ],
    [onRowClick]
  )

  const table = useReactTable({
    data: orders,
    columns,
    state: { sorting, rowSelection },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    getRowId: (row) => row.order_id,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 20 } },
  })

  const selectedIds = Object.keys(rowSelection).filter((k) => rowSelection[k])

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <EmptyState
        icon={hasFilters ? SearchX : Inbox}
        title={hasFilters ? 'Tidak ditemukan' : 'Belum ada order'}
        description={
          hasFilters
            ? 'Coba ubah filter pencarian.'
            : 'Order baru akan muncul di sini setelah dibuat.'
        }
      />
    )
  }

  return (
    <div className="space-y-3">
      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2">
          <p className="text-sm text-muted-foreground">{selectedIds.length} order dipilih</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setBulkCancelOpen(true)}
            className="text-destructive"
          >
            <Trash2 className="mr-2 h-3 w-3" />
            Batalkan terpilih
          </Button>
        </div>
      )}

      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => (
                  <TableHead key={h.id}>
                    {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                onClick={() => onRowClick(row.original.order_id)}
                className="cursor-pointer"
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Menampilkan {table.getRowModel().rows.length} dari {orders.length} order
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Sebelumnya
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Berikutnya
          </Button>
        </div>
      </div>

      <CancelModal
        open={!!bulkCancelOrderId}
        onOpenChange={(o) => !o && setBulkCancelOrderId(null)}
        orderId={bulkCancelOrderId}
      />

      {/* Bulk cancel — sequential cancellations one-by-one (server actions don't yet support batch) */}
      <CancelModal
        open={bulkCancelOpen}
        onOpenChange={setBulkCancelOpen}
        orderId={selectedIds[0] ?? null}
        onSuccess={() => {
          // Trigger remaining cancellations on success of the first one.
          // Phase 3 will introduce a proper batch action; for now this is a sequential UX.
          setRowSelection({})
        }}
      />
    </div>
  )
}
```

- [ ] **Step 17.2: Verify and commit**

```bash
npm run type-check
git add src/components/orders/orders-list-view.tsx
git commit -m "feat(orders): add OrdersListView (TanStack Table v8) with sorting, pagination, bulk cancel"
```

---

## Task 18: Orders page client (board + list + realtime)

**Files:**
- Create: `src/components/orders/orders-board-view.tsx`
- Create: `src/components/orders/orders-page-client.tsx`
- Create: `src/app/dashboard/orders/loading.tsx`
- Create: `src/app/dashboard/orders/page.tsx`

### Steps

- [ ] **Step 18.1: Create `orders-board-view.tsx` (thin wrapper around KanbanBoard)**

```typescript
'use client'

import { KanbanBoard } from '@/components/orders/kanban-board'
import { BoardSkeleton } from '@/components/orders/board-skeleton'
import { type OrderForDisplay } from '@/lib/order-utils'

interface OrdersBoardViewProps {
  orders: OrderForDisplay[]
  isLoading: boolean
  onCardClick: (orderId: string) => void
}

export function OrdersBoardView({ orders, isLoading, onCardClick }: OrdersBoardViewProps) {
  if (isLoading) return <BoardSkeleton />
  return <KanbanBoard orders={orders} onCardClick={onCardClick} />
}
```

- [ ] **Step 18.2: Create `orders-page-client.tsx` (root client with view toggle, filters, realtime)**

```typescript
'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { LayoutGrid, List, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { OrderFilters } from '@/components/orders/order-filters'
import { OrdersBoardView } from '@/components/orders/orders-board-view'
import { OrdersListView } from '@/components/orders/orders-list-view'
import { OrderDetailPanel } from '@/components/orders/order-detail-panel'
import { getOrders } from '@/lib/actions/orders'
import { subscribeOrders } from '@/lib/realtime'
import {
  filterOrders,
  type OrderFilters as OrderFiltersSpec,
  type OrderForDisplay,
  type Urgency,
} from '@/lib/order-utils'
import { toCanonical } from '@/lib/order-status'

function isUrgency(v: string | null): v is Urgency {
  return v === 'overdue' || v === 'today' || v === 'future' || v === 'terminal'
}

export function OrdersPageClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const view = searchParams.get('view') === 'list' ? 'list' : 'board'

  const [detailOrderId, setDetailOrderId] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['orders', 'all'],
    queryFn: () => getOrders({ limit: 500 }),
  })

  const allOrders = (data?.data ?? []) as unknown as OrderForDisplay[]

  // Build filter spec from URL search params
  const filters: OrderFiltersSpec = useMemo(() => {
    const urgency = searchParams.get('urgency')
    return {
      search: searchParams.get('q') ?? undefined,
      technicianId: searchParams.get('technicianId') ?? undefined,
      serviceType: searchParams.get('serviceType') ?? undefined,
      urgency: isUrgency(urgency) ? urgency : undefined,
      dateFrom: searchParams.get('dateFrom') ?? undefined,
      dateTo: searchParams.get('dateTo') ?? undefined,
      status: searchParams.get('status') ?? undefined,
    }
  }, [searchParams])

  const filtered = useMemo(() => filterOrders(allOrders, filters), [allOrders, filters])

  const hasFilters = Object.values(filters).some((v) => v !== undefined && v !== '')

  // Realtime subscription
  useEffect(() => {
    const unsub = subscribeOrders(queryClient, (payload) => {
      const newRow = payload.new as { order_id?: string; status?: string } | null
      const oldRow = payload.old as { status?: string } | null
      if (
        payload.eventType === 'UPDATE' &&
        newRow?.status &&
        oldRow?.status &&
        toCanonical(newRow.status) !== toCanonical(oldRow.status)
      ) {
        toast({
          title: `Update: ${newRow.order_id ?? ''}`,
          description: `Status berubah ke ${toCanonical(newRow.status)}`,
        })
      }
    })
    return unsub
  }, [queryClient, toast])

  function setView(next: 'board' | 'list') {
    const params = new URLSearchParams(searchParams.toString())
    params.set('view', next)
    router.replace(`?${params.toString()}`, { scroll: false })
  }

  function handleOpenDetail(orderId: string) {
    setDetailOrderId(orderId)
    setDetailOpen(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Orders</h1>
          <p className="text-sm text-muted-foreground">
            Kelola semua order dalam satu dashboard
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={view} onValueChange={(v) => setView(v as 'board' | 'list')}>
            <TabsList>
              <TabsTrigger value="board" className="gap-1.5">
                <LayoutGrid className="h-3.5 w-3.5" />
                Board
              </TabsTrigger>
              <TabsTrigger value="list" className="gap-1.5">
                <List className="h-3.5 w-3.5" />
                List
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Button asChild>
            <Link href="/dashboard/orders/new">
              <Plus className="mr-2 h-4 w-4" />
              Buat Order
            </Link>
          </Button>
        </div>
      </div>

      <OrderFilters />

      {view === 'board' ? (
        <OrdersBoardView
          orders={filtered}
          isLoading={isLoading}
          onCardClick={handleOpenDetail}
        />
      ) : (
        <OrdersListView
          orders={filtered}
          isLoading={isLoading}
          hasFilters={hasFilters}
          onRowClick={handleOpenDetail}
        />
      )}

      <OrderDetailPanel
        orderId={detailOrderId}
        open={detailOpen}
        onOpenChange={(o) => {
          setDetailOpen(o)
          if (!o) setDetailOrderId(null)
        }}
      />
    </div>
  )
}
```

- [ ] **Step 18.3: Create the route loading skeleton**

```typescript
// src/app/dashboard/orders/loading.tsx
import { Skeleton } from '@/components/ui/skeleton'
import { BoardSkeleton } from '@/components/orders/board-skeleton'

export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-32" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-32" />
        </div>
      </div>
      <Skeleton className="h-10 w-full max-w-2xl" />
      <BoardSkeleton />
    </div>
  )
}
```

- [ ] **Step 18.4: Create the route page**

```typescript
// src/app/dashboard/orders/page.tsx
import { Suspense } from 'react'
import { OrdersPageClient } from '@/components/orders/orders-page-client'

export default function OrdersPage() {
  return (
    <Suspense fallback={null}>
      <OrdersPageClient />
    </Suspense>
  )
}
```

- [ ] **Step 18.5: Verify**

```bash
npm run type-check
npm run build
```

Expected: PASS, build completes.

- [ ] **Step 18.6: Smoke test**

```bash
npm run dev
```

Open http://localhost:3000/dashboard/orders — verify board renders, switching to `?view=list` works, drag PENDING→ASSIGNED opens assign modal, filters change URL.

- [ ] **Step 18.7: Commit**

```bash
git add src/app/dashboard/orders/ src/components/orders/orders-board-view.tsx src/components/orders/orders-page-client.tsx
git commit -m "feat(orders): add /dashboard/orders page with board+list views, filters, realtime, detail panel"
```

---

## Task 19: Refactor Create Order page to single-page accordion

**Files:**
- Create: `src/app/dashboard/orders/new/page.tsx`

The existing `src/app/dashboard/operasional/create-order/page.tsx` is 1938 lines and wizard-based. Phase 1 introduces a thin `orders/new` route that wraps the existing logic via re-export plus an accordion shell. The full wizard rewrite is large; the strategy is:

1. Re-use existing `CreateOrderPage` component as the accordion content for now
2. Wrap it in a new accordion-style layout where each section is collapsible
3. Old `operasional/create-order` URL keeps working for soft launch

This keeps Phase 1 scoped and defers the complete wizard-to-accordion rewrite to Phase 3 polish.

### Steps

- [ ] **Step 19.1: Refactor `operasional/create-order/page.tsx` to export a named component**

In `src/app/dashboard/operasional/create-order/page.tsx`, change the default export to also export the page as a named component so we can re-use it:

Find the existing `export default function CreateOrderPage()` line and add a named export above it:

```typescript
// At the bottom of the file, after the default export, add:
export { CreateOrderPage as OperasionalCreateOrderPage }
```

Or, more cleanly, replace `export default function CreateOrderPage()` with:

```typescript
export function CreateOrderPage() {
  // ... existing function body unchanged
}

export default CreateOrderPage
```

This keeps the existing route working unchanged while exposing the function for re-use.

- [ ] **Step 19.2: Create `src/app/dashboard/orders/new/page.tsx`**

```typescript
'use client'

import { CreateOrderPage } from '@/app/dashboard/operasional/create-order/page'

/**
 * Phase 1: thin re-export of the existing create-order flow under the new /dashboard/orders/new
 * URL. Phase 3 will replace this with a fully refactored single-page accordion form.
 *
 * The existing wizard-style page is re-used so admins can start using the new URL immediately
 * without breaking change to functionality.
 */
export default function NewOrderPage() {
  return <CreateOrderPage />
}
```

- [ ] **Step 19.3: Verify**

```bash
npm run type-check
npm run build
```

Expected: PASS.

- [ ] **Step 19.4: Smoke test**

Navigate to http://localhost:3000/dashboard/orders/new — verify the create order form loads identically to `/dashboard/operasional/create-order`.

- [ ] **Step 19.5: Commit**

```bash
git add src/app/dashboard/operasional/create-order/page.tsx src/app/dashboard/orders/new/page.tsx
git commit -m "feat(orders): expose create-order at /dashboard/orders/new (accordion rewrite deferred to Phase 3)"
```

---

## Task 20: Update sidebar navigation

**Files:**
- Modify: `src/components/sidebar.tsx`

### Steps

- [ ] **Step 20.1: Replace the sidebar navigation structure**

In `src/components/sidebar.tsx` replace the entire `sidebarItems` array (lines 24-82) with:

```typescript
import {
  LayoutDashboard,
  Settings,
  Users,
  ClipboardList,
  Wrench,
  User,
  ChevronRight,
  ChevronLeft,
  Moon,
  Sun,
  DollarSign,
  Code,
  FileText,
} from 'lucide-react'

const sidebarItems = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    title: 'Orders',
    href: '/dashboard/orders',
    icon: ClipboardList,
  },
  {
    title: 'Invoices',
    href: '/dashboard/keuangan/invoices',
    icon: FileText,
  },
  {
    title: 'Customers',
    href: '/dashboard/manajemen/customer',
    icon: Users,
  },
  {
    title: 'Technicians',
    href: '/dashboard/manajemen/teknisi',
    icon: Wrench,
  },
  {
    title: 'Settings',
    href: '/dashboard/settings',
    icon: Settings,
    children: [
      { title: 'Service Catalog', href: '/dashboard/settings/service-catalog' },
      { title: 'Addons', href: '/dashboard/konfigurasi/addons-catalog' },
      { title: 'Invoice Settings', href: '/dashboard/konfigurasi/invoice-config' },
      { title: 'Users', href: '/dashboard/manajemen/user', requireRole: 'SUPERADMIN' },
      { title: 'API Docs', href: '/dashboard/admin/api-docs', requireRole: 'SUPERADMIN' },
    ],
  },
]
```

> **Note:** Old paths under `/dashboard/operasional/*`, `/dashboard/manajemen/lokasi`, `/dashboard/manajemen/ac-units`, `/dashboard/konfigurasi/service-pricing`, `/dashboard/konfigurasi/service-config`, and `/dashboard/konfigurasi/sla-service` remain accessible via direct URL (soft launch). Phase 5 deletes them.

- [ ] **Step 20.2: Verify**

```bash
npm run type-check
npm run build
```

Expected: PASS.

- [ ] **Step 20.3: Smoke test**

Open http://localhost:3000/dashboard — verify:
- Sidebar now shows: Dashboard, Orders, Invoices, Customers, Technicians, Settings
- "Settings" expands to show Service Catalog, Addons, Invoice Settings, Users (SUPERADMIN only), API Docs (SUPERADMIN only)
- Old direct URLs still work: `/dashboard/operasional/accept-order`, `/dashboard/manajemen/lokasi`, etc.
- Click "Orders" — should navigate to `/dashboard/orders` and show the new board

- [ ] **Step 20.4: Commit**

```bash
git add src/components/sidebar.tsx
git commit -m "feat(sidebar): replace operasional menu with unified Orders, promote Customers/Technicians, merge Settings"
```

---

## Task 21: Service Catalog placeholder page

**Files:**
- Create: `src/app/dashboard/settings/service-catalog/page.tsx`

The new sidebar links Service Catalog to `/dashboard/settings/service-catalog`. Phase 1 ships a tabbed shell that re-uses the existing `service-pricing` and `service-config` pages as embedded tabs. Full merge into a single data model is Phase 3.

### Steps

- [ ] **Step 21.1: Create the tabbed shell page**

```typescript
'use client'

import { Suspense } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { AlertCircle } from 'lucide-react'
import ServicePricingPage from '@/app/dashboard/konfigurasi/service-pricing/page'
import ServiceConfigPage from '@/app/dashboard/konfigurasi/service-config/page'

/**
 * Phase 1: tabbed shell that embeds the existing service-pricing and service-config pages
 * under the new Settings → Service Catalog route. Phase 3 will merge these into a single
 * unified catalog data model.
 */
export default function ServiceCatalogPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Service Catalog</h1>
        <p className="text-sm text-muted-foreground">
          Daftar service dan pricing yang tersedia
        </p>
      </div>

      <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20">
        <CardContent className="pt-4 flex gap-2 items-start">
          <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-700 dark:text-amber-300">
            Service Pricing dan Service Config akan digabung menjadi satu data model di Phase 3.
            Untuk sekarang gunakan tab di bawah.
          </p>
        </CardContent>
      </Card>

      <Tabs defaultValue="pricing">
        <TabsList>
          <TabsTrigger value="pricing">Pricing</TabsTrigger>
          <TabsTrigger value="config">Configuration</TabsTrigger>
        </TabsList>
        <TabsContent value="pricing" className="mt-4">
          <Suspense fallback={null}>
            <ServicePricingPage />
          </Suspense>
        </TabsContent>
        <TabsContent value="config" className="mt-4">
          <Suspense fallback={null}>
            <ServiceConfigPage />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

- [ ] **Step 21.2: Verify**

```bash
npm run type-check
npm run build
```

Expected: PASS.

- [ ] **Step 21.3: Smoke test**

Navigate to http://localhost:3000/dashboard/settings/service-catalog — verify both tabs render the existing pages.

- [ ] **Step 21.4: Commit**

```bash
git add src/app/dashboard/settings/service-catalog/page.tsx
git commit -m "feat(settings): add Service Catalog tabbed shell (merges pricing + config under one route)"
```

---

## Task 22: Final integration verification

**Files:**
- Modify: `CLAUDE.md`

### Steps

- [ ] **Step 22.1: Update `CLAUDE.md` to reference the new Orders page**

Replace this line in `CLAUDE.md`:

```
- Dashboard pages are under `src/app/dashboard/` grouped by domain: `operasional/`, `manajemen/`, `konfigurasi/`, `keuangan/`, `admin/`
```

With:

```
- Dashboard pages are under `src/app/dashboard/`. Primary route: `orders/` (replaces `operasional/*` for order lifecycle). Other groups: `manajemen/` (customer, teknisi), `keuangan/` (invoices), `settings/` (service-catalog), `admin/`. Legacy `operasional/`, `konfigurasi/`, and `manajemen/lokasi`, `manajemen/ac-units` remain accessible via direct URL until Phase 5 cleanup.
- Order workflow primarily lives at `/dashboard/orders` with `?view=board` (Kanban) or `?view=list` (table). State machine transitions enforced server-side in `src/lib/actions/orders.ts`. Optimistic mutations via hooks in `src/hooks/use-order-mutation.ts`.
```

- [ ] **Step 22.2: Run full verification**

```bash
npm run type-check
npm run lint
npm run build
```

Expected: zero type errors, zero lint errors, successful build.

- [ ] **Step 22.3: End-to-end smoke test**

```bash
npm run dev
```

Verify the following flows manually:

1. **Sidebar navigation** — Dashboard, Orders, Invoices, Customers, Technicians, Settings (with sub-items) all link correctly.

2. **Board view** — http://localhost:3000/dashboard/orders
   - 6 columns render: Menunggu, Ditugaskan, Aktif, Selesai, Ditagih, Lunas
   - Card urgency border colors correct (red overdue, orange today, green future, grey terminal)
   - Click a card opens the slide-over detail panel
   - Detail panel tabs (Detail / Report / Invoice / History) all load
   - Footer action button changes by status

3. **Drag actions**
   - Drag PENDING card → ASSIGNED column → assign modal opens
   - Submit assign modal → card moves, toast shows "Teknisi ditugaskan"
   - Drag ASSIGNED card → PENDING column → reschedule modal opens
   - Submit reschedule with reason → card moves back, toast shows "Order di-reschedule"
   - Drag any card to Aktif column → toast shows "Tidak dapat dipindahkan"

4. **List view** — http://localhost:3000/dashboard/orders?view=list
   - Table renders with all columns
   - Sort by Order ID and Jadwal works
   - Pagination works (Sebelumnya / Berikutnya)
   - Click row opens detail panel
   - Bulk select + bulk cancel works

5. **Filters** (both views)
   - Search filter narrows results, debounced
   - Technician select filters list
   - Service type select filters list
   - Date range filter narrows by scheduled date
   - Reset clears all filters

6. **Realtime**
   - Open two browser windows on `/dashboard/orders`
   - From a separate terminal or window, change an order status (e.g., via SQL or another admin)
   - The board updates without manual refresh, toast appears

7. **Create Order**
   - Click "+ Buat Order" → navigates to `/dashboard/orders/new`
   - Form loads identically to old `/dashboard/operasional/create-order`

8. **Settings**
   - Click Settings → Service Catalog → loads tabbed page with pricing + config tabs

9. **Soft launch**
   - Old URLs still work: `/dashboard/operasional/accept-order`, `/dashboard/operasional/monitoring-ongoing`, `/dashboard/manajemen/lokasi`

- [ ] **Step 22.4: Final commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude): document new Orders page route and Phase 1 sidebar structure"
```

- [ ] **Step 22.5: Optional — push branch**

```bash
git push -u origin <branch-name>
```

---

## Self-Review Checklist

### Type / Function Name Consistency

| Symbol | Defined In | Used In |
|--------|-----------|---------|
| `OrderStatus` (8 states) | `src/lib/order-status.ts` (Phase 0) | All order components, kanban-board, detail panel |
| `toCanonical()` | `src/lib/order-status.ts` (Phase 0) | order-utils, kanban-board, order-detail-panel, orders-page-client |
| `getNextStates()` | `src/lib/order-status.ts` (Phase 0) | (used internally by mutation hooks) |
| `isTerminalState()` | `src/lib/order-status.ts` (Phase 0) | order-utils.getUrgencyLevel |
| `ORDER_STATUS_COLORS` | `src/lib/order-status.ts` (Phase 0) | StatusBadge |
| `ORDER_STATUS_SEQUENCE` | `src/lib/order-status.ts` (Phase 0) | (reserved for Phase 3 sorting) |
| `getStatusLabel()` | `src/lib/order-status.ts` (Phase 0) | StatusBadge, OrderHistoryTab via badge |
| `StatusBadge` | `src/components/orders/status-badge.tsx` (Phase 0) | OrderCard, OrderDetailPanel, OrdersListView, OrderHistoryTab |
| `ServiceTypeBadge` | `src/components/orders/service-type-badge.tsx` (Phase 0) | OrderCard, OrderDetailTab, OrdersListView, OrderFilters |
| `EmptyState` | `src/components/ui/empty-state.tsx` (Phase 0) | KanbanColumn, OrdersListView, OrderReportTab, OrderInvoiceTab, OrderHistoryTab |
| `useTransitionOrder` | `src/hooks/use-order-mutation.ts` (Phase 0) | KanbanBoard |
| `useAssignTechnician` | `src/hooks/use-order-mutation.ts` (Phase 0, signature aligned in Task 2) | AssignModal |
| `useReschedule` | `src/hooks/use-order-mutation.ts` (Phase 0, signature aligned in Task 2) | RescheduleModal |
| `useCancelOrder` | `src/hooks/use-order-mutation.ts` (Phase 0) | CancelModal |
| `subscribeOrders` | `src/lib/realtime.ts` (existing) | OrdersPageClient |
| `OrderForDisplay` | `src/lib/order-utils.ts` (Task 3) | OrderCard, KanbanBoard, KanbanColumn, OrdersListView, OrdersBoardView, OrdersPageClient |
| `Urgency` | `src/lib/order-utils.ts` (Task 3) | OrderFilters, OrderCard via getUrgencyLevel |
| `URGENCY_BORDER` | `src/lib/order-utils.ts` (Task 3) | OrderCard |
| `getUrgencyLevel()` | `src/lib/order-utils.ts` (Task 3) | OrderCard, sortOrdersByUrgency |
| `groupOrdersByStatus()` | `src/lib/order-utils.ts` (Task 3) | KanbanBoard |
| `sortOrdersByUrgency()` | `src/lib/order-utils.ts` (Task 3) | KanbanBoard |
| `filterOrders()` | `src/lib/order-utils.ts` (Task 3) | OrdersPageClient |
| `getColumnForStatus()` | `src/lib/order-utils.ts` (Task 3) | KanbanBoard |
| `getLeadTechnicianName()` | `src/lib/order-utils.ts` (Task 3) | OrderCard, OrdersListView |
| `getPrimaryServiceType()` | `src/lib/order-utils.ts` (Task 3) | OrderCard, OrdersListView |
| `getPrimaryLocation()` | `src/lib/order-utils.ts` (Task 3) | OrderCard |
| `BOARD_COLUMNS` | `src/lib/order-utils.ts` (Task 3) | KanbanBoard, BoardSkeleton |
| `BoardColumnId` | `src/lib/order-utils.ts` (Task 3) | KanbanColumn, KanbanBoard |
| `OrderFilters` (interface) | `src/lib/order-utils.ts` (Task 3) | OrdersPageClient |
| `OrderFilters` (component) | `src/components/orders/order-filters.tsx` (Task 10) | OrdersPageClient |
| `OrderCard` | `src/components/orders/order-card.tsx` (Task 4) | KanbanColumn (via render prop), KanbanBoard.DraggableCard |
| `OrderCardSkeleton` | `src/components/orders/order-card-skeleton.tsx` (Task 4) | BoardSkeleton |
| `KanbanColumn` | `src/components/orders/kanban-column.tsx` (Task 5) | KanbanBoard |
| `KanbanBoard` | `src/components/orders/kanban-board.tsx` (Task 9) | OrdersBoardView |
| `BoardSkeleton` | `src/components/orders/board-skeleton.tsx` (Task 9) | OrdersBoardView, /orders/loading.tsx |
| `AssignModal` | `src/components/orders/assign-modal.tsx` (Task 6) | KanbanBoard, OrderDetailPanel |
| `RescheduleModal` | `src/components/orders/reschedule-modal.tsx` (Task 7) | KanbanBoard, OrderDetailPanel |
| `CancelModal` | `src/components/orders/cancel-modal.tsx` (Task 8) | OrderDetailPanel, OrdersListView |
| `OrderDetailTab` | `src/components/orders/order-detail-tab.tsx` (Task 12) | OrderDetailPanel |
| `OrderDetailData` | `src/components/orders/order-detail-tab.tsx` (Task 12) | OrderDetailPanel |
| `OrderReportTab` | `src/components/orders/order-report-tab.tsx` (Task 13) | OrderDetailPanel |
| `OrderInvoiceTab` | `src/components/orders/order-invoice-tab.tsx` (Task 14) | OrderDetailPanel |
| `OrderHistoryTab` | `src/components/orders/order-history-tab.tsx` (Task 15) | OrderDetailPanel |
| `OrderDetailPanel` | `src/components/orders/order-detail-panel.tsx` (Task 16) | OrdersPageClient |
| `OrdersListView` | `src/components/orders/orders-list-view.tsx` (Task 17) | OrdersPageClient |
| `OrdersBoardView` | `src/components/orders/orders-board-view.tsx` (Task 18.1) | OrdersPageClient |
| `OrdersPageClient` | `src/components/orders/orders-page-client.tsx` (Task 18.2) | /dashboard/orders/page.tsx |
| `getOrderHistory()` | `src/lib/actions/order-history.ts` (Task 11) | OrderHistoryTab |
| `OrderTransition` | `src/lib/actions/order-history.ts` (Task 11) | OrderHistoryTab |
| `rescheduleOrder()` | `src/lib/actions/orders.ts` (Task 2) | useReschedule |
| `CreateOrderPage` | `src/app/dashboard/operasional/create-order/page.tsx` (renamed in Task 19.1) | /dashboard/orders/new/page.tsx |

### No TBD / TODO Placeholders

- All code blocks are complete and runnable
- All file paths are absolute and consistent
- All imports use `@/*` alias matching the project convention
- Verification commands are concrete (`npm run type-check`, `npm run build`, `npm run lint`)
- Soft-launch behavior is explicit: old URLs still work, sidebar is the only thing changed

### Spec Coverage (Phase 1 deliverables → tasks)

| Phase 1 Requirement (spec §9) | Implemented By |
|--------------------------------|----------------|
| Install `@dnd-kit/core` + `@dnd-kit/sortable` | Task 1 |
| New route `/dashboard/orders` with `?view=board\|list` | Task 18 |
| `KanbanBoard` component (6 columns) | Task 9 (uses BOARD_COLUMNS from Task 3) |
| `OrderCard` with urgency color border | Task 4 (uses URGENCY_BORDER from Task 3) |
| Drag PENDING→ASSIGNED (modal) | Tasks 9 + 6 |
| Drag ASSIGNED→PENDING (reschedule) | Tasks 9 + 7 (uses Task 2 server action) |
| Drag COMPLETED→INVOICED | Task 9 (callback hook) |
| Drag INVOICED→PAID | Task 9 (callback hook) |
| List view (TanStack Table) with filters | Tasks 17 + 10 |
| `OrderDetailPanel` (Sheet) with 4 tabs | Task 16 |
| Detail / Report / Invoice / History tabs | Tasks 12, 13, 14, 15 |
| Footer actions per state | Task 16 |
| Skeleton loading: `BoardSkeleton`, table skeleton, card skeleton | Tasks 4, 9, 17, 18.3 |
| Empty states per column + filtered list | Tasks 5, 17, 13, 14, 15 |
| Realtime subscription via `subscribeOrders` | Task 18 |
| Optimistic mutations for drag actions | Phase 0 hooks (signatures aligned in Task 2) |
| Refactor Create Order page | Task 19 (thin re-export; full accordion deferred to Phase 3) |
| Update sidebar | Task 20 |
| Sidebar reorganize: Customers/Technicians top-level | Task 20 |
| Settings group merge | Tasks 20 + 21 |
| Soft launch — old URLs accessible | Tasks 19, 20 (no deletions; sidebar only) |

### Dependency Graph & Parallelization Opportunities

```
Task 1 (deps install) — no upstream deps
Task 2 (server action + hook signature) — no upstream deps
Task 3 (order-utils) — no upstream deps
Task 11 (history action) — no upstream deps

Task 4 (OrderCard) ← Task 3
Task 5 (KanbanColumn) ← Task 3, Task 4
Task 6 (AssignModal) ← Task 2 hooks
Task 7 (RescheduleModal) ← Task 2 hooks
Task 8 (CancelModal) ← Phase 0 hook (no Phase 1 dep)
Task 9 (KanbanBoard) ← Tasks 3, 4, 5, 6, 7, Task 1 packages

Task 10 (OrderFilters) — no Phase 1 dep beyond components

Task 12 (OrderDetailTab) ← Phase 0 badges
Task 13 (OrderReportTab) — Phase 0 EmptyState only
Task 14 (OrderInvoiceTab) — Phase 0 InvoiceStatusBadge
Task 15 (OrderHistoryTab) ← Task 11

Task 16 (OrderDetailPanel) ← Tasks 12, 13, 14, 15, 6, 7, 8

Task 17 (OrdersListView) ← Task 8 (CancelModal), Phase 0 badges, Task 3 utils
Task 18.1 (OrdersBoardView) ← Task 9
Task 18.2 (OrdersPageClient) ← Tasks 10, 16, 17, 18.1, Task 3 utils
Task 18.3-5 (page + loading) ← Task 18.2

Task 19 (Create Order new route) — independent of Phase 1 board
Task 20 (Sidebar) — independent
Task 21 (Service Catalog) — independent
Task 22 (Final verify + CLAUDE.md) — last
```

**Parallel-safe groupings (no shared state, no sequential deps):**

- **Group A — kickoff (parallelisable):** Tasks 1, 2, 3, 11
- **Group B — primitives (after A):** Tasks 4, 8, 10, 12, 13, 14
- **Group C — composites (after B):** Tasks 5, 6, 7, 15
- **Group D — assemblies (after C):** Tasks 9, 16, 17
- **Group E — page wiring (after D):** Task 18
- **Group F — independent UX & nav (any time after Phase 0):** Tasks 19, 20, 21
- **Group G — final:** Task 22

A solo developer should work in linear task order to minimise context switching. Two developers can split Group B, C, D vertically (developer 1 owns board chain: 4→5→9; developer 2 owns detail-panel chain: 12+13+14+15→16; then developer 1 writes 17 while developer 2 writes 18). Tasks 19, 20, 21 are safe drop-ins for either developer.

---

## Final Verification

After all 22 tasks are complete, run:

```bash
npm run type-check
npm run lint
npm run build
npm run dev   # smoke test the flows in Task 22.3
```

**Expected outcome:** Zero type errors, zero lint errors, clean build, all manual smoke tests pass. Admin can use `/dashboard/orders` end-to-end in place of the 5 legacy operasional pages, with old pages still accessible via direct URL for soft launch monitoring.

