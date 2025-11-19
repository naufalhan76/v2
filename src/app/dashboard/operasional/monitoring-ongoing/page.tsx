'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getOrders, getOrderById, addHelperTechnician, removeHelperTechnician } from '@/lib/actions/orders'
import { getTechnicians } from '@/lib/actions/technicians'
import { updateOrderStatus } from '@/lib/actions/orders'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { SortableTableHead } from '@/components/ui/sortable-table-head'
import { useSortableTable } from '@/hooks/use-sortable-table'
import { Activity, Package, FileText, Search, Eye, User, MapPin, Phone, Mail, Building, CalendarIcon, ChevronDown, Plus, X, Loader2 } from 'lucide-react'
import { format, subDays } from 'date-fns'
import { cn } from '@/lib/utils'
import { id } from 'date-fns/locale'

// Helper functions for multi-location orders
function getLocationsSummary(orderItems: any[]) {
  if (!orderItems || orderItems.length === 0) return { text: 'No locations', count: 0, locations: [] }
  
  const uniqueLocations = new Map()
  orderItems.forEach(item => {
    if (item.locations) {
      uniqueLocations.set(item.location_id, item.locations.building_name)
    }
  })
  
  const locationNames = Array.from(uniqueLocations.values()).filter(Boolean)
  
  if (locationNames.length === 0) return { text: 'No locations', count: 0, locations: [] }
  if (locationNames.length === 1) return { text: locationNames[0], count: 1, locations: locationNames }
  return { text: `${locationNames[0]} +${locationNames.length - 1}`, count: locationNames.length, locations: locationNames }
}

function getServicesGrouped(orderItems: any[]) {
  if (!orderItems || orderItems.length === 0) return { count: 0, types: {} }
  
  const serviceTypes: Record<string, number> = {}
  orderItems.forEach(item => {
    if (item.service_type) {
      serviceTypes[item.service_type] = (serviceTypes[item.service_type] || 0) + 1
    }
  })
  
  return { count: orderItems.length, types: serviceTypes }
}

const STATUS_GROUPS = {
  NON_ASSIGNED: ['NEW', 'ACCEPTED'],
  ASSIGNED: ['ASSIGNED', 'EN ROUTE', 'ARRIVED', 'IN_PROGRESS', 'RESCHEDULE'],
  INVOICED: ['DONE', 'INVOICED']
}

const ALL_ONGOING_STATUSES = [...STATUS_GROUPS.NON_ASSIGNED, ...STATUS_GROUPS.ASSIGNED, ...STATUS_GROUPS.INVOICED]

const STATUS_COLORS: Record<string, string> = {
  NEW: 'bg-gray-500',
  ACCEPTED: 'bg-blue-500',
  ASSIGNED: 'bg-cyan-500',
  'EN ROUTE': 'bg-indigo-500',
  ARRIVED: 'bg-purple-500',
  IN_PROGRESS: 'bg-yellow-500',
  DONE: 'bg-green-500',
  RESCHEDULE: 'bg-orange-500',
  INVOICED: 'bg-emerald-500',
  PAID: 'bg-lime-500',
  CLOSED: 'bg-slate-500',
  CANCELLED: 'bg-red-600',
}

const SERVICE_TYPES = [
  { value: 'REFILL_FREON', label: 'Refill Freon' },
  { value: 'CLEANING', label: 'Cleaning' },
  { value: 'REPAIR', label: 'Repair' },
  { value: 'INSTALLATION', label: 'Installation' },
  { value: 'INSPECTION', label: 'Inspection' },
]

const PAYMENT_STATUSES = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'PARTIAL', label: 'Partial' },
  { value: 'PAID', label: 'Paid' },
  { value: 'OVERDUE', label: 'Overdue' },
]

