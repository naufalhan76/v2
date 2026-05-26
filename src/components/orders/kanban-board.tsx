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

    if (fromCol === 'ACTIVE' || toCol === 'ACTIVE') {
      toast({
        title: 'Tidak dapat dipindahkan',
        description: 'Kolom Aktif hanya dapat diubah oleh teknisi.',
      })
      return
    }

    const canonicalFrom = toCanonical(order.status)

    if (fromCol === 'PENDING' && toCol === 'ASSIGNED') {
      setAssignTarget({ orderId: order.order_id, defaultDate: order.scheduled_visit_date })
      return
    }

    if (fromCol === 'ASSIGNED' && toCol === 'PENDING') {
      setRescheduleTarget({ orderId: order.order_id, defaultDate: order.scheduled_visit_date })
      return
    }

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
