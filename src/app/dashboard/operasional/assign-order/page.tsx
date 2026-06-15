'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getOrders, getOrderById, assignOrdersToTechnician } from '@/lib/actions/orders'
import { getTechnicians } from '@/lib/actions/technicians'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar } from '@/components/ui/calendar'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { useSortableTable } from '@/hooks/use-sortable-table'
import { useToast } from '@/hooks/use-toast'
import { logger } from '@/lib/logger'
import { OrderSelectionTable } from './_components/order-selection-table'
import { TechnicianSelector } from './_components/technician-selector'
import { OrderDetailDialog } from './_components/order-detail-dialog'
import { ConfirmAssignmentDialog } from './_components/confirm-assignment-dialog'

export default function AssignOrderPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [currentStep, setCurrentStep] = useState(1)
  const [selectedDate, setSelectedDate] = useState<Date>()
  const [selectedOrders, setSelectedOrders] = useState<string[]>([])
  const [selectedTechnician, setSelectedTechnician] = useState<string>('')
  const [selectedHelpers, setSelectedHelpers] = useState<string[]>([])
  const [filterServiceType, setFilterServiceType] = useState<string>('ALL')
  const [filterStatus, setFilterStatus] = useState<string>('ALL')
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null)
  const [today, setToday] = useState<Date>()
  useEffect(() => { setToday(new Date(new Date().setHours(0, 0, 0, 0))) }, [])
  const [showConfirm, setShowConfirm] = useState(false)
  const [isAssigning, setIsAssigning] = useState(false)

  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey: ['orders', 'assignable'],
    queryFn: () => getOrders({ statusIn: 'PENDING', limit: 100 })
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

  const orders = ordersData?.data || []
  const filteredOrdersBase = orders.filter((o: unknown) => {
    const order = o as Record<string, unknown>
    const matchesServiceType = filterServiceType === 'ALL' || order.order_type === filterServiceType
    const matchesStatus = filterStatus === 'ALL' || order.status === filterStatus
    return matchesServiceType && matchesStatus
  })
  const { sortedData: filteredOrders } = useSortableTable(filteredOrdersBase, { key: 'order_id', direction: 'desc' })

  const orderCounts = SERVICE_TYPES.reduce((acc, type) => {
    acc[type.value] = orders.filter((o: unknown) => (o as Record<string, unknown>).order_type === type.value).length
    return acc
  }, {} as Record<string, number>)
  const acceptedCount = orders.filter((o: unknown) => (o as Record<string, unknown>).status === 'ACCEPTED').length
  const rescheduleCount = orders.filter((o: unknown) => (o as Record<string, unknown>).status === 'RESCHEDULE').length
  const technicians = techniciansData?.data || []
  const selectedTechnicianData = techniciansData?.data?.find((t: unknown) => (t as Record<string, unknown>).technician_id === selectedTechnician) as Record<string, unknown> & { technician_name?: string } | undefined

  const handleNextStep = () => {
    if (currentStep === 1 && !selectedDate) {
      toast({ title: 'Warning', description: 'Please select a visit date', variant: 'destructive' }); return
    }
    if (currentStep === 2 && selectedOrders.length === 0) {
      toast({ title: 'Warning', description: 'Please select at least one order', variant: 'destructive' }); return
    }
    if (currentStep === 3 && !selectedTechnician) {
      toast({ title: 'Warning', description: 'Please select a technician', variant: 'destructive' }); return
    }
    if (currentStep === 3) { setShowConfirm(true) } else { setCurrentStep(currentStep + 1) }
  }

  const handleConfirmAssign = async () => {
    if (selectedDate && selectedTechnician && selectedOrders.length > 0) {
      try {
        setIsAssigning(true)
        const formattedDate = format(selectedDate, 'yyyy-MM-dd')
        const result = await assignOrdersToTechnician({
          orderIds: selectedOrders, technicianId: selectedTechnician,
          helperTechnicianIds: selectedHelpers.length > 0 ? selectedHelpers : undefined,
          scheduledDate: formattedDate
        })
        if (result.success) {
          toast({ title: 'Success', description: result.message })
          queryClient.invalidateQueries({ queryKey: ['orders'] })
          const params = new URLSearchParams({
            ids: selectedOrders.join(','), tech: selectedTechnician,
            helpers: selectedHelpers.join(','), date: formattedDate
          })
          router.push(`/dashboard/operasional/assign-order/success?${params.toString()}`)
        } else {
          toast({ title: 'Error', description: result.error || 'Failed to assign orders', variant: 'destructive' })
        }
      } catch (error) {
        toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to assign orders', variant: 'destructive' })
      } finally { setIsAssigning(false) }
    }
  }

  return (
    <div className='p-6'>
      <div className='mb-6'>
        <h1 className='text-3xl font-bold'>Assign Order</h1>
        <p className='text-muted-foreground mt-1'>Assign accepted orders to technicians</p>
      </div>
      <div className='flex items-center justify-center mb-8'>
        {[1, 2, 3].map((step) => (
          <div key={step} className='flex items-center'>
            <div className={cn('w-10 h-10 rounded-full flex items-center justify-center font-semibold', currentStep >= step ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>{step}</div>
            {step < 3 && <div className={cn('w-24 h-1 mx-2', currentStep > step ? 'bg-primary' : 'bg-muted')} />}
          </div>
        ))}
      </div>
      <div className='max-w-5xl mx-auto'>
        {currentStep === 1 && (
          <Card>
            <CardHeader><CardTitle>Step 1: Select Visit Date</CardTitle><CardDescription>Choose the scheduled visit date for the orders</CardDescription></CardHeader>
            <CardContent className='flex justify-center'>
              <div data-testid='schedule-date-picker'>
                <Calendar mode='single' selected={selectedDate} onSelect={setSelectedDate} disabled={today ? (date) => date < today : undefined} className='rounded-md border' />
              </div>
            </CardContent>
            <div className='p-6 pt-0'>
              {selectedDate && <p className='text-center text-sm text-muted-foreground mb-4'>Selected: {format(selectedDate, 'PPP')}</p>}
              <div className='flex justify-end'>
                <Button onClick={handleNextStep} disabled={!selectedDate}>Next</Button>
              </div>
            </div>
          </Card>
        )}
        {currentStep === 2 && (
          <OrderSelectionTable
            orders={orders} filteredOrders={filteredOrders} ordersLoading={ordersLoading}
            filterStatus={filterStatus} filterServiceType={filterServiceType}
            selectedOrders={selectedOrders} acceptedCount={acceptedCount} rescheduleCount={rescheduleCount}
            orderCounts={orderCounts}
            onFilterStatusChange={setFilterStatus} onFilterServiceTypeChange={setFilterServiceType}
            onOrderSelect={(id, checked) => checked ? setSelectedOrders([...selectedOrders, id]) : setSelectedOrders(selectedOrders.filter(i => i !== id))}
            onDetailOrder={setDetailOrderId} onNext={handleNextStep} onBack={() => setCurrentStep(1)}
          />
        )}
        {currentStep === 3 && (
          <TechnicianSelector
            technicians={technicians} selectedOrdersCount={selectedOrders.length}
            selectedTechnician={selectedTechnician} selectedHelpers={selectedHelpers}
            onTechnicianChange={setSelectedTechnician} onHelpersChange={setSelectedHelpers}
            onBack={() => setCurrentStep(2)} onConfirm={handleNextStep}
          />
        )}
      </div>
      <OrderDetailDialog detailOrderId={detailOrderId} orderDetail={orderDetail} onClose={() => setDetailOrderId(null)} />
      <ConfirmAssignmentDialog
        showConfirm={showConfirm} selectedOrders={selectedOrders}
        selectedTechnicianData={selectedTechnicianData} selectedHelpers={selectedHelpers}
        technicians={technicians} selectedDate={selectedDate}
        isAssigning={isAssigning} onConfirm={handleConfirmAssign} onCancel={() => setShowConfirm(false)}
      />
    </div>
  )
}

const SERVICE_TYPES = [
  { value: 'REFILL_FREON', label: 'Refill Freon' },
  { value: 'CLEANING', label: 'Cleaning' },
  { value: 'REPAIR', label: 'Repair' },
  { value: 'INSTALLATION', label: 'Installation' },
  { value: 'INSPECTION', label: 'Inspection' },
]
