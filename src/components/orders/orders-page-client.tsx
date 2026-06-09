'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, LayoutGrid, List, Plus, UserCheck, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { OrderFilters } from '@/components/orders/order-filters'
import { OrdersBoardView } from '@/components/orders/orders-board-view'
import { OrdersListView } from '@/components/orders/orders-list-view'
import { OrderDetailPanel } from '@/components/orders/order-detail-panel'
import { AssignModal } from '@/components/orders/assign-modal'
import { BulkAssignBar } from '@/components/orders/bulk-assign-bar'
import { subscribeOrders } from '@/lib/realtime'
import {
  filterOrders,
  groupAndSortOrdersByStatus,
  BOARD_COLUMNS,
  type OrderFilters as OrderFiltersSpec,
  type OrderForDisplay,
  type Urgency,
  getLeadTechnicianName,
  getPrimaryLocation,
  getPrimaryServiceType,
  getUrgencyLevel,
} from '@/lib/order-utils'
import { toCanonical } from '@/lib/order-status'
import { datedCsvFilename, downloadCsv, type CsvColumn } from '@/lib/csv-export'

const ORDER_CSV_COLUMNS: CsvColumn<OrderForDisplay>[] = [
  { header: 'Order ID', value: (order) => order.order_id },
  { header: 'Pelanggan', value: (order) => order.customers?.customer_name },
  { header: 'Status', value: (order) => order.status },
  { header: 'Layanan Utama', value: getPrimaryServiceType },
  { header: 'Teknisi Lead', value: getLeadTechnicianName },
  { header: 'Tanggal Kunjungan', value: (order) => order.scheduled_visit_date ?? order.req_visit_date },
  { header: 'Urgensi', value: getUrgencyLevel },
  { header: 'Alamat', value: getPrimaryLocation },
]

function isUrgency(v: string | null): v is Urgency {
  return v === 'overdue' || v === 'today' || v === 'future' || v === 'terminal'
}

