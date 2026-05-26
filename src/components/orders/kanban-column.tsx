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
