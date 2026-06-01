'use client'

import { KanbanBoard } from '@/components/orders/kanban-board'
import { BoardSkeleton } from '@/components/orders/board-skeleton'
import { type OrderForDisplay } from '@/lib/order-utils'

interface OrdersBoardViewProps {
  orders: OrderForDisplay[]
  isLoading: boolean
  onCardClick: (orderId: string) => void
  isSelectionMode?: boolean
  selectedOrderIds?: Set<string>
  onSelectToggle?: (orderId: string) => void
  onColumnSelectToggle?: (orderIds: string[], select: boolean) => void
}

export function OrdersBoardView({
  orders,
  isLoading,
  onCardClick,
  isSelectionMode,
  selectedOrderIds,
  onSelectToggle,
  onColumnSelectToggle,
}: OrdersBoardViewProps) {
  if (isLoading) return <BoardSkeleton />
  return (
    <KanbanBoard
      orders={orders}
      onCardClick={onCardClick}
      isSelectionMode={isSelectionMode}
      selectedOrderIds={selectedOrderIds}
      onSelectToggle={onSelectToggle}
      onColumnSelectToggle={onColumnSelectToggle}
    />
  )
}
