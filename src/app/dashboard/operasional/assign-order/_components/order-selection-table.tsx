'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { ChevronLeft, ChevronRight, Eye } from 'lucide-react'
import { format } from 'date-fns'
import { cn, formatPhone } from '@/lib/utils'
import { StatusBadge } from '@/components/orders/status-badge'
import { ServiceTypeBadge } from '@/components/orders/service-type-badge'

const SERVICE_TYPES = [
  { value: 'REFILL_FREON', label: 'Refill Freon', dot: 'bg-status-assigned-bg0' },
  { value: 'CLEANING', label: 'Cleaning', dot: 'bg-status-completed-bg0' },
  { value: 'REPAIR', label: 'Repair', dot: 'bg-status-pending-bg0' },
  { value: 'INSTALLATION', label: 'Installation', dot: 'bg-primary' },
  { value: 'INSPECTION', label: 'Inspection', dot: 'bg-status-invoiced' },
]

interface OrderSelectionTableProps {
  orders: unknown[]
  filteredOrders: unknown[]
  ordersLoading: boolean
  filterStatus: string
  filterServiceType: string
  selectedOrders: string[]
  acceptedCount: number
  rescheduleCount: number
  orderCounts: Record<string, number>
  onFilterStatusChange: (status: string) => void
  onFilterServiceTypeChange: (type: string) => void
  onOrderSelect: (orderId: string, checked: boolean) => void
  onDetailOrder: (orderId: string) => void
  onNext: () => void
  onBack: () => void
}

