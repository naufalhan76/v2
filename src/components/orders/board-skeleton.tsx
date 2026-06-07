import { OrderCardSkeleton } from '@/components/orders/order-card-skeleton'
import { Skeleton } from '@/components/ui/skeleton'
import { BOARD_COLUMNS } from '@/lib/order-utils'

export function BoardSkeleton() {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4 bg-canvas-soft rounded-lg p-4">
      {BOARD_COLUMNS.map((col) => (
        <div
          key={col.id}
          className="flex flex-col w-72 shrink-0 bg-background rounded-lg border border-hairline"
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-hairline bg-canvas-soft">
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
