import { OrderFilters } from '@/components/orders/order-filters'
import { OrdersBoardView } from '@/components/orders/orders-board-view'
import { OrdersListView } from '@/components/orders/orders-list-view'
import type { OrderForDisplay } from '@/lib/order-utils'
import type { BOARD_COLUMNS } from '@/lib/order-utils'

type GroupedOrders = Record<(typeof BOARD_COLUMNS)[number]['id'], OrderForDisplay[]>

interface OrdersContentProps {
  view: 'board' | 'list'
  filtered: OrderForDisplay[]
  groupedOrders: GroupedOrders
  isLoading: boolean
  hasFilters: boolean
  selectionMode: boolean
  selectedOrderIds: Set<string>
  onCardClick: (orderId: string) => void
  onSelectToggle: (orderId: string) => void
  onColumnSelectToggle: (orderIds: string[], select: boolean) => void
}

export function OrdersContent({
  view,
  filtered,
  groupedOrders,
  isLoading,
  hasFilters,
  selectionMode,
  selectedOrderIds,
  onCardClick,
  onSelectToggle,
  onColumnSelectToggle,
}: OrdersContentProps) {
  return (
    <>
      <OrderFilters />

      {view === 'board' ? (
        <OrdersBoardView
          orders={filtered}
          groupedOrders={groupedOrders}
          isLoading={isLoading}
          onCardClick={onCardClick}
          isSelectionMode={selectionMode}
          selectedOrderIds={selectedOrderIds}
          onSelectToggle={onSelectToggle}
          onColumnSelectToggle={onColumnSelectToggle}
        />
      ) : (
        <OrdersListView orders={filtered} isLoading={isLoading} hasFilters={hasFilters} onRowClick={onCardClick} />
      )}
    </>
  )
}