export default function MonitoringOngoingPage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [statusGroupFilter, setStatusGroupFilter] = useState<string>('ALL') // NEW, ACCEPTED, ASSIGNED, etc. or 'ALL'
  const [orderTypeFilter, setOrderTypeFilter] = useState<string>('ALL')
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('ALL')
  const [multiLocationFilter, setMultiLocationFilter] = useState<string>('ALL') // 'ALL', 'SINGLE', 'MULTI'
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null)
  const [showAddHelperDialog, setShowAddHelperDialog] = useState(false)
  const [showAddHelperConfirm, setShowAddHelperConfirm] = useState(false)
  const [selectedHelpers, setSelectedHelpers] = useState<string[]>([])
  const [showRemoveHelperDialog, setShowRemoveHelperDialog] = useState(false)
  const [helperToRemove, setHelperToRemove] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false)
  const [rescheduleDate, setRescheduleDate] = useState<Date | null>(null)
  
  // Date range state (default: 30 days ago to today)
  const [dateRange, setDateRange] = useState<{from: Date | undefined, to?: Date | undefined}>(() => {
    const endDate = new Date()
    const startDate = subDays(endDate, 30)
    return {
      from: startDate,
      to: endDate
    }
  })
  
  const [tempDateRange, setTempDateRange] = useState(dateRange)
  
  const dateFrom = dateRange.from || subDays(new Date(), 30)
  const dateTo = dateRange.to || new Date()

  // Handle date range selection
  const handleDateRangeSelect = (range: {from: Date | undefined, to?: Date | undefined} | undefined) => {
    if (range) {
      setTempDateRange(range)
      // Auto-update when both dates are selected
      if (range.from && range.to) {
        setDateRange(range)
      }
    }
  }

  const formatDateRange = () => {
    if (!dateRange.from || !dateRange.to) return "Pilih Tanggal"
    
    const fromFormatted = format(dateRange.from, 'dd/MM/yyyy', { locale: id })
    const toFormatted = format(dateRange.to, 'dd/MM/yyyy', { locale: id })
    
    return `${fromFormatted} - ${toFormatted}`
  }

  const { data: ordersData, isLoading } = useQuery({
    queryKey: ['orders', 'ongoing', format(dateFrom, 'yyyy-MM-dd'), format(dateTo, 'yyyy-MM-dd')],
    queryFn: () => getOrders({ 
      limit: 1000,
      dateFrom: format(dateFrom, 'yyyy-MM-dd'),
      dateTo: format(dateTo, 'yyyy-MM-dd')
    })
  })

  const { data: orderDetail } = useQuery({
    queryKey: ['order', detailOrderId],
    queryFn: () => getOrderById(detailOrderId!),
    enabled: !!detailOrderId
  })

  const { data: techniciansData } = useQuery({
    queryKey: ['technicians'],
    queryFn: () => getTechnicians({ limit: 100 })
  })
  
  const technicians = techniciansData?.data || []

  // Filter orders to only show ongoing (exclude PAID and CLOSED)
  const ongoingOrders = (ordersData?.data || []).filter((order: any) => 
    ALL_ONGOING_STATUSES.includes(order.status)
  )

  // Apply filters
  const filteredOrdersBase = ongoingOrders.filter((order: any) => {
    // Search filter
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase()
      const matchesOrderId = order.order_id?.toLowerCase().includes(searchLower)
      const matchesCustomer = order.customers?.customer_name?.toLowerCase().includes(searchLower)
      if (!matchesOrderId && !matchesCustomer) return false
    }

    // Status group filter (from cards)
    if (statusGroupFilter === 'NON_ASSIGNED' && !STATUS_GROUPS.NON_ASSIGNED.includes(order.status)) return false
    if (statusGroupFilter === 'ASSIGNED' && !STATUS_GROUPS.ASSIGNED.includes(order.status)) return false
    if (statusGroupFilter === 'INVOICED' && !STATUS_GROUPS.INVOICED.includes(order.status)) return false

    // Status filter (specific status)
    if (statusFilter !== 'ALL' && order.status !== statusFilter) return false

    // Order type filter
    if (orderTypeFilter !== 'ALL' && order.order_type !== orderTypeFilter) return false

    // Payment status filter (assuming orders have payment_status field)
    if (paymentStatusFilter !== 'ALL' && order.payment_status !== paymentStatusFilter) return false

    // Multi-location filter
    if (multiLocationFilter !== 'ALL') {
      const locationsSummary = getLocationsSummary(order.order_items || [])
      if (multiLocationFilter === 'SINGLE' && locationsSummary.count !== 1) return false
      if (multiLocationFilter === 'MULTI' && locationsSummary.count <= 1) return false
    }

    return true
  })

  // Apply sorting
  const { sortedData: filteredOrders, sortConfig, requestSort } = useSortableTable(filteredOrdersBase, {
    key: 'order_id',
    direction: 'desc'
  })

  // Calculate stats
  const nonAssignedCount = ongoingOrders.filter((o: any) => STATUS_GROUPS.NON_ASSIGNED.includes(o.status)).length
  const assignedCount = ongoingOrders.filter((o: any) => STATUS_GROUPS.ASSIGNED.includes(o.status)).length
  const invoicedCount = ongoingOrders.filter((o: any) => STATUS_GROUPS.INVOICED.includes(o.status)).length

  // Helper management functions
  const handleOpenAddHelper = () => {
    setSelectedHelpers([])
    setShowAddHelperDialog(true)
  }

  const handleConfirmAddHelpers = () => {
    if (selectedHelpers.length === 0) {
      toast({ title: 'No Selection', description: 'Please select at least one helper', variant: 'destructive' })
      return
    }
    setShowAddHelperDialog(false)
    setShowAddHelperConfirm(true)
  }

  const handleAddHelpers = async () => {
    if (!detailOrderId || selectedHelpers.length === 0) return
    
    try {
      setIsProcessing(true)
      let successCount = 0
      const errorMessages: string[] = []
      
      for (const helperId of selectedHelpers) {
        const result = await addHelperTechnician(detailOrderId, helperId)
        if (result.success) {
          successCount++
        } else {
          errorMessages.push(result.error || 'Failed to add helper')
        }
      }
      
      if (successCount > 0) {
        toast({ 
          title: 'Success', 
          description: `${successCount} helper technician${successCount > 1 ? 's' : ''} added` 
        })
        queryClient.invalidateQueries({ queryKey: ['order', detailOrderId] })
        queryClient.invalidateQueries({ queryKey: ['orders'] })
      }
      
      if (errorMessages.length > 0) {
        toast({ 
          title: 'Some helpers failed to add', 
          description: errorMessages[0], 
          variant: 'destructive' 
        })
      }
      
      setShowAddHelperConfirm(false)
      setSelectedHelpers([])
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setIsProcessing(false)
    }
  }

  const toggleHelperSelection = (helperId: string) => {
    setSelectedHelpers(prev => 
      prev.includes(helperId) 
        ? prev.filter(id => id !== helperId)
        : [...prev, helperId]
    )
  }
  
  const handleRemoveHelper = async () => {
    if (!detailOrderId || !helperToRemove) return
    
    try {
      setIsProcessing(true)
      const result = await removeHelperTechnician(detailOrderId, helperToRemove)
      
      if (result.success) {
        toast({ title: 'Success', description: 'Helper technician removed' })
        queryClient.invalidateQueries({ queryKey: ['order', detailOrderId] })
        queryClient.invalidateQueries({ queryKey: ['orders'] })
        setShowRemoveHelperDialog(false)
        setHelperToRemove(null)
      } else {
        toast({ title: 'Error', description: result.error, variant: 'destructive' })
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setIsProcessing(false)
    }
  }
  
  // Get available technicians (exclude lead and already assigned helpers)
  const getAvailableTechnicians = () => {
    if (!orderDetail?.data) return []
    
    const leadTechId = orderDetail.data.order_technicians?.find((t: any) => t.role === 'lead')?.technician_id
    const helperIds = orderDetail.data.order_technicians?.filter((t: any) => t.role === 'helper').map((t: any) => t.technician_id) || []
    
    return technicians.filter((tech: any) => 
      tech.technician_id !== leadTechId && 
      !helperIds.includes(tech.technician_id)
    )
  }

  const handleCancelOrder = async () => {
    if (!detailOrderId) return
    
    setIsProcessing(true)
    try {
      const result = await updateOrderStatus(detailOrderId, 'CANCELLED', 'Cancelled from monitoring ongoing')
      
      if (result.success) {
        toast({
          title: 'Success',
          description: 'Order cancelled successfully'
        })
        setCancelModalOpen(false)
        setDetailOrderId(null)
        queryClient.invalidateQueries({ queryKey: ['orders'] })
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to cancel order',
          variant: 'destructive'
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive'
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleRescheduleOrder = async () => {
    if (!detailOrderId || !rescheduleDate) return
    
    setIsProcessing(true)
    try {
      const supabase = await import('@/lib/supabase-browser').then(m => m.createClient())
      const formattedDate = format(rescheduleDate, 'yyyy-MM-dd')
      
      // Update order with new dates and status
      const { error } = await supabase
        .from('orders')
        .update({
          scheduled_visit_date: formattedDate,
          req_visit_date: formattedDate,
          status: 'RESCHEDULE',
          updated_at: new Date().toISOString()
        })
        .eq('order_id', detailOrderId)
      
      if (error) throw error
      
      toast({
        title: 'Success',
        description: `Order rescheduled to ${format(rescheduleDate, 'dd MMM yyyy')}`
      })
      setRescheduleModalOpen(false)
      setDetailOrderId(null)
      setRescheduleDate(null)
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive'
      })
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className='p-6 space-y-6'>
      {/* Header with Date Range */}
      <div className='flex flex-col md:flex-row md:items-center md:justify-between gap-4'>
        <div>
          <h1 className='text-3xl font-bold mb-2'>Monitoring Ongoing</h1>
          <p className='text-muted-foreground'>Monitor all active orders in progress</p>
        </div>
        
        {/* Date Range Picker */}
        <div className="flex flex-col items-end gap-3">
          <div className="text-sm font-medium">Filter Tanggal Order:</div>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-[240px] justify-start text-left font-normal text-sm px-3 py-2.5 h-auto shadow-sm",
                  (!dateRange.from || !dateRange.to) && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-3 h-4 w-4" />
                <span className="flex-1">{formatDateRange()}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={dateRange.from}
                selected={tempDateRange}
                onSelect={handleDateRangeSelect}
                numberOfMonths={2}
                locale={id}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Stats Cards */}
      <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
        <Card 
          className={cn(
            'cursor-pointer transition-all hover:shadow-lg',
            statusGroupFilter === 'NON_ASSIGNED' && 'ring-2 ring-blue-500 shadow-lg'
          )}
          onClick={() => {
            if (statusGroupFilter === 'NON_ASSIGNED') {
              setStatusGroupFilter('ALL')
            } else {
              setStatusGroupFilter('NON_ASSIGNED')
              setStatusFilter('ALL') // Reset specific status filter
            }
          }}
        >
          <CardHeader className='flex flex-row items-center justify-between pb-2'>
            <CardTitle className='text-sm font-medium'>Non-Assigned</CardTitle>
            <Activity className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{nonAssignedCount}</div>
            <p className='text-xs text-muted-foreground mt-1'>New & Accepted orders</p>
          </CardContent>
        </Card>

        <Card 
          className={cn(
            'cursor-pointer transition-all hover:shadow-lg',
            statusGroupFilter === 'ASSIGNED' && 'ring-2 ring-green-500 shadow-lg'
          )}
          onClick={() => {
            if (statusGroupFilter === 'ASSIGNED') {
              setStatusGroupFilter('ALL')
            } else {
              setStatusGroupFilter('ASSIGNED')
              setStatusFilter('ALL')
            }
          }}
        >
          <CardHeader className='flex flex-row items-center justify-between pb-2'>
            <CardTitle className='text-sm font-medium'>Assigned</CardTitle>
            <Package className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{assignedCount}</div>
            <p className='text-xs text-muted-foreground mt-1'>In progress orders</p>
          </CardContent>
        </Card>

        <Card 
          className={cn(
            'cursor-pointer transition-all hover:shadow-lg',
            statusGroupFilter === 'INVOICED' && 'ring-2 ring-purple-500 shadow-lg'
          )}
          onClick={() => {
            if (statusGroupFilter === 'INVOICED') {
              setStatusGroupFilter('ALL')
            } else {
              setStatusGroupFilter('INVOICED')
              setStatusFilter('ALL')
            }
          }}
        >
          <CardHeader className='flex flex-row items-center justify-between pb-2'>
            <CardTitle className='text-sm font-medium'>Invoiced</CardTitle>
            <FileText className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{invoicedCount}</div>
            <p className='text-xs text-muted-foreground mt-1'>Completed & invoiced</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters Section */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Search and filter orders</CardDescription>
        </CardHeader>
        <CardContent>
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4'>
            {/* Search */}
            <div className='relative'>
              <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
              <Input
                placeholder='Search Order ID or Customer...'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className='pl-9'
              />
            </div>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder='All Status' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='ALL'>All Status</SelectItem>
                {ALL_ONGOING_STATUSES.map(status => (
                  <SelectItem key={status} value={status}>{status}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Order Type Filter */}
            <Select value={orderTypeFilter} onValueChange={setOrderTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder='All Order Types' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='ALL'>All Order Types</SelectItem>
                {SERVICE_TYPES.map(type => (
                  <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Multi-Location Filter */}
            <Select value={multiLocationFilter} onValueChange={setMultiLocationFilter}>
              <SelectTrigger>
                <SelectValue placeholder='All Locations' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='ALL'>All Locations</SelectItem>
                <SelectItem value='SINGLE'>Single Location</SelectItem>
                <SelectItem value='MULTI'>Multi-Location</SelectItem>
              </SelectContent>
            </Select>

            {/* Payment Status Filter */}
            <Select value={paymentStatusFilter} onValueChange={setPaymentStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder='All Payment Status' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='ALL'>All Payment Status</SelectItem>
                {PAYMENT_STATUSES.map(status => (
                  <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Active Filters Summary */}
          {(searchQuery || statusFilter !== 'ALL' || statusGroupFilter !== 'ALL' || orderTypeFilter !== 'ALL' || paymentStatusFilter !== 'ALL' || multiLocationFilter !== 'ALL') && (
            <div className='mt-4 flex items-center gap-2 text-sm text-muted-foreground'>
              <span>Showing {filteredOrders.length} of {ongoingOrders.length} orders (from {format(dateFrom, 'dd MMM yyyy')} to {format(dateTo, 'dd MMM yyyy')})</span>
              <Button
                variant='ghost'
                size='sm'
                onClick={() => {
                  setSearchQuery('')
                  setStatusFilter('ALL')
                  setStatusGroupFilter('ALL')
                  setOrderTypeFilter('ALL')
                  setPaymentStatusFilter('ALL')
                  setMultiLocationFilter('ALL')
                }}
              >
                Clear all filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle>Orders ({filteredOrders.length})</CardTitle>
          <CardDescription>All ongoing orders</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className='text-center py-8 text-muted-foreground'>Loading orders...</div>
          ) : filteredOrders.length === 0 ? (
            <div className='text-center py-8 text-muted-foreground'>No orders found</div>
          ) : (
            <div className='rounded-md border'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableTableHead sortKey="order_id" currentSort={sortConfig} onSort={requestSort}>
                      Order ID
                    </SortableTableHead>
                    <SortableTableHead sortKey="customers.customer_name" currentSort={sortConfig} onSort={requestSort}>
                      Customer Name
                    </SortableTableHead>
                    <SortableTableHead sortKey="req_visit_date" currentSort={sortConfig} onSort={requestSort}>
                      Req Visit Date
                    </SortableTableHead>
                    <TableHead>Locations</TableHead>
                    <TableHead>Services</TableHead>
                    <SortableTableHead sortKey="order_type" currentSort={sortConfig} onSort={requestSort}>
                      Order Type
                    </SortableTableHead>
                    <SortableTableHead sortKey="status" currentSort={sortConfig} onSort={requestSort}>
                      Status
                    </SortableTableHead>
                    <SortableTableHead sortKey="assigned_technician_id" currentSort={sortConfig} onSort={requestSort}>
                      Assigned Technician
                    </SortableTableHead>
                    <TableHead className='text-right'>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order: any) => {
                    const locationsSummary = getLocationsSummary(order.order_items || [])
                    const servicesInfo = getServicesGrouped(order.order_items || [])
                    
                    return (
                      <TableRow 
                        key={order.order_id}
                        className={cn(
                          order.status === 'RESCHEDULE' && 'bg-amber-50 border-l-4 border-l-amber-500 hover:bg-amber-100'
                        )}
                      >
                        <TableCell className='font-mono text-sm'>{order.order_id}</TableCell>
                        <TableCell className='font-medium'>{order.customers?.customer_name || '-'}</TableCell>
                        <TableCell>
                          {order.req_visit_date ? format(new Date(order.req_visit_date), 'dd MMM yyyy') : '-'}
                        </TableCell>
                        <TableCell>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-auto py-1 px-2 font-normal">
                                <span className="flex items-center gap-1">
                                  {locationsSummary.text}
                                  {locationsSummary.count > 1 && <ChevronDown className="w-3 h-3 ml-1" />}
                                </span>
                              </Button>
                            </PopoverTrigger>
                            {locationsSummary.count > 1 && (
                              <PopoverContent className="w-80" align="start">
                                <div className="space-y-2">
                                  <h4 className="font-semibold text-sm">All Locations ({locationsSummary.count})</h4>
                                  <div className="space-y-1">
                                    {locationsSummary.locations.map((loc: string, idx: number) => (
                                      <div key={idx} className="text-sm p-2 bg-muted/50 rounded flex items-center gap-2">
                                        <MapPin className="w-3 h-3 text-muted-foreground" />
                                        {loc}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </PopoverContent>
                            )}
                          </Popover>
                        </TableCell>
                        <TableCell>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-auto py-1 px-2 font-normal">
                                <Badge variant="outline" className="cursor-pointer">
                                  {servicesInfo.count} service{servicesInfo.count > 1 ? 's' : ''}
                                  {Object.keys(servicesInfo.types).length > 0 && <ChevronDown className="w-3 h-3 ml-1" />}
                                </Badge>
                              </Button>
                            </PopoverTrigger>
                            {Object.keys(servicesInfo.types).length > 0 && (
                              <PopoverContent className="w-64" align="start">
                                <div className="space-y-2">
                                  <h4 className="font-semibold text-sm">Service Breakdown</h4>
                                  <div className="space-y-1">
                                    {Object.entries(servicesInfo.types).map(([type, count]) => (
                                      <div key={type} className="flex items-center justify-between text-sm p-2 bg-muted/50 rounded">
                                        <span className="font-medium">{SERVICE_TYPES.find(t => t.value === type)?.label || type}</span>
                                        <Badge variant="secondary">{count}x</Badge>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </PopoverContent>
                            )}
                          </Popover>
                        </TableCell>
                        <TableCell>
                          <Badge variant='outline'>
                            {SERVICE_TYPES.find(t => t.value === order.order_type)?.label || order.order_type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={cn('text-white', STATUS_COLORS[order.status] || 'bg-gray-500')}>
                            {order.status}
                          </Badge>
                        </TableCell>
                        <TableCell className='text-sm'>
                          {order.order_technicians && order.order_technicians.length > 0 ? (
                            <div className='space-y-1'>
                              <div className='font-medium'>
                                {order.order_technicians.find((t: any) => t.role === 'lead')?.technicians?.technician_name || order.assigned_technician_id || '-'}
                              </div>
                              {order.order_technicians.filter((t: any) => t.role === 'helper').length > 0 && (
                                <div className='text-xs text-muted-foreground'>
                                  + {order.order_technicians.filter((t: any) => t.role === 'helper').map((t: any) => t.technicians?.technician_name).join(', ')}
                                </div>
                              )}
                            </div>
                          ) : (
                            order.assigned_technician_id || '-'
                          )}
                        </TableCell>
                        <TableCell className='text-right'>
                          <Button
                            variant='ghost'
                            size='sm'
                            onClick={() => setDetailOrderId(order.order_id)}
                          >
                            <Eye className='w-4 h-4' />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Order Detail Modal */}
      <Dialog open={!!detailOrderId} onOpenChange={(open) => !open && setDetailOrderId(null)}>
        <DialogContent className='max-w-3xl max-h-[85vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>Order Detail</DialogTitle>
            <DialogDescription>Complete information about this order</DialogDescription>
          </DialogHeader>
          {orderDetail?.data && (() => {
            // Group order_items by location
            const groupedByLocation = (orderDetail.data.order_items || []).reduce((acc: any, item: any) => {
              const locId = item.location_id || 'unknown'
              if (!acc[locId]) {
                acc[locId] = {
                  location: item.locations,
                  items: []
                }
              }
              acc[locId].items.push(item)
              return acc
            }, {})
            
            const locationGroups = Object.values(groupedByLocation)
            const totalEstimated = (orderDetail.data.order_items || []).reduce((sum: number, item: any) => 
              sum + (item.estimated_price || 0) * (item.quantity || 1), 0
            )
            
            return (
              <div className='space-y-4'>
                {/* Order Info */}
                <div className='space-y-2'>
                  <h3 className='font-semibold text-lg'>Order Information</h3>
                  <div className='grid grid-cols-2 gap-3 text-sm'>
                    <div>
                      <span className='text-muted-foreground'>Order ID:</span>
                      <p className='font-mono font-semibold'>{orderDetail.data.order_id}</p>
                    </div>
                    <div>
                      <span className='text-muted-foreground'>Status:</span>
                      <div className='mt-1'>
                        <Badge className={cn('text-white', STATUS_COLORS[orderDetail.data.status])}>
                          {orderDetail.data.status}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <span className='text-muted-foreground'>Order Date:</span>
                      <p className='font-semibold'>
                        {orderDetail.data.order_date ? format(new Date(orderDetail.data.order_date), 'dd MMM yyyy') : '-'}
                      </p>
                    </div>
                    <div>
                      <span className='text-muted-foreground'>Order Type (Dominant):</span>
                      <div className='mt-1'>
                        <Badge variant='outline'>
                          {SERVICE_TYPES.find(t => t.value === orderDetail.data.order_type)?.label || orderDetail.data.order_type}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <span className='text-muted-foreground'>Requested Visit:</span>
                      <p className='font-semibold'>
                        {orderDetail.data.req_visit_date ? format(new Date(orderDetail.data.req_visit_date), 'dd MMM yyyy') : '-'}
                      </p>
                    </div>
                    <div>
                      <span className='text-muted-foreground'>Scheduled Visit:</span>
                      <p className='font-semibold'>
                        {orderDetail.data.scheduled_visit_date ? format(new Date(orderDetail.data.scheduled_visit_date), 'dd MMM yyyy') : '-'}
                      </p>
                    </div>
                  </div>
                  {orderDetail.data.notes && (
                    <div className='pt-2'>
                      <span className='text-muted-foreground text-sm'>Notes:</span>
                      <p className='text-sm mt-1 p-3 bg-muted rounded-md'>{orderDetail.data.notes}</p>
                    </div>
                  )}
                </div>

                {/* Customer Info */}
                <div className='space-y-2'>
                  <div className='flex items-center gap-2'>
                    <User className='w-5 h-5 text-muted-foreground' />
                    <h3 className='font-semibold text-lg'>Customer Information</h3>
                  </div>
                  <div className='bg-muted/50 rounded-lg p-4 space-y-2'>
                    <div>
                      <span className='text-sm font-semibold text-muted-foreground'>Name: </span>
                      <span className='font-medium'>{orderDetail.data.customers?.customer_name}</span>
                    </div>
                    {orderDetail.data.customers?.primary_contact_person && (
                      <div>
                        <span className='text-sm font-semibold text-muted-foreground'>Contact Person: </span>
                        <span>{orderDetail.data.customers.primary_contact_person}</span>
                      </div>
                    )}
                    <div className='flex gap-4 text-sm'>
                      {orderDetail.data.customers?.phone_number && (
                        <div className='flex items-center gap-1'>
                          <Phone className='w-3 h-3 text-muted-foreground' />
                          {orderDetail.data.customers.phone_number}
                        </div>
                      )}
                      {orderDetail.data.customers?.email && (
                        <div className='flex items-center gap-1'>
                          <Mail className='w-3 h-3 text-muted-foreground' />
                          {orderDetail.data.customers.email}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Technician Info */}
                {orderDetail.data.order_technicians && orderDetail.data.order_technicians.length > 0 && (
                  <div className='space-y-2'>
                    <div className='flex items-center justify-between'>
                      <div className='flex items-center gap-2'>
                        <User className='w-5 h-5 text-muted-foreground' />
                        <h3 className='font-semibold text-lg'>Assigned Technicians</h3>
                      </div>
                      <Button 
                        size='sm' 
                        variant='outline' 
                        onClick={handleOpenAddHelper}
                        disabled={isProcessing}
                      >
                        <Plus className='w-4 h-4 mr-1' />
                        Add Helper
                      </Button>
                    </div>
                    <div className='bg-muted/50 rounded-lg p-4 space-y-3'>
                      {/* Lead Technician */}
                      {orderDetail.data.order_technicians.filter((t: any) => t.role === 'lead').map((tech: any) => (
                        <div key={tech.id} className='flex items-center justify-between p-3 bg-primary/10 rounded-lg border border-primary/20'>
                          <div>
                            <div className='font-semibold'>{tech.technicians?.technician_name || 'Unknown'}</div>
                            <div className='text-xs text-muted-foreground'>Lead Technician</div>
                          </div>
                          <Badge className='bg-primary'>LEAD</Badge>
                        </div>
                      ))}
                      
                      {/* Helper Technicians */}
                      {orderDetail.data.order_technicians.filter((t: any) => t.role === 'helper').length > 0 && (
                        <div className='space-y-2'>
                          <div className='text-sm font-medium text-muted-foreground'>Helpers:</div>
                          {orderDetail.data.order_technicians.filter((t: any) => t.role === 'helper').map((tech: any) => (
                            <div key={tech.id} className='flex items-center justify-between p-2 bg-white rounded border'>
                              <div className='flex-1'>
                                <div className='font-medium text-sm'>{tech.technicians?.technician_name || 'Unknown'}</div>
                                {tech.technicians?.contact_number && (
                                  <div className='text-xs text-muted-foreground flex items-center gap-1'>
                                    <Phone className='w-3 h-3' />
                                    {tech.technicians.contact_number}
                                  </div>
                                )}
                              </div>
                              <div className='flex items-center gap-2'>
                                <Badge variant='outline' className='text-xs'>HELPER</Badge>
                              <Button
                                size='sm'
                                variant='ghost'
                                onClick={() => {
                                  setHelperToRemove(tech.technician_id)
                                  setShowRemoveHelperDialog(true)
                                }}
                                disabled={isProcessing}
                              >
                                <X className='w-4 h-4 text-red-500' />
                              </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Locations & Services */}
                <div className='space-y-2'>
                  <div className='flex items-center gap-2'>
                    <MapPin className='w-5 h-5 text-muted-foreground' />
                    <h3 className='font-semibold text-lg'>Locations & Services ({locationGroups.length} location{locationGroups.length > 1 ? 's' : ''})</h3>
                  </div>
                  
                  {locationGroups.length === 0 ? (
                    <div className='bg-muted/50 rounded-lg p-4 text-center text-muted-foreground'>
                      No location data available
                    </div>
                  ) : (
                    <div className='space-y-3'>
                      {locationGroups.map((group: any, idx: number) => (
                        <div key={idx} className='border rounded-lg p-4 space-y-3 bg-card'>
                          {/* Location Header */}
                          <div className='space-y-1'>
                            <div className='flex items-center gap-2 font-semibold text-base'>
                              <Building className='w-4 h-4 text-primary' />
                              {group.location?.building_name || 'Unknown Location'}
                            </div>
                            {group.location && (
                              <div className='text-sm text-muted-foreground pl-6'>
                                Floor {group.location.floor}, Room {group.location.room_number}
                                {group.location.description && ` • ${group.location.description}`}
                              </div>
                            )}
                          </div>
                          
                          {/* Services for this location */}
                          <div className='pl-6 space-y-2'>
                            <div className='text-sm font-semibold text-muted-foreground'>
                              Services ({group.items.length}):
                            </div>
                            <div className='space-y-2'>
                              {group.items.map((item: any) => (
                                <div key={item.order_item_id} className='flex items-center justify-between p-3 bg-muted/30 rounded-lg'>
                                  <div className='flex items-center gap-3'>
                                    <Badge variant='outline' className='font-semibold'>
                                      {SERVICE_TYPES.find(t => t.value === item.service_type)?.label || item.service_type}
                                    </Badge>
                                    <span className='text-sm'>
                                      {item.ac_units ? 
                                        `${item.ac_units.brand} ${item.ac_units.model_number}` : 
                                        `New AC Unit ${item.quantity > 1 ? `(${item.quantity}x)` : ''}`
                                      }
                                    </span>
                                  </div>
                                  <span className='font-semibold text-sm'>
                                    Rp {((item.estimated_price || 0) * (item.quantity || 1)).toLocaleString('id-ID')}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      {/* Total */}
                      <div className='flex justify-between items-center p-4 bg-primary/10 rounded-lg font-semibold border-2 border-primary/20'>
                        <span className='text-base'>Total Estimated:</span>
                        <span className='text-lg text-primary'>
                          Rp {totalEstimated.toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })()}

          {/* Action Buttons - Outside IIFE */}
          {orderDetail?.data && orderDetail.data.status !== 'DONE' && orderDetail.data.status !== 'INVOICED' && orderDetail.data.status !== 'PAID' && (
            <div className='flex gap-3 pt-4 border-t'>
              <Button
                variant='destructive'
                onClick={() => setCancelModalOpen(true)}
                disabled={isProcessing}
                className='flex-1'
              >
                Cancel Order
              </Button>
              <Button
                variant='outline'
                onClick={() => setRescheduleModalOpen(true)}
                disabled={isProcessing}
                className='flex-1'
              >
                Reschedule
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Helper Dialog - Multi Select */}
      <Dialog open={showAddHelperDialog} onOpenChange={(open) => {
        setShowAddHelperDialog(open)
        if (!open) setSelectedHelpers([])
      }}>
        <DialogContent className='max-w-md'>
          <DialogHeader>
            <DialogTitle>Select Helper Technicians</DialogTitle>
            <DialogDescription>
              Choose one or more technicians to add as helpers
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-4'>
            {getAvailableTechnicians().length === 0 ? (
              <div className='text-center py-8 text-muted-foreground'>
                No available technicians to add
              </div>
            ) : (
              <>
                <div className='space-y-2 max-h-[400px] overflow-y-auto'>
                  {getAvailableTechnicians().map((tech) => (
                    <div
                      key={tech.technician_id}
                      className={cn(
                        'flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors',
                        selectedHelpers.includes(tech.technician_id) 
                          ? 'bg-primary/5 border-primary' 
                          : 'hover:bg-accent'
                      )}
                      onClick={() => toggleHelperSelection(tech.technician_id)}
                    >
                      <Checkbox
                        checked={selectedHelpers.includes(tech.technician_id)}
                        onCheckedChange={() => toggleHelperSelection(tech.technician_id)}
                        className='mt-1'
                      />
                      <div className='flex-1'>
                        <div className='font-medium'>{tech.technician_name}</div>
                        <div className='text-sm text-muted-foreground'>{tech.contact_number}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className='flex items-center justify-between pt-3 border-t'>
                  <span className='text-sm text-muted-foreground'>
                    {selectedHelpers.length} selected
                  </span>
                  <div className='flex gap-2'>
                    <Button 
                      variant='outline' 
                      onClick={() => {
                        setShowAddHelperDialog(false)
                        setSelectedHelpers([])
                      }}
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleConfirmAddHelpers}
                      disabled={selectedHelpers.length === 0}
                    >
                      Continue
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Helper Confirmation Dialog */}
      <AlertDialog open={showAddHelperConfirm} onOpenChange={setShowAddHelperConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Add Helper Technicians</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className='space-y-3'>
                <p>
                  Are you sure you want to add <strong>{selectedHelpers.length}</strong> helper{selectedHelpers.length > 1 ? 's' : ''} to this order?
                </p>
                <div className='bg-muted rounded-lg p-3 max-h-[200px] overflow-y-auto'>
                  <div className='space-y-2'>
                    {selectedHelpers.map((helperId) => {
                      const helper = technicians.find((t: any) => t.technician_id === helperId)
                      return (
                        <div key={helperId} className='flex items-center justify-between text-sm'>
                          <span className='font-medium'>{helper?.technician_name}</span>
                          <span className='text-muted-foreground text-xs'>{helper?.contact_number}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedHelpers([])} disabled={isProcessing}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleAddHelpers} disabled={isProcessing}>
              {isProcessing ? 'Adding...' : 'Add Helpers'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove Helper Confirmation Dialog */}
      <AlertDialog open={showRemoveHelperDialog} onOpenChange={setShowRemoveHelperDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Helper Technician</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this helper technician from this order? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setHelperToRemove(null)} disabled={isProcessing}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveHelper} disabled={isProcessing} className='bg-red-600 hover:bg-red-700'>
              {isProcessing ? 'Removing...' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Order Confirmation Dialog */}
      <AlertDialog open={cancelModalOpen} onOpenChange={setCancelModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this order? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>
              Keep Order
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelOrder} disabled={isProcessing} className='bg-red-600 hover:bg-red-700'>
              {isProcessing ? 'Cancelling...' : 'Cancel Order'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reschedule Order Dialog */}
      <Dialog open={rescheduleModalOpen} onOpenChange={setRescheduleModalOpen}>
        <DialogContent className='max-w-md'>
          <DialogHeader>
            <DialogTitle>Reschedule Order</DialogTitle>
            <DialogDescription>
              Select a new date for this order
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-4'>
            <div className='space-y-2'>
              <label className='text-sm font-medium'>Select New Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant='outline'
                    className='w-full justify-start text-left font-normal'
                  >
                    <CalendarIcon className='mr-2 h-4 w-4' />
                    {rescheduleDate ? format(rescheduleDate, 'dd MMM yyyy') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className='w-auto p-0' align='start'>
                  <Calendar
                    mode='single'
                    selected={rescheduleDate || undefined}
                    onSelect={setRescheduleDate}
                    disabled={(date) => date < new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <div className='flex gap-2 pt-4 border-t'>
            <Button
              variant='outline'
              onClick={() => {
                setRescheduleModalOpen(false)
                setRescheduleDate(null)
              }}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRescheduleOrder}
              disabled={!rescheduleDate || isProcessing}
            >
              {isProcessing ? 'Rescheduling...' : 'Reschedule'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
