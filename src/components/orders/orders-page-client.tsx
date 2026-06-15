'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/use-toast'
import { OrderDetailPanel } from '@/components/orders/order-detail-panel'
import { AssignModal } from '@/components/orders/assign-modal'
import { BulkAssignBar } from '@/components/orders/bulk-assign-bar'
import { OrdersContent } from '@/components/orders/orders-content'
import { OrdersToolbar } from '@/components/orders/orders-toolbar'
import {
  filterOrders,
  groupAndSortOrdersByStatus,
  BOARD_COLUMNS,
  type OrderFilters as OrderFiltersSpec,
  type OrderForDisplay,
} from '@/lib/order-utils'
import { datedCsvFilename, downloadCsv } from '@/lib/csv-export'
import { ORDER_CSV_COLUMNS, isUrgency } from './orders-export'
import {
  useBoardKeyboardNavigation,
  useOrdersRealtimeToast,
  useResponsiveOrdersView,
  useUserRole,
} from './use-orders-page-effects'

export function OrdersPageClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const view = searchParams.get('view') === 'list' ? 'list' : 'board'
  useResponsiveOrdersView(searchParams, router)

  const [detailOrderId, setDetailOrderId] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set())
  const [assignModalOpen, setAssignModalOpen] = useState(false)
  const [focusedOrderId, setFocusedOrderId] = useState<string | null>(null)

  const userRole = useUserRole()

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

  useEffect(() => {
    setFocusedOrderId(null)
  }, [view, filters.search, filters.status])

  useOrdersRealtimeToast(data, queryClient, toast)

  useBoardKeyboardNavigation({
    view,
    focusedOrderId,
    selectionMode,
    detailOpen,
    groupedOrders,
    columnIds,
    onFocusChange: setFocusedOrderId,
    onOpenDetail: handleOpenDetail,
    onClearSelection: () => {
      if (detailOpen) {
        setDetailOpen(false)
        setDetailOrderId(null)
      } else {
        handleClearSelection()
      }
    },
    onSelectToggle: handleSelectToggle,
  })

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
      <OrdersToolbar
        view={view}
        canBulkAssign={canBulkAssign}
        selectionMode={selectionMode}
        isLoading={isLoading}
        filteredCount={filtered.length}
        onViewChange={setView}
        onToggleSelectionMode={toggleSelectionMode}
        onExportCsv={handleExportCsv}
      />

      <OrdersContent
        view={view}
        filtered={filtered}
        groupedOrders={groupedOrders}
        isLoading={isLoading}
        hasFilters={hasFilters}
        selectionMode={selectionMode}
        selectedOrderIds={selectedOrderIds}
        onCardClick={handleOpenDetail}
        onSelectToggle={handleSelectToggle}
        onColumnSelectToggle={handleColumnSelectToggle}
      />

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
