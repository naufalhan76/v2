'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getOrders, getOrderById } from '@/lib/actions/orders'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { Activity, Package, FileText, Search, Eye, User, MapPin, Phone, Mail, Building, CalendarIcon, ChevronDown } from 'lucide-react'
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
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [statusGroupFilter, setStatusGroupFilter] = useState<string>('ALL') // NEW, ACCEPTED, ASSIGNED, etc. or 'ALL'
  const [orderTypeFilter, setOrderTypeFilter] = useState<string>('ALL')
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('ALL')
  const [multiLocationFilter, setMultiLocationFilter] = useState<string>('ALL') // 'ALL', 'SINGLE', 'MULTI'
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null)
  
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

  // Filter orders to only show ongoing (exclude PAID and CLOSED)
  const ongoingOrders = (ordersData?.data || []).filter((order: any) => 
    ALL_ONGOING_STATUSES.includes(order.status)
  )

  // Apply filters
  const filteredOrders = ongoingOrders.filter((order: any) => {
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

  // Calculate stats
  const nonAssignedCount = ongoingOrders.filter((o: any) => STATUS_GROUPS.NON_ASSIGNED.includes(o.status)).length
  const assignedCount = ongoingOrders.filter((o: any) => STATUS_GROUPS.ASSIGNED.includes(o.status)).length
  const invoicedCount = ongoingOrders.filter((o: any) => STATUS_GROUPS.INVOICED.includes(o.status)).length

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
                    <TableHead>Order ID</TableHead>
                    <TableHead>Customer Name</TableHead>
                    <TableHead>Req Visit Date</TableHead>
                    <TableHead>Locations</TableHead>
                    <TableHead>Services</TableHead>
                    <TableHead>Order Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Assigned Technician</TableHead>
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
                          {order.assigned_technician_id || '-'}
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
        </DialogContent>
      </Dialog>
    </div>
  )
}
