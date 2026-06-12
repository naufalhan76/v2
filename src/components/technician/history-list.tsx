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
    <div className="space-y-6">
      <div className="bg-white p-1 rounded-[32px] shadow border border-gray-100 -mt-10 relative z-10 dark:bg-[#1a1833] flex gap-1">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'flex-1 py-3 text-center text-sm transition-colors',
              activeTab === tab.key
                ? 'font-semibold bg-[#211c59] text-white rounded-[28px]'
                : 'font-semibold text-gray-600 rounded-full dark:text-gray-400'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex justify-between items-center px-1">
        <h2 className="text-lg font-bold text-[#1e1b4b] dark:text-white">Daftar Pekerjaan</h2>
        {!isLoading && !isError && totalCount !== null && (
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Total: {totalCount} pekerjaan
          </div>
        )}
      </div>

      {/* Content */}
      {isLoading && <TodayJobsSkeleton />}

      {isError && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle className="h-10 w-10 text-destructive mb-3" />
          <p className="text-sm text-ink-mute mb-4">
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
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-canvas-soft mb-4">
            <History className="h-7 w-7 text-ink-faint" />
          </div>
          <h3 className="text-2xl font-[460] mb-1">Belum Ada Riwayat</h3>
          <p className="text-lg text-ink-mute max-w-[240px]">
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
