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
import { Activity, Package, FileText, Search, Eye, User, MapPin, Phone, Mail, Building, CalendarIcon } from 'lucide-react'
import { format, subDays } from 'date-fns'
import { cn } from '@/lib/utils'

const STATUS_GROUPS = {
  NON_ASSIGNED: ['NEW', 'ACCEPTED'],
  ASSIGNED: ['ASSIGNED', 'OTW', 'ARRIVED', 'IN_PROGRESS', 'TO_WORKSHOP', 'IN_WORKSHOP', 'READY_TO_RETURN'],
  INVOICED: ['DONE', 'DELIVERED', 'INVOICED']
}

const ALL_ONGOING_STATUSES = [...STATUS_GROUPS.NON_ASSIGNED, ...STATUS_GROUPS.ASSIGNED, ...STATUS_GROUPS.INVOICED]

const STATUS_COLORS: Record<string, string> = {
  NEW: 'bg-slate-500',
  ACCEPTED: 'bg-blue-500',
  ASSIGNED: 'bg-cyan-500',
  OTW: 'bg-indigo-500',
  ARRIVED: 'bg-purple-500',
  IN_PROGRESS: 'bg-yellow-500',
  DONE: 'bg-green-500',
  TO_WORKSHOP: 'bg-orange-500',
  IN_WORKSHOP: 'bg-red-500',
  READY_TO_RETURN: 'bg-pink-500',
  DELIVERED: 'bg-teal-500',
  INVOICED: 'bg-emerald-600',
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
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null)
  
  // Date range state (default 30 days)
  const [dateFrom, setDateFrom] = useState<Date>(subDays(new Date(), 30))
  const [dateTo, setDateTo] = useState<Date>(new Date())

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
        
        {/* Date Range Filters */}
        <div className='flex gap-2'>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant='outline' className={cn('justify-start text-left font-normal w-[160px]', !dateFrom && 'text-muted-foreground')}>
                <CalendarIcon className='mr-2 h-4 w-4' />
                {dateFrom ? format(dateFrom, 'dd MMM yyyy') : 'From date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className='w-auto p-0'>
              <Calendar mode='single' selected={dateFrom} onSelect={(date) => date && setDateFrom(date)} initialFocus />
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant='outline' className={cn('justify-start text-left font-normal w-[160px]', !dateTo && 'text-muted-foreground')}>
                <CalendarIcon className='mr-2 h-4 w-4' />
                {dateTo ? format(dateTo, 'dd MMM yyyy') : 'To date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className='w-auto p-0'>
              <Calendar mode='single' selected={dateTo} onSelect={(date) => date && setDateTo(date)} initialFocus />
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
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
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
          {(searchQuery || statusFilter !== 'ALL' || statusGroupFilter !== 'ALL' || orderTypeFilter !== 'ALL' || paymentStatusFilter !== 'ALL') && (
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
                    <TableHead>Order Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Assigned Technician</TableHead>
                    <TableHead>Payment Status</TableHead>
                    <TableHead className='text-right'>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order: any) => (
                    <TableRow key={order.order_id}>
                      <TableCell className='font-mono text-sm'>{order.order_id}</TableCell>
                      <TableCell className='font-medium'>{order.customers?.customer_name || '-'}</TableCell>
                      <TableCell>
                        {order.req_visit_date ? format(new Date(order.req_visit_date), 'dd MMM yyyy') : '-'}
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
                      <TableCell>
                        <Badge variant={order.payment_status === 'PAID' ? 'default' : 'secondary'}>
                          {order.payment_status || 'PENDING'}
                        </Badge>
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
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Order Detail Modal */}
      <Dialog open={!!detailOrderId} onOpenChange={(open) => !open && setDetailOrderId(null)}>
        <DialogContent className='max-w-2xl max-h-[80vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>Order Detail</DialogTitle>
            <DialogDescription>Complete information about this order</DialogDescription>
          </DialogHeader>
          {orderDetail?.data && (
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
                    <span className='text-muted-foreground'>Order Type:</span>
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
                {orderDetail.data.description && (
                  <div className='pt-2'>
                    <span className='text-muted-foreground text-sm'>Description:</span>
                    <p className='text-sm mt-1 p-3 bg-muted rounded-md'>{orderDetail.data.description}</p>
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

              {/* Location Info */}
              <div className='space-y-2'>
                <div className='flex items-center gap-2'>
                  <MapPin className='w-5 h-5 text-muted-foreground' />
                  <h3 className='font-semibold text-lg'>Location Information</h3>
                </div>
                <div className='bg-muted/50 rounded-lg p-4 space-y-2'>
                  <div className='flex items-center gap-2'>
                    <Building className='w-4 h-4 text-muted-foreground' />
                    <span className='font-semibold'>{orderDetail.data.locations?.building_name}</span>
                  </div>
                  <div>
                    <span className='text-sm font-semibold text-muted-foreground'>Floor: </span>
                    {orderDetail.data.locations?.floor}
                  </div>
                  <div>
                    <span className='text-sm font-semibold text-muted-foreground'>Room: </span>
                    {orderDetail.data.locations?.room_number}
                  </div>
                  {orderDetail.data.locations?.description && (
                    <div>
                      <span className='text-sm font-semibold text-muted-foreground'>Description: </span>
                      {orderDetail.data.locations.description}
                    </div>
                  )}
                  <div className='mt-2'>
                    <span className='text-sm font-semibold text-muted-foreground'>Address: </span>
                    <p className='text-sm'>{orderDetail.data.customers?.billing_address}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
