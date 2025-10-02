'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
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
import { CheckCircle, Search, Eye, Check, X, User, MapPin, Phone, Mail, Building } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/use-toast'
import { createClient } from '@/lib/supabase-browser'

const SERVICE_TYPES = [
  { value: 'REFILL_FREON', label: 'Refill Freon' },
  { value: 'CLEANING', label: 'Cleaning' },
  { value: 'REPAIR', label: 'Repair' },
  { value: 'INSTALLATION', label: 'Installation' },
  { value: 'INSPECTION', label: 'Inspection' },
]

const STATUS_COLORS: Record<string, string> = {
  NEW: 'bg-slate-500',
  ACCEPTED: 'bg-blue-500',
  CANCELLED: 'bg-red-500',
}

export default function AcceptOrderPage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [searchQuery, setSearchQuery] = useState('')
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null)
  const [actionOrderId, setActionOrderId] = useState<string | null>(null)
  const [actionType, setActionType] = useState<'accept' | 'cancel' | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const { data: ordersData, isLoading } = useQuery({
    queryKey: ['orders', 'NEW'],
    queryFn: () => getOrders({ status: 'NEW', limit: 100 })
  })

  const { data: orderDetail } = useQuery({
    queryKey: ['order', detailOrderId],
    queryFn: () => getOrderById(detailOrderId!),
    enabled: !!detailOrderId
  })

  const orders = ordersData?.data || []

  // Client-side search filter
  const filteredOrders = orders.filter((order: any) => {
    if (!searchQuery) return true
    const searchLower = searchQuery.toLowerCase()
    const orderId = order.order_id?.toLowerCase() || ''
    const customerName = order.customers?.customer_name?.toLowerCase() || ''
    
    return orderId.includes(searchLower) || customerName.includes(searchLower)
  })

  const handleOrderAction = async (orderId: string, newStatus: 'ACCEPTED' | 'CANCELLED') => {
    setIsProcessing(true)
    try {
      const supabase = createClient()
      
      const { error } = await supabase
        .from('orders')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('order_id', orderId)
      
      if (error) throw error
      
      toast({
        title: 'Success',
        description: `Order ${newStatus === 'ACCEPTED' ? 'accepted' : 'cancelled'} successfully`
      })
      
      // Refresh orders list
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      
      // Close dialogs
      setActionOrderId(null)
      setActionType(null)
    } catch (error) {
      console.error('Error updating order:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update order',
        variant: 'destructive'
      })
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className='p-6 space-y-6'>
      {/* Header */}
      <div>
        <h1 className='text-3xl font-bold mb-2'>Accept Order</h1>
        <p className='text-muted-foreground'>Review and accept or reject new incoming orders</p>
      </div>

      {/* Stats Card */}
      <Card>
        <CardHeader className='flex flex-row items-center justify-between pb-2'>
          <div>
            <CardTitle className='text-sm font-medium'>Pending Orders</CardTitle>
            <CardDescription>Orders waiting for approval</CardDescription>
          </div>
          <CheckCircle className='h-4 w-4 text-muted-foreground' />
        </CardHeader>
        <CardContent>
          <div className='text-2xl font-bold'>{filteredOrders.length}</div>
        </CardContent>
      </Card>

      {/* Search Bar */}
      <Card>
        <CardContent className='pt-6'>
          <div className='relative'>
            <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
            <Input
              placeholder='Search by Order ID or Customer Name...'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className='pl-9'
            />
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle>New Orders ({filteredOrders.length})</CardTitle>
          <CardDescription>Orders with NEW status pending approval</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className='text-center py-8 text-muted-foreground'>Loading orders...</div>
          ) : filteredOrders.length === 0 ? (
            <div className='text-center py-8 text-muted-foreground'>
              {searchQuery ? 'No orders found matching your search' : 'No new orders at this time'}
            </div>
          ) : (
            <div className='rounded-md border'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order ID</TableHead>
                    <TableHead>Customer Name</TableHead>
                    <TableHead>Order Date</TableHead>
                    <TableHead>Req Visit Date</TableHead>
                    <TableHead>Order Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className='text-right'>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order: any) => (
                    <TableRow key={order.order_id}>
                      <TableCell className='font-mono text-sm'>{order.order_id}</TableCell>
                      <TableCell className='font-medium'>{order.customers?.customer_name || '-'}</TableCell>
                      <TableCell>
                        {order.order_date ? format(new Date(order.order_date), 'dd MMM yyyy') : '-'}
                      </TableCell>
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
                      <TableCell className='text-right'>
                        <div className='flex justify-end gap-2'>
                          <Button
                            variant='ghost'
                            size='sm'
                            onClick={() => setDetailOrderId(order.order_id)}
                          >
                            <Eye className='w-4 h-4' />
                          </Button>
                          <Button
                            variant='default'
                            size='sm'
                            className='bg-green-600 hover:bg-green-700'
                            onClick={() => {
                              setActionOrderId(order.order_id)
                              setActionType('accept')
                            }}
                          >
                            <Check className='w-4 h-4 mr-1' />
                            Accept
                          </Button>
                          <Button
                            variant='destructive'
                            size='sm'
                            onClick={() => {
                              setActionOrderId(order.order_id)
                              setActionType('cancel')
                            }}
                          >
                            <X className='w-4 h-4 mr-1' />
                            Cancel
                          </Button>
                        </div>
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

              {/* Action Buttons */}
              <div className='flex gap-2 pt-4 border-t'>
                <Button
                  className='flex-1 bg-green-600 hover:bg-green-700'
                  onClick={() => {
                    setDetailOrderId(null)
                    setActionOrderId(orderDetail.data.order_id)
                    setActionType('accept')
                  }}
                >
                  <Check className='w-4 h-4 mr-2' />
                  Accept Order
                </Button>
                <Button
                  variant='destructive'
                  className='flex-1'
                  onClick={() => {
                    setDetailOrderId(null)
                    setActionOrderId(orderDetail.data.order_id)
                    setActionType('cancel')
                  }}
                >
                  <X className='w-4 h-4 mr-2' />
                  Cancel Order
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Accept Confirmation Dialog */}
      <AlertDialog open={actionType === 'accept'} onOpenChange={(open) => !open && setActionType(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Accept Order?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to accept this order? The order status will be changed to ACCEPTED and will be ready for technician assignment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => actionOrderId && handleOrderAction(actionOrderId, 'ACCEPTED')}
              disabled={isProcessing}
              className='bg-green-600 hover:bg-green-700'
            >
              {isProcessing ? 'Processing...' : 'Accept Order'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={actionType === 'cancel'} onOpenChange={(open) => !open && setActionType(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Order?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this order? This action will mark the order as CANCELLED and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Go Back</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => actionOrderId && handleOrderAction(actionOrderId, 'CANCELLED')}
              disabled={isProcessing}
              className='bg-red-600 hover:bg-red-700'
            >
              {isProcessing ? 'Processing...' : 'Cancel Order'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
