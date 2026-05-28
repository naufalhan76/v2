import { Suspense } from 'react'
import { OrdersPageClient } from '@/components/orders/orders-page-client'
import { BoardSkeleton } from '@/components/orders/board-skeleton'
import { Skeleton } from '@/components/ui/skeleton'

export default function OrdersPage() {
  return (
    <Suspense fallback={
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
    }>
      <OrdersPageClient />
    </Suspense>
  )
}
