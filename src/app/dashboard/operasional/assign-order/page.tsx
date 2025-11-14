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
import { useToast } from '@/hooks/use-toast'

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
  const [filterStatus, setFilterStatus] = useState<string>('ALL')
  const [technicianSearch, setTechnicianSearch] = useState<string>('')
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [isAssigning, setIsAssigning] = useState(false)

  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey: ['orders', 'assignable'],
    queryFn: () => getOrders({ statusIn: 'ACCEPTED,RESCHEDULE', limit: 100 })
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
  const filteredOrders = orders.filter((o: any) => {
    const matchesServiceType = filterServiceType === 'ALL' || o.order_type === filterServiceType
    const matchesStatus = filterStatus === 'ALL' || o.status === filterStatus
    return matchesServiceType && matchesStatus
  })
  const orderCounts = SERVICE_TYPES.reduce((acc, type) => {
    acc[type.value] = orders.filter((o: any) => o.order_type === type.value).length
    return acc
  }, {} as Record<string, number>)
  
  // Count orders by status
  const acceptedCount = orders.filter((o: any) => o.status === 'ACCEPTED').length
  const rescheduleCount = orders.filter((o: any) => o.status === 'RESCHEDULE').length

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
          <div className='space-y-6'><Card><CardHeader><CardTitle>Step 2: Select Orders</CardTitle><CardDescription>Choose orders to assign from ACCEPTED and RESCHEDULE status</CardDescription></CardHeader></Card>
          
          {/* Status Filter Cards */}
          <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
            <Card className={cn('cursor-pointer transition-all hover:shadow-md', filterStatus === 'ALL' && 'ring-2 ring-primary')} onClick={() => setFilterStatus('ALL')}>
              <CardContent className='p-4 text-center'>
                <div className='text-2xl font-bold'>{orders.length}</div>
                <div className='text-xs text-muted-foreground mt-1'>All Status</div>
              </CardContent>
            </Card>
            <Card className={cn('cursor-pointer transition-all hover:shadow-md', filterStatus === 'ACCEPTED' && 'ring-2 ring-primary')} onClick={() => setFilterStatus('ACCEPTED')}>
              <CardContent className='p-4 text-center'>
                <div className='w-3 h-3 rounded-full mx-auto mb-2 bg-blue-500' />
                <div className='text-2xl font-bold'>{acceptedCount}</div>
                <div className='text-xs text-muted-foreground mt-1'>Accepted</div>
              </CardContent>
            </Card>
            <Card className={cn('cursor-pointer transition-all hover:shadow-md', filterStatus === 'RESCHEDULE' && 'ring-2 ring-primary')} onClick={() => setFilterStatus('RESCHEDULE')}>
              <CardContent className='p-4 text-center'>
                <div className='w-3 h-3 rounded-full mx-auto mb-2 bg-amber-500' />
                <div className='text-2xl font-bold'>{rescheduleCount}</div>
                <div className='text-xs text-muted-foreground mt-1'>Reschedule</div>
              </CardContent>
            </Card>
          </div>
          <div className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4'>
            <Card className={cn('cursor-pointer transition-all hover:shadow-md', filterServiceType === 'ALL' && 'ring-2 ring-primary')} onClick={() => setFilterServiceType('ALL')}>
              <CardContent className='p-4 text-center'><div className='text-2xl font-bold'>{orders.length}</div><div className='text-xs text-muted-foreground mt-1'>All Orders</div></CardContent></Card>
            {SERVICE_TYPES.map((type) => (<Card key={type.value} className={cn('cursor-pointer transition-all hover:shadow-md', filterServiceType === type.value && 'ring-2 ring-primary')} onClick={() => setFilterServiceType(type.value)}>
              <CardContent className='p-4 text-center'><div className={cn('w-3 h-3 rounded-full mx-auto mb-2', type.color)} /><div className='text-2xl font-bold'>{orderCounts[type.value] || 0}</div>
              <div className='text-xs text-muted-foreground mt-1'>{type.label}</div></CardContent></Card>))}
          </div>
          <div className='grid gap-4'>{ordersLoading ? <p>Loading orders...</p> : filteredOrders.length === 0 ? (<Card><CardContent className='p-8 text-center text-muted-foreground'>No orders found for assignment</CardContent></Card>) : (
            filteredOrders.map((order: any) => {const serviceType = SERVICE_TYPES.find(t => t.value === order.order_type); const isSelected = selectedOrders.includes(order.order_id)
            return (<Card key={order.order_id} className={cn('transition-all', isSelected && 'ring-2 ring-primary', order.status === 'RESCHEDULE' && 'bg-amber-50 border-l-4 border-l-amber-500')}><CardContent className='p-4'><div className='flex items-start gap-4'>
              <Checkbox checked={isSelected} onCheckedChange={(checked) => {if (checked) {setSelectedOrders([...selectedOrders, order.order_id])} else {setSelectedOrders(selectedOrders.filter(id => id !== order.order_id))}}} className='mt-1' />
              <div className='flex-1 grid grid-cols-2 md:grid-cols-6 gap-4'><div><div className='text-xs text-muted-foreground'>Order ID</div><div className='font-semibold'>{order.order_id}</div></div>
              <div><div className='text-xs text-muted-foreground'>Customer</div><div className='font-medium'>{order.customers?.customer_name}</div></div>
              <div><div className='text-xs text-muted-foreground'>Status</div><Badge className={cn('text-white', order.status === 'RESCHEDULE' ? 'bg-amber-500' : 'bg-blue-500')}>{order.status}</Badge></div>
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
      <Dialog open={!!detailOrderId} onOpenChange={(open) => !open && setDetailOrderId(null)}>
        <DialogContent className='max-w-2xl max-h-[80vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>Order Details</DialogTitle>
            <DialogDescription>Complete information about this order</DialogDescription>
          </DialogHeader>
          {orderDetail?.data && (() => {
            // Group order_items by location
            const groupedByLocation = (orderDetail.data.order_items || []).reduce((acc: any, item: any) => {
              const locationId = item.location_id || 'unknown'
              if (!acc[locationId]) {
                acc[locationId] = {
                  location: item.locations,
                  items: []
                }
              }
              acc[locationId].items.push(item)
              return acc
            }, {})

            const totalEstimated = (orderDetail.data.order_items || []).reduce((sum: number, item: any) => 
              sum + (item.estimated_price || 0), 0
            )

            const SERVICE_TYPES = [
              { value: 'REFILL_FREON', label: 'Refill Freon' },
              { value: 'CLEANING', label: 'Cleaning' },
              { value: 'REPAIR', label: 'Repair' },
              { value: 'INSTALLATION', label: 'Installation' },
              { value: 'INSPECTION', label: 'Inspection' },
            ]

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
                        <Badge>{orderDetail.data.status}</Badge>
                      </div>
                    </div>
                    <div>
                      <span className='text-muted-foreground'>Order Date:</span>
                      <p className='font-semibold'>
                        {orderDetail.data.order_date ? format(new Date(orderDetail.data.order_date), 'dd MMM yyyy') : '-'}
                      </p>
                    </div>
                    <div>
                      <span className='text-muted-foreground'>Requested Visit:</span>
                      <p className='font-semibold'>
                        {orderDetail.data.req_visit_date ? format(new Date(orderDetail.data.req_visit_date), 'dd MMM yyyy') : '-'}
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
                          <span className='text-muted-foreground'>Phone:</span>
                          {orderDetail.data.customers.phone_number}
                        </div>
                      )}
                      {orderDetail.data.customers?.email && (
                        <div className='flex items-center gap-1'>
                          <span className='text-muted-foreground'>Email:</span>
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
                    <h3 className='font-semibold text-lg'>Locations & Services ({Object.keys(groupedByLocation).length} locations)</h3>
                  </div>
                  <div className='space-y-3'>
                    {Object.entries(groupedByLocation).map(([locationId, data]: [string, any]) => (
                      <div key={locationId} className='border rounded-lg p-4 space-y-3'>
                        <div className='flex items-start gap-2'>
                          <div className='flex-1'>
                            <p className='font-semibold'>{data.location?.building_name || 'Unknown Location'}</p>
                            <p className='text-sm text-muted-foreground'>
                              Floor {data.location?.floor} - Room {data.location?.room_number}
                            </p>
                          </div>
                        </div>
                        
                        <div className='space-y-2 pl-0'>
                          <p className='text-sm font-semibold text-muted-foreground'>Services:</p>
                          {data.items.map((item: any, idx: number) => (
                            <div key={idx} className='flex justify-between items-start text-sm p-2 bg-muted/50 rounded'>
                              <div className='space-y-1'>
                                <div className='flex items-center gap-2'>
                                  <Badge variant='outline' className='text-xs'>
                                    {SERVICE_TYPES.find(t => t.value === item.service_type)?.label || item.service_type}
                                  </Badge>
                                  <span className='text-muted-foreground'>×{item.quantity}</span>
                                </div>
                                {item.ac_units && (
                                  <p className='text-xs text-muted-foreground'>
                                    AC: {item.ac_units.brand} {item.ac_units.model_number}
                                    {item.ac_units.serial_number && ` (SN: ${item.ac_units.serial_number})`}
                                  </p>
                                )}
                              </div>
                              <div className='font-semibold'>
                                Rp {item.estimated_price?.toLocaleString('id-ID') || '0'}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className='flex justify-between items-center pt-3 border-t font-semibold'>
                    <span>Total Estimated Price:</span>
                    <span className='text-lg'>Rp {totalEstimated.toLocaleString('id-ID')}</span>
                  </div>
                </div>
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Confirm Assignment</AlertDialogTitle>
      <AlertDialogDescription>Are you sure you want to assign <strong>{selectedOrders.length}</strong> order(s) to <strong>{selectedTechnicianData?.technician_name}</strong>?<br /><br />
      Visit Date: <strong>{selectedDate && format(selectedDate, 'PPP')}</strong></AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={isAssigning}>Cancel</AlertDialogCancel>
      <AlertDialogAction onClick={handleConfirmAssign} disabled={isAssigning}>{isAssigning ? 'Assigning...' : 'Confirm'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </div>
  )
}
