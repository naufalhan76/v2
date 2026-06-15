'use client'

import { Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useQuery, useQueries } from '@tanstack/react-query'
import { getOrderById } from '@/lib/actions/orders'
import { getTechnicianById } from '@/lib/actions/technicians'
import { CheckCircle2, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { logger } from '@/lib/logger'
import { TechnicianInfoCard } from './_components/technician-info-card'
import { OrderDetailCard } from './_components/order-detail-card'

function AssignmentSuccessContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const orderIds = searchParams.get('ids')?.split(',') || []
  const technicianId = searchParams.get('tech') || ''
  const helperIds = searchParams.get('helpers')?.split(',').filter(Boolean) || []
  const scheduledDate = searchParams.get('date') || ''

  logger.debug('Technician ID:', technicianId)
  logger.debug('Helper IDs:', helperIds)

  const { data: technicianData } = useQuery({
    queryKey: ['technician', technicianId],
    queryFn: () => getTechnicianById(technicianId),
    enabled: !!technicianId,
  })

  const helperResults = useQueries({
    queries: helperIds.map((id) => ({ queryKey: ['technician', id], queryFn: () => getTechnicianById(id), enabled: !!id })),
  })
  const helpers = helperResults.flatMap(q => q.data?.data ? [q.data.data] : [])

  const orderResults = useQueries({
    queries: orderIds.map((id) => ({ queryKey: ['order', id], queryFn: () => getOrderById(id), enabled: !!id })),
  })
  const orders = orderResults.flatMap(q => q.data?.data ? [q.data.data] : []) as Array<{
    order_id: string; order_date?: string; order_type?: string; notes?: string;
    customers?: { customer_name?: string; primary_contact_person?: string; phone_number?: string; email?: string };
    order_items?: Array<{ location_id?: string; service_type?: string; quantity?: number; estimated_price?: number;
      locations?: { building_name?: string; floor?: string; room_number?: string };
      ac_units?: { brand?: string; model_number?: string; serial_number?: string } }>
  }>
  const isLoading = orderResults.some(q => q.isLoading)

  return (
    <div className='p-6 max-w-5xl mx-auto'>
      <div className='text-center mb-8'>
        <div className='inline-flex items-center justify-center w-16 h-16 rounded-full bg-status-completed-bg mb-4'>
          <CheckCircle2 className='w-10 h-10 text-success' />
        </div>
        <h1 className='text-3xl font-bold mb-2'>Assignment Successful!</h1>
        <p className='text-muted-foreground'>{orderIds.length} order{orderIds.length > 1 ? 's' : ''} have been successfully assigned</p>
      </div>

      <TechnicianInfoCard technicianData={technicianData as any} scheduledDate={scheduledDate} helpers={helpers} />

      <Card>
        <CardHeader>
          <CardTitle>Assigned Orders ({orderIds.length})</CardTitle>
          <CardDescription>Details of all assigned orders</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? <p className='text-sm text-muted-foreground'>Loading orders...</p> : <OrderDetailCard orders={orders} />}
        </CardContent>
      </Card>

      <div className='flex gap-3 mt-6'>
        <Button onClick={() => router.push('/dashboard/operasional/assign-order')} variant='outline' className='flex-1'>
          <ArrowLeft className='w-4 h-4 mr-2' />Assign More Orders
        </Button>
        <Button onClick={() => router.push('/dashboard/operasional/monitoring-ongoing')} className='flex-1'>View Ongoing Orders</Button>
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
              <div className='w-16 h-16 rounded-full bg-status-completed-bg flex items-center justify-center animate-pulse'>
                <CheckCircle2 className='w-8 h-8 text-success' />
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