export function OrdersPageClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const view = searchParams.get('view') === 'list' ? 'list' : 'board'

  useEffect(() => {
    const mql = window.matchMedia('(min-width: 1280px)')

    function handleChange(e: MediaQueryListEvent | MediaQueryList) {
      const hasExplicitView = searchParams.has('view')
      if (!hasExplicitView) {
        const nextView = e.matches ? 'board' : 'list'
        const params = new URLSearchParams(searchParams.toString())
        params.set('view', nextView)
        router.replace(`?${params.toString()}`, { scroll: false })
      }
    }

    handleChange(mql)
    mql.addEventListener('change', handleChange)
    return () => mql.removeEventListener('change', handleChange)
  }, [searchParams, router])

  const [detailOrderId, setDetailOrderId] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set())
  const [assignModalOpen, setAssignModalOpen] = useState(false)
  const [focusedOrderId, setFocusedOrderId] = useState<string | null>(null)

  const [userRole, setUserRole] = useState<string | null>(null)

  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const { createClient } = await import('@/lib/supabase-browser')
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          const { data: userData } = await supabase
            .from('user_management')
            .select('role')
            .eq('auth_user_id', session.user.id)
            .single()
          setUserRole(userData?.role || null)
        }
      } catch {
        // role stays null → canBulkAssign stays false
      }
    }
    fetchUserRole()
  }, [])

  const canBulkAssign = userRole === 'ADMIN' || userRole === 'SUPERADMIN'

  const { data, isLoading } = useQuery({
    queryKey: ['orders', 'all'],
    // Workaround: Next.js 15.5.15 RSC parser hangs on binding -fgmEOMwAVFyW1GZ_8n7i
    // (missing from client-reference-manifest). Revert to getOrders() when framework fixed.
    queryFn: async () => {
      const res = await fetch('/api/orders?limit=100', { credentials: 'same-origin' })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`HTTP ${res.status} ${res.statusText}: ${text.slice(0, 200)}`)
      }
      return res.json()
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
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

  const groupedOrders = useMemo(() => groupAndSortOrdersByStatus(filtered), [filtered])

  const columnIds = useMemo(() => BOARD_COLUMNS.map((c) => c.id), [])

  const findCardPosition = useCallback((orderId: string | null) => {
    if (!orderId) return null
    for (const colId of columnIds) {
      const idx = groupedOrders[colId].findIndex((o) => o.order_id === orderId)
      if (idx !== -1) return { colId, idx }
    }
    return null
  }, [groupedOrders, columnIds])

  const getFirstCard = useCallback(() => {
    for (const colId of columnIds) {
      if (groupedOrders[colId].length > 0) {
        return groupedOrders[colId][0].order_id
      }
    }
    return null
  }, [groupedOrders, columnIds])

  useEffect(() => {
    if (view !== 'board') return

    function isTypingTarget(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) return false
      const tag = target.tagName.toLowerCase()
      return (
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        target.isContentEditable
      )
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return

      if (e.key === 'Escape') {
        if (detailOpen) {
          e.preventDefault()
          setDetailOpen(false)
          setDetailOrderId(null)
          return
        }
        if (selectionMode) {
          e.preventDefault()
          handleClearSelection()
          return
        }
        return
      }

      if (e.key === 'Enter') {
        if (focusedOrderId) {
          e.preventDefault()
          handleOpenDetail(focusedOrderId)
        }
        return
      }

      if (e.key === ' ') {
        if (selectionMode && focusedOrderId) {
          e.preventDefault()
          handleSelectToggle(focusedOrderId)
        }
        return
      }

      const arrowKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']
      if (!arrowKeys.includes(e.key)) return

      e.preventDefault()

      const pos = findCardPosition(focusedOrderId)

      if (!pos) {
        const first = getFirstCard()
        if (first) setFocusedOrderId(first)
        return
      }

      const { colId, idx } = pos
      const colIndex = columnIds.indexOf(colId)

      if (e.key === 'ArrowUp') {
        if (idx > 0) {
          setFocusedOrderId(groupedOrders[colId][idx - 1].order_id)
        }
      } else if (e.key === 'ArrowDown') {
        if (idx < groupedOrders[colId].length - 1) {
          setFocusedOrderId(groupedOrders[colId][idx + 1].order_id)
        }
      } else if (e.key === 'ArrowLeft') {
        for (let i = colIndex - 1; i >= 0; i--) {
          const targetCol = columnIds[i]
          const targetOrders = groupedOrders[targetCol]
          if (targetOrders.length > 0) {
            const targetIdx = Math.min(idx, targetOrders.length - 1)
            setFocusedOrderId(targetOrders[targetIdx].order_id)
            break
          }
        }
      } else if (e.key === 'ArrowRight') {
        for (let i = colIndex + 1; i < columnIds.length; i++) {
          const targetCol = columnIds[i]
          const targetOrders = groupedOrders[targetCol]
          if (targetOrders.length > 0) {
            const targetIdx = Math.min(idx, targetOrders.length - 1)
            setFocusedOrderId(targetOrders[targetIdx].order_id)
            break
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [view, focusedOrderId, selectionMode, detailOpen, groupedOrders, columnIds, findCardPosition, getFirstCard])

  useEffect(() => {
    setFocusedOrderId(null)
  }, [view, filters.search, filters.status])

  useEffect(() => {
    if (!data) return
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
  }, [queryClient, toast, !!data])

  function setView(next: 'board' | 'list') {
    const params = new URLSearchParams(searchParams.toString())
    params.set('view', next)
    router.replace(`?${params.toString()}`, { scroll: false })
  }

  function handleOpenDetail(orderId: string) {
    setDetailOrderId(orderId)
    setDetailOpen(true)
  }

  function toggleSelectionMode() {
    setSelectionMode((prev) => {
      const next = !prev
      if (!next) {
        setSelectedOrderIds(new Set())
      }
      return next
    })
  }

  function handleSelectToggle(orderId: string) {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev)
      if (next.has(orderId)) {
        next.delete(orderId)
      } else {
        next.add(orderId)
      }
      return next
    })
  }

  function handleClearSelection() {
    setSelectedOrderIds(new Set())
    setSelectionMode(false)
  }

  function handleColumnSelectToggle(orderIds: string[], select: boolean) {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev)
      if (select) {
        orderIds.forEach((id) => next.add(id))
      } else {
        orderIds.forEach((id) => next.delete(id))
      }
      return next
    })
  }

  function handleBulkAssign() {
    if (selectedOrderIds.size === 0) {
      toast({
        variant: 'destructive',
        title: 'Tidak ada order yang dipilih',
      })
      return
    }
    setAssignModalOpen(true)
  }

  function handleExportCsv() {
    try {
      downloadCsv(datedCsvFilename('orders'), filtered, ORDER_CSV_COLUMNS)
      toast({ title: 'Export CSV berhasil', description: `${filtered.length} order diexport.` })
    } catch {
      toast({ variant: 'destructive', title: 'Export CSV gagal' })
    }
  }

  function handleAssignSuccess() {
    setAssignModalOpen(false)
    setSelectedOrderIds(new Set())
    setSelectionMode(false)
  }

  const selectedOrderIdsArray = useMemo(() => Array.from(selectedOrderIds), [selectedOrderIds])

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold sm:text-2xl">Orders</h1>
          <p className="text-base text-ink-mute">
            Kelola semua order dalam satu dashboard
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Tabs
            value={view}
            onValueChange={(v) => setView(v as 'board' | 'list')}
            className="flex-1 sm:flex-none"
          >
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger value="board" className="flex-1 gap-1.5 sm:flex-none">
                <LayoutGrid className="h-3.5 w-3.5" />
                Board
              </TabsTrigger>
              <TabsTrigger value="list" className="flex-1 gap-1.5 sm:flex-none">
                <List className="h-3.5 w-3.5" />
                List
              </TabsTrigger>
            </TabsList>
          </Tabs>
          {canBulkAssign && view === 'board' && (
            <Button
              variant={selectionMode ? 'default' : 'outline'}
              onClick={toggleSelectionMode}
              className="h-11 sm:h-9 gap-1.5"
            >
              {selectionMode ? (
                <>
                  <X className="h-4 w-4" />
                  Batal Mode Pilih
                </>
              ) : (
                <>
                  <UserCheck className="h-4 w-4" />
                  Pilih Order
                </>
              )}
            </Button>
          )}
          <Button
            variant="outline"
            onClick={handleExportCsv}
            disabled={isLoading || filtered.length === 0}
            className="h-11 sm:h-9 gap-1.5"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          <Button asChild className="h-11 sm:h-9">
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
          groupedOrders={groupedOrders}
          isLoading={isLoading}
          onCardClick={handleOpenDetail}
          isSelectionMode={selectionMode}
          selectedOrderIds={selectedOrderIds}
          onSelectToggle={handleSelectToggle}
          onColumnSelectToggle={handleColumnSelectToggle}
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

      <AssignModal
        open={assignModalOpen}
        onOpenChange={setAssignModalOpen}
        orderIds={selectedOrderIdsArray}
        onSuccess={handleAssignSuccess}
      />

      {selectionMode && (
        <BulkAssignBar
          selectedCount={selectedOrderIds.size}
          onAssign={handleBulkAssign}
          onClear={handleClearSelection}
        />
      )}
    </div>
  )
}
