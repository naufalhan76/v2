'use client'

import { useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { HistoryJobCard } from './history-job-card'
import { TodayJobsSkeleton } from './today-jobs-skeleton'
import { Button } from '@/components/ui/button'
import { AlertCircle, RefreshCw, Loader2, History, ListChecks } from 'lucide-react'
import { cn } from '@/lib/utils'

type FilterTab = 'all' | 'completed' | 'cancelled'

const FILTER_TABS: { key: FilterTab; label: string; statuses: string }[] = [
  { key: 'all', label: 'Semua', statuses: '' },
  { key: 'completed', label: 'Selesai', statuses: 'COMPLETED,INVOICED,PAID' },
  { key: 'cancelled', label: 'Dibatalkan', statuses: 'CANCELLED' },
]

async function fetchHistory({ pageParam = 1, status }: { pageParam?: number; status: string }) {
  const params = new URLSearchParams({
    page: String(pageParam),
    limit: '10',
  })
  if (status) {
    params.set('status', status)
  }

  const res = await fetch(`/api/technician/history?${params.toString()}`, {
    credentials: 'include',
  })
  if (!res.ok) throw new Error('Gagal memuat riwayat')
  const json = await res.json()
  if (!json.success) throw new Error(json.error || 'Gagal memuat data')
  return {
    data: json.data,
    pagination: json.pagination,
  }
}

export function HistoryList() {
  const [activeTab, setActiveTab] = useState<FilterTab>('all')
  const currentFilter = FILTER_TABS.find((t) => t.key === activeTab)!

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['technician', 'history', activeTab],
    queryFn: ({ pageParam }) =>
      fetchHistory({ pageParam, status: currentFilter.statuses }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (!lastPage.pagination) return undefined
      const { page, totalPages } = lastPage.pagination
      return page < totalPages ? page + 1 : undefined
    },
    staleTime: 60_000,
  })

  const allJobs = data?.pages.flatMap((page) => page.data) ?? []
  const totalCount = data?.pages?.[0]?.pagination?.total ?? null

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex gap-1 rounded-lg bg-muted p-1">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors cursor-pointer',
              'min-h-[40px]',
              activeTab === tab.key
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Total count chip (only when data loaded) */}
      {!isLoading && !isError && totalCount !== null && (
        <div
          className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs"
          role="status"
        >
          <ListChecks className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          <span className="text-muted-foreground">Total:</span>
          <span className="font-semibold tabular-nums text-foreground">{totalCount}</span>
          <span className="text-muted-foreground">
            pekerjaan{activeTab !== 'all' ? ` (${currentFilter.label.toLowerCase()})` : ''}
          </span>
        </div>
      )}

      {/* Content */}
      {isLoading && <TodayJobsSkeleton />}

      {isError && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle className="h-10 w-10 text-destructive mb-3" />
          <p className="text-sm text-muted-foreground mb-4">
            {error instanceof Error ? error.message : 'Terjadi kesalahan'}
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="h-11">
            <RefreshCw className="mr-2 h-4 w-4" />
            Coba Lagi
          </Button>
        </div>
      )}

      {!isLoading && !isError && allJobs.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
            <History className="h-7 w-7 text-muted-foreground" />
          </div>
          <h3 className="text-base font-medium mb-1">Belum Ada Riwayat</h3>
          <p className="text-sm text-muted-foreground max-w-[240px]">
            Riwayat pekerjaan Anda akan muncul di sini setelah menyelesaikan job.
          </p>
        </div>
      )}

      {!isLoading && !isError && allJobs.length > 0 && (
        <div className="space-y-3">
          {allJobs.map((job) => (
            <HistoryJobCard key={job.order_id} job={job} />
          ))}

          {/* Load more */}
          {hasNextPage && (
            <div className="pt-2 text-center">
              <Button
                variant="outline"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="h-11 w-full"
              >
                {isFetchingNextPage ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Memuat...
                  </>
                ) : (
                  'Muat Lebih Banyak'
                )}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