export function OrderSelectionTable({
  orders,
  filteredOrders,
  ordersLoading,
  filterStatus,
  filterServiceType,
  selectedOrders,
  acceptedCount,
  rescheduleCount,
  orderCounts,
  onFilterStatusChange,
  onFilterServiceTypeChange,
  onOrderSelect,
  onDetailOrder,
  onNext,
  onBack,
}: OrderSelectionTableProps) {
  const [showPhone, setShowPhone] = useState<Record<string, boolean>>({})

  return (
    <div className='space-y-6'>
      <Card>
        <CardContent className='p-4'>
          <div className='text-sm text-muted-foreground'>
            Choose orders to assign from ACCEPTED and RESCHEDULE status
          </div>
        </CardContent>
      </Card>

      {/* Status Filter Cards */}
      <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
        <Card
          className={cn('cursor-pointer transition-all hover:shadow-md', filterStatus === 'ALL' && 'ring-2 ring-primary')}
          onClick={() => onFilterStatusChange('ALL')}
        >
          <CardContent className='p-4 text-center'>
            <div className='text-2xl font-bold'>{orders.length}</div>
            <div className='text-xs text-muted-foreground mt-1'>All Status</div>
          </CardContent>
        </Card>
        <Card
          className={cn('cursor-pointer transition-all hover:shadow-md', filterStatus === 'ACCEPTED' && 'ring-2 ring-primary')}
          onClick={() => onFilterStatusChange('ACCEPTED')}
        >
          <CardContent className='p-4 text-center'>
            <div className='w-3 h-3 rounded-full mx-auto mb-2 bg-status-assigned-bg0' />
            <div className='text-2xl font-bold'>{acceptedCount}</div>
            <div className='text-xs text-muted-foreground mt-1'>Accepted</div>
          </CardContent>
        </Card>
        <Card
          className={cn('cursor-pointer transition-all hover:shadow-md', filterStatus === 'RESCHEDULE' && 'ring-2 ring-primary')}
          onClick={() => onFilterStatusChange('RESCHEDULE')}
        >
          <CardContent className='p-4 text-center'>
            <div className='w-3 h-3 rounded-full mx-auto mb-2 bg-status-pending-bg0' />
            <div className='text-2xl font-bold'>{rescheduleCount}</div>
            <div className='text-xs text-muted-foreground mt-1'>Reschedule</div>
          </CardContent>
        </Card>
      </div>

      {/* Service Type Filter Cards */}
      <div className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4'>
        <Card
          className={cn('cursor-pointer transition-all hover:shadow-md', filterServiceType === 'ALL' && 'ring-2 ring-primary')}
          onClick={() => onFilterServiceTypeChange('ALL')}
        >
          <CardContent className='p-4 text-center'>
            <div className='text-2xl font-bold'>{orders.length}</div>
            <div className='text-xs text-muted-foreground mt-1'>All Orders</div>
          </CardContent>
        </Card>
        {SERVICE_TYPES.map((type) => (
          <Card
            key={type.value}
            className={cn('cursor-pointer transition-all hover:shadow-md', filterServiceType === type.value && 'ring-2 ring-primary')}
            onClick={() => onFilterServiceTypeChange(type.value)}
          >
            <CardContent className='p-4 text-center'>
              <div className={cn('w-3 h-3 rounded-full mx-auto mb-2', type.dot)} />
              <div className='text-2xl font-bold'>{orderCounts[type.value] || 0}</div>
              <div className='text-xs text-muted-foreground mt-1'>{type.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Order List */}
      <div className='grid gap-4'>
        {ordersLoading ? (
          <p>Loading orders...</p>
        ) : filteredOrders.length === 0 ? (
          <Card>
            <CardContent className='p-8 text-center text-muted-foreground'>
              No orders found for assignment
            </CardContent>
          </Card>
        ) : (
          filteredOrders.map((order: unknown) => {
            const o = order as Record<string, unknown> & {
              customers?: { customer_name?: string }
              order_id: string
              order_date?: string
              req_visit_date?: string
              order_type?: string
              status: string
            }
            const isSelected = selectedOrders.includes(o.order_id)
            return (
              <Card
                key={o.order_id}
                className={cn(
                  'transition-all',
                  isSelected && 'ring-2 ring-primary',
                  o.status === 'RESCHEDULE' && 'bg-status-pending-bg border-t-2 border-t-warning'
                )}
              >
                <CardContent className='p-4'>
                  <div className='flex items-start gap-4'>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(checked) => onOrderSelect(o.order_id, !!checked)}
                      className='mt-1'
                    />
                    <div className='flex-1 grid grid-cols-2 md:grid-cols-6 gap-4'>
                      <div>
                        <div className='text-xs text-muted-foreground'>Order ID</div>
                        <div className='font-semibold'>{o.order_id}</div>
                      </div>
                      <div>
                        <div className='text-xs text-muted-foreground'>Customer</div>
                        <div className='font-medium'>{o.customers?.customer_name}</div>
                      </div>
                      <div>
                        <div className='text-xs text-muted-foreground'>Status</div>
                        <StatusBadge status={o.status} />
                      </div>
                      <div>
                        <div className='text-xs text-muted-foreground'>Order Date</div>
                        <div>{o.order_date ? format(new Date(o.order_date), 'dd MMM yyyy') : '-'}</div>
                      </div>
                      <div>
                        <div className='text-xs text-muted-foreground'>Req. Visit Date</div>
                        <div>{o.req_visit_date ? format(new Date(o.req_visit_date), 'dd MMM yyyy') : '-'}</div>
                      </div>
                      <div>
                        <div className='text-xs text-muted-foreground'>Service Type</div>
                        <ServiceTypeBadge serviceType={o.order_type} />
                      </div>
                    </div>
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() => onDetailOrder(o.order_id)}
                    >
                      <Eye className='h-4 w-4' />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      {/* Navigation */}
      <div className='flex justify-between'>
        <Button variant='outline' onClick={onBack}>
          <ChevronLeft className='mr-2 h-4 w-4' /> Back
        </Button>
        <Button onClick={onNext} disabled={selectedOrders.length === 0}>
          Next ({selectedOrders.length} selected) <ChevronRight className='ml-2 h-4 w-4' />
        </Button>
      </div>
    </div>
  )
}
