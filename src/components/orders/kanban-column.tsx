'use client'

import { useDroppable } from '@dnd-kit/core'
import { Inbox } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
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
  isSelectionMode?: boolean
  selectedOrderIds?: Set<string>
  onColumnSelectToggle?: (orderIds: string[], select: boolean) => void
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
  isSelectionMode,
  selectedOrderIds,
  onColumnSelectToggle,
}: KanbanColumnProps) {
  const { isOver, setNodeRef } = useDroppable({
    id,
    disabled: !acceptsDrops,
  })

  const columnOrderIds = orders.map((o) => o.order_id)
  const allSelected =
    columnOrderIds.length > 0 && columnOrderIds.every((oid) => selectedOrderIds?.has(oid))

  function handleHeaderCheckboxClick(e: React.MouseEvent) {
    e.stopPropagation()
    onColumnSelectToggle?.(columnOrderIds, !allSelected)
  }

  return (
    <div className="flex flex-col w-[280px] sm:w-72 shrink-0 snap-start sm:snap-none bg-background rounded-lg border border-hairline">
      <div className="flex items-center justify-between px-3 py-2 border-b border-hairline bg-background">
        <div className="flex items-center gap-2">
          {isSelectionMode && (
            <Checkbox
              checked={allSelected}
              onClick={handleHeaderCheckboxClick}
              aria-label={`Pilih semua order di kolom ${title}`}
            />
          )}
          <h3 className="text-2xl font-[460] text-foreground">{title}</h3>
        </div>
        <Badge variant="secondary" className="text-sm bg-canvas-soft text-ink-mute">
          {orders.length}
        </Badge>
      </div>

      <ScrollArea className="flex-1 max-h-[60vh] sm:max-h-[calc(100vh-280px)]">
        <div
          ref={setNodeRef}
          className={cn(
            'p-2 space-y-2 min-h-[200px] transition-colors',
            isOver && acceptsDrops && 'bg-violet-soft/20 border-2 border-dashed border-violet-soft rounded-lg'
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
              <p className="text-sm text-center text-ink-mute py-2">
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
