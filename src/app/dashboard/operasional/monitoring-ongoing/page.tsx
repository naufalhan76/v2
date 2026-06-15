'use client'

import { useState, Suspense, useEffect, useMemo } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { subDays } from 'date-fns'
import { useSortableTable } from '@/hooks/use-sortable-table'
import { Activity, Package, FileText } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { selectMonitoringOrders } from './monitoring-ongoing-utils'
import { useMonitoringData } from './_hooks/use-monitoring-data'
import { MonitoringFilters } from './_components/monitoring-filters'
import { MonitoringTable } from './_components/monitoring-table'
import { OrderDetailDialog } from './_components/order-detail-dialog'
import { HelperManagement } from './_components/helper-management'
import { StatusActionDialogs } from './_components/status-action-dialog'

export default function MonitoringOngoingPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <MonitoringOngoingContent />
    </Suspense>
  )
}

function MonitoringOngoingContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  // Filters state
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [statusGroupFilter, setStatusGroupFilter] = useState('ALL')
  const [orderTypeFilter, setOrderTypeFilter] = useState('ALL')
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('ALL')
  const [multiLocationFilter, setMultiLocationFilter] = useState('ALL')
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null)

  // Date range (default: 30 days)
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to?: Date | undefined }>(() => {
    const end = new Date()
    return { from: subDays(end, 30), to: end }
  })
  const [tempDateRange, setTempDateRange] = useState<{ from: Date | undefined; to?: Date | undefined }>(dateRange)

  // Derived dates
  const dateFrom = dateRange.from || subDays(new Date(), 30)
  const dateTo = dateRange.to || new Date()

  // Data hook
  const data = useMonitoringData({
    dateFrom,
    dateTo,
    detailOrderId,
    onDetailClose: () => setDetailOrderId(null),
  })

  // Notification redirect
  useEffect(() => {
    const orderId = searchParams.get('orderId')
    const handledKey = `handled_redirect_${orderId}`
    const alreadyHandled = sessionStorage.getItem(handledKey) === 'true'

    if (orderId && !alreadyHandled && !data.hasHandledRedirect.current && !detailOrderId) {
      data.hasHandledRedirect.current = true
      sessionStorage.setItem(handledKey, 'true')
      router.replace('/dashboard/operasional/monitoring-ongoing', { scroll: false })
      setTimeout(() => {
        setDetailOrderId(orderId)
        setTimeout(() => sessionStorage.removeItem(handledKey), 1000)
      }, 100)
    }
  }, [searchParams, router, detailOrderId, data.hasHandledRedirect])

  // Filtering + sorting
  const { ongoingOrderViews, filteredOrderViews, counts } = useMemo(
    () => selectMonitoringOrders(data.ordersData?.data || [], {
      searchQuery, statusFilter, statusGroupFilter, orderTypeFilter,
      paymentStatusFilter, multiLocationFilter,
    }),
    [data.ordersData?.data, searchQuery, statusFilter, statusGroupFilter,
     orderTypeFilter, paymentStatusFilter, multiLocationFilter]
  )

  const { sortedData: filteredOrders, sortConfig, requestSort } = useSortableTable(filteredOrderViews, {
    key: 'order_id', direction: 'desc'
  })

  const handleDetailClose = (open: boolean) => {
    if (!open) {
      setDetailOrderId(null)
      data.hasHandledRedirect.current = false
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">Monitoring Ongoing</h1>
          <p className="text-muted-foreground">Monitor all active orders in progress</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card
          className={cn('cursor-pointer transition-all hover:shadow-lg',
            statusGroupFilter === 'NON_ASSIGNED' && 'ring-2 ring-info shadow-lg')}
          onClick={() => {
            setStatusGroupFilter(s => s === 'NON_ASSIGNED' ? 'ALL' : 'NON_ASSIGNED')
            setStatusFilter('ALL')
          }}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Non-Assigned</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{counts.nonAssigned}</div>
            <p className="text-xs text-muted-foreground mt-1">New & Accepted orders</p>
          </CardContent>
        </Card>

        <Card
          className={cn('cursor-pointer transition-all hover:shadow-lg',
            statusGroupFilter === 'ASSIGNED' && 'ring-2 ring-success shadow-lg')}
          onClick={() => {
            setStatusGroupFilter(s => s === 'ASSIGNED' ? 'ALL' : 'ASSIGNED')
            setStatusFilter('ALL')
          }}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Assigned</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{counts.assigned}</div>
            <p className="text-xs text-muted-foreground mt-1">In progress orders</p>
          </CardContent>
        </Card>

        <Card
          className={cn('cursor-pointer transition-all hover:shadow-lg',
            statusGroupFilter === 'INVOICED' && 'ring-2 ring-primary shadow-lg')}
          onClick={() => {
            setStatusGroupFilter(s => s === 'INVOICED' ? 'ALL' : 'INVOICED')
            setStatusFilter('ALL')
          }}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Invoiced</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{counts.invoiced}</div>
            <p className="text-xs text-muted-foreground mt-1">Completed & invoiced</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <MonitoringFilters
        searchQuery={searchQuery} setSearchQuery={setSearchQuery}
        statusFilter={statusFilter} setStatusFilter={setStatusFilter}
        statusGroupFilter={statusGroupFilter}
        orderTypeFilter={orderTypeFilter} setOrderTypeFilter={setOrderTypeFilter}
        paymentStatusFilter={paymentStatusFilter} setPaymentStatusFilter={setPaymentStatusFilter}
        multiLocationFilter={multiLocationFilter} setMultiLocationFilter={setMultiLocationFilter}
        dateRange={dateRange} setDateRange={setDateRange}
        tempDateRange={tempDateRange} setTempDateRange={setTempDateRange}
        filteredOrdersLength={filteredOrders.length}
        ongoingOrdersLength={ongoingOrderViews.length}
      />

      {/* Table */}
      <MonitoringTable
        filteredOrders={filteredOrders}
        isLoading={data.isLoading}
        sortConfig={sortConfig}
        requestSort={requestSort}
        onViewOrder={setDetailOrderId}
      />

      {/* Dialogs */}
      <OrderDetailDialog
        open={!!detailOrderId}
        onOpenChange={handleDetailClose}
        orderDetail={data.orderDetail}
        onOpenAddHelper={data.handleOpenAddHelper}
        onOpenRemoveHelper={(techId) => {
          data.setHelperToRemove(techId)
          data.setShowRemoveHelperDialog(true)
        }}
        onOpenCancel={() => data.setCancelModalOpen(true)}
        onOpenReschedule={() => data.setRescheduleModalOpen(true)}
        isProcessing={data.isProcessing}
      />

      <HelperManagement
        showAddHelperDialog={data.showAddHelperDialog}
        setShowAddHelperDialog={data.setShowAddHelperDialog}
        selectedHelpers={data.selectedHelpers}
        toggleHelperSelection={data.toggleHelperSelection}
        availableTechnicians={data.getAvailableTechnicians()}
        handleConfirmAddHelpers={data.handleConfirmAddHelpers}
        showAddHelperConfirm={data.showAddHelperConfirm}
        setShowAddHelperConfirm={data.setShowAddHelperConfirm}
        handleAddHelpers={data.handleAddHelpers}
        showRemoveHelperDialog={data.showRemoveHelperDialog}
        setShowRemoveHelperDialog={data.setShowRemoveHelperDialog}
        helperToRemove={data.helperToRemove}
        handleRemoveHelper={data.handleRemoveHelper}
        isProcessing={data.isProcessing}
        allTechnicians={data.technicians}
      />

      <StatusActionDialogs
        cancelModalOpen={data.cancelModalOpen}
        setCancelModalOpen={data.setCancelModalOpen}
        handleCancelOrder={data.handleCancelOrder}
        rescheduleModalOpen={data.rescheduleModalOpen}
        setRescheduleModalOpen={data.setRescheduleModalOpen}
        rescheduleDate={data.rescheduleDate}
        setRescheduleDate={data.setRescheduleDate}
        today={data.today}
        handleRescheduleOrder={data.handleRescheduleOrder}
        isProcessing={data.isProcessing}
      />
    </div>
  )
}
