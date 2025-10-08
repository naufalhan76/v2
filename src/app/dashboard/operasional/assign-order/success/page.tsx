'use client'

import { Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { getOrderById } from '@/lib/actions/orders'
import { getTechnicianById } from '@/lib/actions/technicians'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, ArrowLeft, Calendar, User, MapPin, Phone, Mail, Building } from 'lucide-react'
import { format } from 'date-fns'
import { Separator } from '@/components/ui/separator'

function AssignmentSuccessContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const orderIds = searchParams.get('ids')?.split(',') || []
  const technicianId = searchParams.get('tech') || ''
  const scheduledDate = searchParams.get('date') || ''

  console.log('Technician ID:', technicianId) // Debug

  const { data: technicianData, isLoading: technicianLoading, error: technicianError } = useQuery({
    queryKey: ['technician', technicianId],
    queryFn: () => getTechnicianById(technicianId),
    enabled: !!technicianId
  })

  console.log('Technician Data:', technicianData) // Debug
  console.log('Technician Loading:', technicianLoading) // Debug
  console.log('Technician Error:', technicianError) // Debug

  // Fetch all orders
  const orderQueries = orderIds.map(orderId => 
    useQuery({
      queryKey: ['order', orderId],
      queryFn: () => getOrderById(orderId),
      enabled: !!orderId
    })
  )

  const orders = orderQueries.map(q => q.data?.data).filter(Boolean)
  const isLoading = orderQueries.some(q => q.isLoading)

  const SERVICE_TYPE_MAP: Record<string, { label: string; color: string }> = {
    'REFILL_FREON': { label: 'Refill Freon', color: 'bg-blue-500' },
    'CLEANING': { label: 'Cleaning', color: 'bg-green-500' },
    'REPAIR': { label: 'Repair', color: 'bg-orange-500' },
    'INSTALLATION': { label: 'Installation', color: 'bg-purple-500' },
    'INSPECTION': { label: 'Inspection', color: 'bg-cyan-500' },
  }

  return (
    <div className='p-6 max-w-5xl mx-auto'>
      {/* Success Header */}
      <div className='text-center mb-8'>
        <div className='inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4'>
          <CheckCircle2 className='w-10 h-10 text-green-600' />
        </div>
        <h1 className='text-3xl font-bold mb-2'>Assignment Successful!</h1>
        <p className='text-muted-foreground'>
          {orderIds.length} order{orderIds.length > 1 ? 's' : ''} have been successfully assigned
        </p>
      </div>

      {/* Technician Info Card */}
      <Card className='mb-6'>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <User className='w-5 h-5' />
            Assigned Technician
          </CardTitle>
        </CardHeader>
        <CardContent>
          {technicianData?.data ? (
            <div className='space-y-3'>
              <div>
                <span className='text-sm font-semibold text-muted-foreground'>Name: </span>
                <span className='text-lg font-bold'>{technicianData.data.technician_name}</span>
              </div>
              {technicianData.data.company && (
                <div>
                  <span className='text-sm font-semibold text-muted-foreground'>Company: </span>
                  <span>{technicianData.data.company}</span>
                </div>
              )}
              <div className='flex gap-4'>
                {technicianData.data.contact_number && (
                  <div className='flex items-center gap-2'>
                    <Phone className='w-4 h-4 text-muted-foreground' />
                    <span className='text-sm'>{technicianData.data.contact_number}</span>
                  </div>
                )}
                {technicianData.data.email && (
                  <div className='flex items-center gap-2'>
                    <Mail className='w-4 h-4 text-muted-foreground' />
                    <span className='text-sm'>{technicianData.data.email}</span>
                  </div>
                )}
              </div>
              <div className='flex items-center gap-2 pt-2'>
                <Calendar className='w-4 h-4 text-muted-foreground' />
                <span className='text-sm font-semibold text-muted-foreground'>Scheduled Visit Date: </span>
                <span className='text-sm font-bold'>{scheduledDate ? format(new Date(scheduledDate), 'EEEE, dd MMMM yyyy') : '-'}</span>
              </div>
            </div>
          ) : (
            <p className='text-sm text-muted-foreground'>Loading technician info...</p>
          )}
        </CardContent>
      </Card>

      {/* Orders List */}
      <Card>
        <CardHeader>
          <CardTitle>Assigned Orders ({orderIds.length})</CardTitle>
          <CardDescription>Details of all assigned orders</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className='text-sm text-muted-foreground'>Loading orders...</p>
          ) : (
            <div className='space-y-4'>
              {orders.map((order: any, index: number) => (
                <div key={order.order_id}>
                  {index > 0 && <Separator className='my-4' />}
                  <div className='space-y-3'>
                    {/* Order Header */}
                    <div className='flex items-start justify-between'>
                      <div>
                        <div className='flex items-center gap-2 mb-1'>
                          <span className='font-mono text-sm font-bold'>{order.order_id}</span>
                          <Badge className={SERVICE_TYPE_MAP[order.order_type]?.color || 'bg-gray-500'}>
                            {SERVICE_TYPE_MAP[order.order_type]?.label || order.order_type}
                          </Badge>
                        </div>
                        <p className='text-xs text-muted-foreground'>
                          Order Date: {order.order_date ? format(new Date(order.order_date), 'dd MMM yyyy') : '-'}
                        </p>
                      </div>
                      <Badge variant='outline' className='bg-green-50 text-green-700 border-green-200'>
                        ASSIGNED
                      </Badge>
                    </div>

                    {/* Customer Info */}
                    <div className='bg-muted/50 rounded-lg p-3'>
                      <div className='flex items-center gap-2 mb-2'>
                        <User className='w-4 h-4 text-muted-foreground' />
                        <span className='text-sm font-semibold'>Customer</span>
                      </div>
                      <div className='ml-6 space-y-1'>
                        <p className='font-medium'>{order.customers?.customer_name}</p>
                        {order.customers?.primary_contact_person && (
                          <p className='text-sm text-muted-foreground'>
                            Contact: {order.customers.primary_contact_person}
                          </p>
                        )}
                        <div className='flex gap-3 text-sm'>
                          {order.customers?.phone_number && (
                            <span className='flex items-center gap-1'>
                              <Phone className='w-3 h-3' />
                              {order.customers.phone_number}
                            </span>
                          )}
                          {order.customers?.email && (
                            <span className='flex items-center gap-1'>
                              <Mail className='w-3 h-3' />
                              {order.customers.email}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Location Info */}
                    <div className='bg-muted/50 rounded-lg p-3'>
                      <div className='flex items-center gap-2 mb-2'>
                        <MapPin className='w-4 h-4 text-muted-foreground' />
                        <span className='text-sm font-semibold'>Location</span>
                      </div>
                      <div className='ml-6 space-y-1'>
                        <div className='flex items-center gap-2'>
                          <Building className='w-3 h-3 text-muted-foreground' />
                          <span className='font-medium'>{order.locations?.building_name}</span>
                        </div>
                        <p className='text-sm text-muted-foreground'>
                          Floor {order.locations?.floor}, Room {order.locations?.room_number}
                        </p>
                        {order.locations?.description && (
                          <p className='text-sm text-muted-foreground italic'>
                            {order.locations.description}
                          </p>
                        )}
                        {order.customers?.billing_address && (
                          <p className='text-sm pt-1 border-t mt-2'>
                            {order.customers.billing_address}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Description */}
                    {order.description && (
                      <div className='bg-blue-50 border border-blue-200 rounded-lg p-3'>
                        <span className='text-sm font-semibold text-blue-900'>Order Description:</span>
                        <p className='text-sm text-blue-800 mt-1'>{order.description}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className='flex gap-3 mt-6'>
        <Button onClick={() => router.push('/dashboard/operasional/assign-order')} variant='outline' className='flex-1'>
          <ArrowLeft className='w-4 h-4 mr-2' />
          Assign More Orders
        </Button>
        <Button onClick={() => router.push('/dashboard/operasional/monitoring-ongoing')} className='flex-1'>
          View Ongoing Orders
        </Button>
      </div>
    </div>
  )
}

export default function AssignmentSuccessPage() {
  return (
    <Suspense fallback={
      <div className='max-w-4xl mx-auto py-8 px-4'>
        <Card>
          <CardHeader className='text-center'>
            <div className='flex justify-center mb-4'>
              <div className='w-16 h-16 rounded-full bg-green-100 flex items-center justify-center animate-pulse'>
                <CheckCircle2 className='w-8 h-8 text-green-600' />
              </div>
            </div>
            <CardTitle className='text-2xl font-bold'>Loading...</CardTitle>
          </CardHeader>
        </Card>
      </div>
    }>
      <AssignmentSuccessContent />
    </Suspense>
  )
}
