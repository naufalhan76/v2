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
import { logger } from '@/lib/logger'

function AssignmentSuccessContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const orderIds = searchParams.get('ids')?.split(',') || []
  const technicianId = searchParams.get('tech') || ''
  const helperIds = searchParams.get('helpers')?.split(',').filter(Boolean) || []
  const scheduledDate = searchParams.get('date') || ''

  logger.debug('Technician ID:', technicianId) // Debug
  logger.debug('Helper IDs:', helperIds) // Debug

  const { data: technicianData } = useQuery({
    queryKey: ['technician', technicianId],
    queryFn: () => getTechnicianById(technicianId),
    enabled: !!technicianId
  })

  const helperQuery0 = useQuery({
    queryKey: ['technician', helperIds[0]],
    queryFn: () => getTechnicianById(helperIds[0]),
    enabled: !!helperIds[0]
  })
  const helperQuery1 = useQuery({
    queryKey: ['technician', helperIds[1]],
    queryFn: () => getTechnicianById(helperIds[1]),
    enabled: !!helperIds[1]
  })
  const helperQuery2 = useQuery({
    queryKey: ['technician', helperIds[2]],
    queryFn: () => getTechnicianById(helperIds[2]),
    enabled: !!helperIds[2]
  })
  const helperQuery3 = useQuery({
    queryKey: ['technician', helperIds[3]],
    queryFn: () => getTechnicianById(helperIds[3]),
    enabled: !!helperIds[3]
  })
  const helperQuery4 = useQuery({
    queryKey: ['technician', helperIds[4]],
    queryFn: () => getTechnicianById(helperIds[4]),
    enabled: !!helperIds[4]
  })
  const allHelperQueries = [helperQuery0, helperQuery1, helperQuery2, helperQuery3, helperQuery4]
  const helperQueries = allHelperQueries.slice(0, helperIds.length)
  const helpers = helperQueries.map(q => q.data?.data).filter(Boolean)

  const orderQuery0 = useQuery({
    queryKey: ['order', orderIds[0]],
    queryFn: () => getOrderById(orderIds[0]),
    enabled: !!orderIds[0]
  })
  const orderQuery1 = useQuery({
    queryKey: ['order', orderIds[1]],
    queryFn: () => getOrderById(orderIds[1]),
    enabled: !!orderIds[1]
  })
  const orderQuery2 = useQuery({
    queryKey: ['order', orderIds[2]],
    queryFn: () => getOrderById(orderIds[2]),
    enabled: !!orderIds[2]
  })
  const orderQuery3 = useQuery({
    queryKey: ['order', orderIds[3]],
    queryFn: () => getOrderById(orderIds[3]),
    enabled: !!orderIds[3]
  })
  const orderQuery4 = useQuery({
    queryKey: ['order', orderIds[4]],
    queryFn: () => getOrderById(orderIds[4]),
    enabled: !!orderIds[4]
  })
  const allOrderQueries = [orderQuery0, orderQuery1, orderQuery2, orderQuery3, orderQuery4]
  const orderQueries = allOrderQueries.slice(0, orderIds.length)
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
              {helpers.length > 0 && (
                <div className='pt-3 border-t'>
                  <div className='text-sm font-semibold text-muted-foreground mb-2'>Helper Technicians ({helpers.length}):</div>
                  <div className='space-y-2'>
                    {helpers.map((helper: unknown) => {
                      const h = helper as Record<string, unknown>
                      return (
                      <div key={h.technician_id as string} className='flex items-center justify-between p-2 bg-muted/50 rounded-lg'>
                        <div>
                          <div className='font-medium'>{h.technician_name as string}</div>
                          {h.contact_number && (
                            <div className='flex items-center gap-2 text-xs text-muted-foreground mt-0.5'>
                              <Phone className='w-3 h-3' />
                              {h.contact_number as string}
                            </div>
                          )}
                        </div>
                        <Badge variant='outline' className='bg-blue-50 text-blue-700 border-blue-200'>Helper</Badge>
                      </div>
                      )
                    })}
                  </div>
                </div>
              )}
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
              {orders.map((order: unknown, index: number) => {
                const o = order as Record<string, unknown>
                const customers = o.customers as Record<string, unknown> | undefined
                const orderItems = (o.order_items || []) as unknown[]
                const groupedByLocation = orderItems.reduce((acc: Record<string, unknown>, item: unknown) => {
                  const it = item as Record<string, unknown>
                  const locationId = (it.location_id as string) || 'unknown'
                  if (!acc[locationId]) {
                    acc[locationId] = { location: it.locations, items: [] }
                  }
                  ;(acc[locationId] as Record<string, unknown[]>).items.push(item)
                  return acc
                }, {})
                const locationCount = Object.keys(groupedByLocation).length
                return (
                <div key={o.order_id as string}>
                  {index > 0 && <Separator className='my-4' />}
                  <div className='space-y-3'>
                    {/* Order Header */}
                    <div className='flex items-start justify-between'>
                      <div>
                        <div className='flex items-center gap-2 mb-1'>
                          <span className='font-mono text-sm font-bold'>{o.order_id as string}</span>
                          <Badge className={SERVICE_TYPE_MAP[o.order_type as string]?.color || 'bg-gray-500'}>
                            {SERVICE_TYPE_MAP[o.order_type as string]?.label || o.order_type as string}
                          </Badge>
                        </div>
                        <p className='text-xs text-muted-foreground'>
                          Order Date: {o.order_date ? format(new Date(o.order_date as string), 'dd MMM yyyy') : '-'}
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
                        <p className='font-medium'>{customers?.customer_name as string}</p>
                        {customers?.primary_contact_person && (
                          <p className='text-sm text-muted-foreground'>
                            Contact: {customers.primary_contact_person as string}
                          </p>
                        )}
                        <div className='flex gap-3 text-sm'>
                          {customers?.phone_number && (
                            <span className='flex items-center gap-1'>
                              <Phone className='w-3 h-3' />
                              {customers.phone_number as string}
                            </span>
                          )}
                          {customers?.email && (
                            <span className='flex items-center gap-1'>
                              <Mail className='w-3 h-3' />
                              {customers.email as string}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Locations & Services */}
                    <div className='space-y-2'>
                      <div className='flex items-center gap-2'>
                        <MapPin className='w-4 h-4 text-muted-foreground' />
                        <span className='text-sm font-semibold'>
                          Locations & Services ({locationCount} location{locationCount > 1 ? 's' : ''})
                        </span>
                      </div>
                      <div className='space-y-3'>
                        {Object.entries(groupedByLocation).map(([locationId, data]: [string, unknown]) => {
                          const d = data as Record<string, unknown>
                          const loc = d.location as Record<string, unknown> | undefined
                          const items = d.items as unknown[]
                          return (
                          <div key={locationId} className='bg-muted/50 rounded-lg p-3 space-y-2'>
                            <div className='flex items-start gap-2'>
                              <Building className='w-4 h-4 text-muted-foreground mt-0.5' />
                              <div className='flex-1'>
                                <p className='font-medium'>{loc?.building_name as string || 'Unknown Location'}</p>
                                <p className='text-sm text-muted-foreground'>
                                  Floor {loc?.floor as string}, Room {loc?.room_number as string}
                                </p>
                              </div>
                            </div>
                            <div className='space-y-1.5 pl-6'>
                              <p className='text-xs font-semibold text-muted-foreground'>Services:</p>
                              {items.map((item: unknown, idx: number) => {
                                const it = item as Record<string, unknown>
                                const acUnits = it.ac_units as Record<string, unknown> | undefined
                                return (
                                <div key={idx} className='flex justify-between items-start text-sm p-2 bg-background rounded'>
                                  <div className='space-y-0.5'>
                                    <div className='flex items-center gap-2'>
                                      <Badge variant='outline' className='text-xs'>
                                        {SERVICE_TYPE_MAP[it.service_type as string]?.label || it.service_type as string}
                                      </Badge>
                                      <span className='text-xs text-muted-foreground'>×{it.quantity as number}</span>
                                    </div>
                                    {acUnits && (
                                      <p className='text-xs text-muted-foreground'>
                                        AC: {acUnits.brand as string} {acUnits.model_number as string}
                                        {acUnits.serial_number && ` (SN: ${acUnits.serial_number as string})`}
                                      </p>
                                    )}
                                  </div>
                                  <div className='text-xs font-semibold'>
                                    Rp {(it.estimated_price as number)?.toLocaleString('id-ID') || '0'}
                                  </div>
                                </div>
                                )
                              })}
                            </div>
                          </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Notes */}
                    {o.notes && (
                      <div className='bg-blue-50 border border-blue-200 rounded-lg p-3'>
                        <span className='text-sm font-semibold text-blue-900'>Order Notes:</span>
                        <p className='text-sm text-blue-800 mt-1'>{o.notes as string}</p>
                      </div>
                    )}
                  </div>
                </div>
                )
              })}
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
