'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { LayoutGrid, List, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { OrderFilters } from '@/components/orders/order-filters'
import { OrdersBoardView } from '@/components/orders/orders-board-view'
import { OrdersListView } from '@/components/orders/orders-list-view'
import { OrderDetailPanel } from '@/components/orders/order-detail-panel'
import { getOrders } from '@/lib/actions/orders'
import { subscribeOrders } from '@/lib/realtime'
import {
  filterOrders,
  type OrderFilters as OrderFiltersSpec,
  type OrderForDisplay,
  type Urgency,
} from '@/lib/order-utils'
import { toCanonical } from '@/lib/order-status'

function isUrgency(v: string | null): v is Urgency {
  return v === 'overdue' || v === 'today' || v === 'future' || v === 'terminal'
}

export function OrdersPageClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const view = searchParams.get('view') === 'list' ? 'list' : 'board'

  const [detailOrderId, setDetailOrderId] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['orders', 'all'],
    queryFn: () => getOrders({ limit: 500 }),
  })

  const allOrders = (data?.data ?? []) as unknown as OrderForDisplay[]

  const filters: OrderFiltersSpec = useMemo(() => {
    const urgency = searchParams.get('urgency')
    return {
      search: searchParams.get('q') ?? undefined,
      technicianId: searchParams.get('technicianId') ?? undefined,
      serviceType: searchParams.get('serviceType') ?? undefined,
      urgency: isUrgency(urgency) ? urgency : undefined,
      dateFrom: searchParams.get('dateFrom') ?? undefined,
      dateTo: searchParams.get('dateTo') ?? undefined,
      status: searchParams.get('status') ?? undefined,
    }
  }, [searchParams])

  const filtered = useMemo(() => filterOrders(allOrders, filters), [allOrders, filters])

  const hasFilters = Object.values(filters).some((v) => v !== undefined && v !== '')

  useEffect(() => {
    const unsub = subscribeOrders(queryClient, (payload) => {
      const newRow = payload.new as { order_id?: string; status?: string } | null
      const oldRow = payload.old as { status?: string } | null
      if (
        payload.eventType === 'UPDATE' &&
        newRow?.status &&
        oldRow?.status &&
        toCanonical(newRow.status) !== toCanonical(oldRow.status)
      ) {
        toast({
          title: `Update: ${newRow.order_id ?? ''}`,
          description: `Status berubah ke ${toCanonical(newRow.status)}`,
        })
      }
    })
    return unsub
  }, [queryClient, toast])

  function setView(next: 'board' | 'list') {
    const params = new URLSearchParams(searchParams.toString())
    params.set('view', next)
    router.replace(`?${params.toString()}`, { scroll: false })
  }

  function handleOpenDetail(orderId: string) {
    setDetailOrderId(orderId)
    setDetailOpen(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Orders</h1>
          <p className="text-sm text-muted-foreground">
            Kelola semua order dalam satu dashboard
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={view} onValueChange={(v) => setView(v as 'board' | 'list')}>
            <TabsList>
              <TabsTrigger value="board" className="gap-1.5">
                <LayoutGrid className="h-3.5 w-3.5" />
                Board
              </TabsTrigger>
              <TabsTrigger value="list" className="gap-1.5">
                <List className="h-3.5 w-3.5" />
                List
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Button asChild>
            <Link href="/dashboard/orders/new">
              <Plus className="mr-2 h-4 w-4" />
              Buat Order
            </Link>
          </Button>
        </div>
      </div>

      <OrderFilters />

      {view === 'board' ? (
        <OrdersBoardView
          orders={filtered}
          isLoading={isLoading}
          onCardClick={handleOpenDetail}
        />
      ) : (
        <OrdersListView
          orders={filtered}
          isLoading={isLoading}
          hasFilters={hasFilters}
          onRowClick={handleOpenDetail}
        />
      )}

      <OrderDetailPanel
        orderId={detailOrderId}
        open={detailOpen}
        onOpenChange={(o) => {
          setDetailOpen(o)
          if (!o) setDetailOrderId(null)
        }}
      />
    </div>
  )
}
