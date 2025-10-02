'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getOrders, getOrderById, assignOrdersToTechnician } from '@/lib/actions/orders'
import { getTechnicians } from '@/lib/actions/technicians'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Calendar } from '@/components/ui/calendar'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
import { ChevronLeft, ChevronRight, Eye, MapPin, User } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useToast } from '@/components/ui/use-toast'

const SERVICE_TYPES = [
  { value: 'REFILL_FREON', label: 'Refill Freon', color: 'bg-blue-500' },
  { value: 'CLEANING', label: 'Cleaning', color: 'bg-green-500' },
  { value: 'REPAIR', label: 'Repair', color: 'bg-orange-500' },
  { value: 'INSTALLATION', label: 'Installation', color: 'bg-purple-500' },
  { value: 'INSPECTION', label: 'Inspection', color: 'bg-cyan-500' },
]

export default function AssignOrderPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [currentStep, setCurrentStep] = useState(1)
  const [selectedDate, setSelectedDate] = useState<Date>()
  const [selectedOrders, setSelectedOrders] = useState<string[]>([])
  const [selectedTechnician, setSelectedTechnician] = useState<string>('')
  const [filterServiceType, setFilterServiceType] = useState<string>('ALL')
  const [technicianSearch, setTechnicianSearch] = useState<string>('')
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [isAssigning, setIsAssigning] = useState(false)

  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey: ['orders', 'ACCEPTED'],
    queryFn: () => getOrders({ status: 'ACCEPTED', limit: 100 })
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
  const filteredOrders = filterServiceType === 'ALL' ? orders : orders.filter((o: any) => o.order_type === filterServiceType)
  const orderCounts = SERVICE_TYPES.reduce((acc, type) => {
    acc[type.value] = orders.filter((o: any) => o.order_type === type.value).length
    return acc
  }, {} as Record<string, number>)

  // Filter technicians by search
  const technicians = techniciansData?.data || []
  const filteredTechnicians = technicians.filter((tech: any) => {
    if (!technicianSearch) return true
    const searchLower = technicianSearch.toLowerCase()
    return (
      tech.technician_name?.toLowerCase().includes(searchLower) ||
      tech.company?.toLowerCase().includes(searchLower) ||
      tech.contact_number?.toLowerCase().includes(searchLower)
    )
  })

  const handleNextStep = () => {
    if (currentStep === 1 && !selectedDate) {
      toast({ title: 'Warning', description: 'Please select a visit date', variant: 'destructive' })
      return
    }
    if (currentStep === 2 && selectedOrders.length === 0) {
      toast({ title: 'Warning', description: 'Please select at least one order', variant: 'destructive' })
      return
    }
    if (currentStep === 3 && !selectedTechnician) {
      toast({ title: 'Warning', description: 'Please select a technician', variant: 'destructive' })
      return
    }
    if (currentStep === 3) {
      setShowConfirm(true)
    } else {
      setCurrentStep(currentStep + 1)
    }
  }

  const handleConfirmAssign = async () => {
    if (selectedDate && selectedTechnician && selectedOrders.length > 0) {
      try {
        setIsAssigning(true)
        console.log('Starting assignment...')
        const formattedDate = format(selectedDate, 'yyyy-MM-dd')
        
        // Call server action directly
        const result = await assignOrdersToTechnician({
          orderIds: selectedOrders,
          technicianId: selectedTechnician,
          scheduledDate: formattedDate
        })
        
        console.log('Assignment result:', result)
        
        if (result.success) {
          toast({ title: 'Success', description: result.message })
          queryClient.invalidateQueries({ queryKey: ['orders'] })
          
          // Redirect to success page with details
          const params = new URLSearchParams({
            ids: selectedOrders.join(','),
            tech: selectedTechnician,
            date: formattedDate
          })
          router.push(`/dashboard/operasional/assign-order/success?${params.toString()}`)
        } else {
          toast({ title: 'Error', description: result.error || 'Failed to assign orders', variant: 'destructive' })
        }
      } catch (error) {
        console.error('Assignment error:', error)
        toast({ 
          title: 'Error', 
          description: error instanceof Error ? error.message : 'Failed to assign orders',
          variant: 'destructive' 
        })
      } finally {
        setIsAssigning(false)
      }
    }
  }

  const selectedTechnicianData = techniciansData?.data?.find((t: any) => t.technician_id === selectedTechnician)

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
          <Card><CardHeader><CardTitle>Step 1: Select Visit Date</CardTitle><CardDescription>Choose the scheduled visit date for the orders</CardDescription></CardHeader>
          <CardContent className='flex justify-center'><Calendar mode='single' selected={selectedDate} onSelect={setSelectedDate} disabled={(date) => date < new Date()} className='rounded-md border' /></CardContent>
          <div className='p-6 pt-0'>{selectedDate && <p className='text-center text-sm text-muted-foreground mb-4'>Selected: {format(selectedDate, 'PPP')}</p>}
          <div className='flex justify-end'><Button onClick={handleNextStep} disabled={!selectedDate}>Next <ChevronRight className='ml-2 h-4 w-4' /></Button></div></div></Card>
        )}
        {currentStep === 2 && (
          <div className='space-y-6'><Card><CardHeader><CardTitle>Step 2: Select Orders</CardTitle><CardDescription>Choose orders to assign</CardDescription></CardHeader></Card>
          <div className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4'>
            <Card className={cn('cursor-pointer transition-all hover:shadow-md', filterServiceType === 'ALL' && 'ring-2 ring-primary')} onClick={() => setFilterServiceType('ALL')}>
              <CardContent className='p-4 text-center'><div className='text-2xl font-bold'>{orders.length}</div><div className='text-xs text-muted-foreground mt-1'>All Orders</div></CardContent></Card>
            {SERVICE_TYPES.map((type) => (<Card key={type.value} className={cn('cursor-pointer transition-all hover:shadow-md', filterServiceType === type.value && 'ring-2 ring-primary')} onClick={() => setFilterServiceType(type.value)}>
              <CardContent className='p-4 text-center'><div className={cn('w-3 h-3 rounded-full mx-auto mb-2', type.color)} /><div className='text-2xl font-bold'>{orderCounts[type.value] || 0}</div>
              <div className='text-xs text-muted-foreground mt-1'>{type.label}</div></CardContent></Card>))}
          </div>
          <div className='grid gap-4'>{ordersLoading ? <p>Loading orders...</p> : filteredOrders.length === 0 ? (<Card><CardContent className='p-8 text-center text-muted-foreground'>No accepted orders found</CardContent></Card>) : (
            filteredOrders.map((order: any) => {const serviceType = SERVICE_TYPES.find(t => t.value === order.order_type); const isSelected = selectedOrders.includes(order.order_id)
            return (<Card key={order.order_id} className={cn('transition-all', isSelected && 'ring-2 ring-primary')}><CardContent className='p-4'><div className='flex items-start gap-4'>
              <Checkbox checked={isSelected} onCheckedChange={(checked) => {if (checked) {setSelectedOrders([...selectedOrders, order.order_id])} else {setSelectedOrders(selectedOrders.filter(id => id !== order.order_id))}}} className='mt-1' />
              <div className='flex-1 grid grid-cols-2 md:grid-cols-5 gap-4'><div><div className='text-xs text-muted-foreground'>Order ID</div><div className='font-semibold'>{order.order_id}</div></div>
              <div><div className='text-xs text-muted-foreground'>Customer</div><div className='font-medium'>{order.customers?.customer_name}</div></div>
              <div><div className='text-xs text-muted-foreground'>Order Date</div><div>{order.order_date ? format(new Date(order.order_date), 'dd MMM yyyy') : '-'}</div></div>
              <div><div className='text-xs text-muted-foreground'>Req. Visit Date</div><div>{order.req_visit_date ? format(new Date(order.req_visit_date), 'dd MMM yyyy') : '-'}</div></div>
              <div><div className='text-xs text-muted-foreground'>Service Type</div><Badge className={serviceType?.color}>{serviceType?.label || order.order_type}</Badge></div></div>
              <Button variant='outline' size='sm' onClick={() => setDetailOrderId(order.order_id)}><Eye className='h-4 w-4' /></Button></div></CardContent></Card>)}))}</div>
          <div className='flex justify-between'><Button variant='outline' onClick={() => setCurrentStep(1)}><ChevronLeft className='mr-2 h-4 w-4' /> Back</Button>
          <Button onClick={handleNextStep} disabled={selectedOrders.length === 0}>Next ({selectedOrders.length} selected) <ChevronRight className='ml-2 h-4 w-4' /></Button></div></div>
        )}

        {/* Step 3: Select Technician */}
        {currentStep === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>Step 3: Select Technician</CardTitle>
              <CardDescription>Choose a technician to assign {selectedOrders.length} order(s)</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Search Bar */}
              <div className='mb-4 relative'>
                <User className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
                <Input
                  placeholder='Search technician by name, company, or contact...'
                  value={technicianSearch}
                  onChange={(e) => setTechnicianSearch(e.target.value)}
                  className='pl-9'
                />
              </div>

              {filteredTechnicians.length === 0 ? (
                <div className='text-center py-8 text-muted-foreground'>
                  {technicianSearch ? 'No technicians found matching your search' : 'No technicians available'}
                </div>
              ) : (
                <RadioGroup value={selectedTechnician} onValueChange={setSelectedTechnician}>
                  <div className='grid gap-4 max-h-[400px] overflow-y-auto pr-2'>
                    {filteredTechnicians.map((technician: any) => (
                      <div
                        key={technician.technician_id}
                        className={cn(
                          'flex items-center space-x-4 rounded-lg border p-4 cursor-pointer transition-all hover:bg-muted/50',
                          selectedTechnician === technician.technician_id && 'ring-2 ring-primary bg-muted'
                        )}
                        onClick={() => setSelectedTechnician(technician.technician_id)}
                      >
                        <RadioGroupItem value={technician.technician_id} id={technician.technician_id} />
                        <Label htmlFor={technician.technician_id} className='flex-1 cursor-pointer'>
                          <div className='flex items-center justify-between'>
                            <div>
                              <div className='font-semibold'>{technician.technician_name}</div>
                              {technician.company && (
                                <div className='text-sm text-muted-foreground'>{technician.company}</div>
                              )}
                              {technician.contact_number && (
                                <div className='text-sm text-muted-foreground'>{technician.contact_number}</div>
                              )}
                            </div>
                            <User className='h-8 w-8 text-muted-foreground' />
                          </div>
                        </Label>
                      </div>
                    ))}
                  </div>
                </RadioGroup>
              )}
            </CardContent>
            <div className='p-6 pt-0 flex justify-between'>
              <Button variant='outline' onClick={() => setCurrentStep(2)}>
                <ChevronLeft className='mr-2 h-4 w-4' /> Back
              </Button>
              <Button onClick={handleNextStep} disabled={!selectedTechnician}>
                Confirm Assignment
              </Button>
            </div>
          </Card>
        )}
      </div>
      <Dialog open={!!detailOrderId} onOpenChange={(open) => !open && setDetailOrderId(null)}><DialogContent className='max-w-2xl max-h-[80vh] overflow-y-auto'>
      <DialogHeader><DialogTitle>Order Details</DialogTitle><DialogDescription>Complete information about this order</DialogDescription></DialogHeader>
      {orderDetail?.data && (<div className='space-y-4'><div className='grid grid-cols-2 gap-4'><div><div className='text-sm font-semibold text-muted-foreground'>Order ID</div><div>{orderDetail.data.order_id}</div></div>
      <div><div className='text-sm font-semibold text-muted-foreground'>Status</div><Badge>{orderDetail.data.status}</Badge></div><div><div className='text-sm font-semibold text-muted-foreground'>Order Date</div>
      <div>{orderDetail.data.order_date ? format(new Date(orderDetail.data.order_date), 'PPP') : '-'}</div></div><div><div className='text-sm font-semibold text-muted-foreground'>Requested Visit</div>
      <div>{orderDetail.data.req_visit_date ? format(new Date(orderDetail.data.req_visit_date), 'PPP') : '-'}</div></div></div><div className='border-t pt-4'><h3 className='font-semibold mb-2 flex items-center gap-2'>
      <User className='h-4 w-4' /> Customer Information</h3><div className='grid gap-2'><div><span className='text-sm font-semibold text-muted-foreground'>Name: </span>{orderDetail.data.customers?.customer_name}</div>
      <div><span className='text-sm font-semibold text-muted-foreground'>Contact: </span>{orderDetail.data.customers?.primary_contact_person}</div>
      <div><span className='text-sm font-semibold text-muted-foreground'>Phone: </span>{orderDetail.data.customers?.phone_number}</div>
      <div><span className='text-sm font-semibold text-muted-foreground'>Email: </span>{orderDetail.data.customers?.email}</div></div></div>
      <div className='border-t pt-4'><h3 className='font-semibold mb-2 flex items-center gap-2'><MapPin className='h-4 w-4' /> Location</h3><div className='grid gap-2'>
      <div><span className='text-sm font-semibold text-muted-foreground'>Building: </span>{orderDetail.data.locations?.building_name}</div>
      <div><span className='text-sm font-semibold text-muted-foreground'>Floor: </span>{orderDetail.data.locations?.floor}</div>
      <div><span className='text-sm font-semibold text-muted-foreground'>Room: </span>{orderDetail.data.locations?.room_number}</div>
      {orderDetail.data.locations?.description && <div><span className='text-sm font-semibold text-muted-foreground'>Description: </span>{orderDetail.data.locations.description}</div>}
      <div className='mt-2'><span className='text-sm font-semibold text-muted-foreground'>Address: </span><p className='text-sm'>{orderDetail.data.customers?.billing_address}</p></div></div></div></div>)}</DialogContent></Dialog>
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Confirm Assignment</AlertDialogTitle>
      <AlertDialogDescription>Are you sure you want to assign <strong>{selectedOrders.length}</strong> order(s) to <strong>{selectedTechnicianData?.technician_name}</strong>?<br /><br />
      Visit Date: <strong>{selectedDate && format(selectedDate, 'PPP')}</strong></AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={isAssigning}>Cancel</AlertDialogCancel>
      <AlertDialogAction onClick={handleConfirmAssign} disabled={isAssigning}>{isAssigning ? 'Assigning...' : 'Confirm'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </div>
  )
}
