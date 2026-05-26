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
