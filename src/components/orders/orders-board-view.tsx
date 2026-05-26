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
