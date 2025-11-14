'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle 
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { LoadingOverlay } from '@/components/ui/loading-state'
import { useToast } from '@/hooks/use-toast'
import { 
  searchCustomerByPhone, 
  createCustomer,
  createLocation,
  createOrderWithItems,
  getServicePricing,
  getTechnicians
} from '@/lib/actions/create-order'
import type { 
  OrderFormState, 
  LocationFormData, 
  ServiceType,
  ServicePricing 
} from '@/types/create-order'
import { 
  Search, 
  Plus, 
  Trash2, 
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronRight,
  Package,
  MapPin,
  User,
  CheckCircle2,
  Loader2,
  X
} from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

// Helper: Normalize phone number (08xxx → 628xxx)
const normalizePhone = (phone: string): string => {
  let normalized = phone.trim()
  // Convert 08xx to 628xx
  if (normalized.startsWith('0')) {
    normalized = '62' + normalized.substring(1)
  }
  // Remove non-numeric except +
  normalized = normalized.replace(/[^\d+]/g, '')
  // Remove + prefix
  if (normalized.startsWith('+')) {
    normalized = normalized.substring(1)
  }
  return normalized
}

const SERVICE_TYPES: { value: ServiceType; label: string; color: string }[] = [
  { value: 'INSTALLATION', label: 'Installation', color: 'bg-blue-500' },
  { value: 'MAINTENANCE', label: 'Maintenance', color: 'bg-green-500' },
  { value: 'REPAIR', label: 'Repair', color: 'bg-orange-500' },
  { value: 'CLEANING', label: 'Cleaning', color: 'bg-purple-500' },
]

export default function CreateOrderPage() {
  const router = useRouter()
  const { toast } = useToast()
  
  // Form State
  const [phoneInput, setPhoneInput] = useState('')
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false)
  const [isPhoneVerified, setIsPhoneVerified] = useState(false)
  const [customer, setCustomer] = useState<OrderFormState['customer']>(null)
  const [isNewCustomer, setIsNewCustomer] = useState(false)
  const [newCustomerName, setNewCustomerName] = useState('')
  const [newCustomerEmail, setNewCustomerEmail] = useState('')
  
  const [locations, setLocations] = useState<LocationFormData[]>([])
  const [scheduledDate, setScheduledDate] = useState<Date>()
  const [technicianId, setTechnicianId] = useState<string>('')
  const [notes, setNotes] = useState('')
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [expandedLocations, setExpandedLocations] = useState<Set<number>>(new Set([0]))
  
  // Modal states
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null)

  // Fetch service pricing
  const { data: pricingData } = useQuery({
    queryKey: ['service-pricing'],
    queryFn: getServicePricing
  })
  const servicePricing = pricingData?.data || []

  // Fetch technicians
  const { data: techniciansData } = useQuery({
    queryKey: ['technicians'],
    queryFn: getTechnicians
  })
  const technicians = techniciansData?.data || []

  // Step 1: Search Customer
  const handleSearchCustomer = async () => {
    if (!phoneInput.trim()) {
      toast({
        title: 'Phone Required',
        description: 'Please enter phone number',
        variant: 'destructive'
      })
      return
    }

    const normalizedPhone = normalizePhone(phoneInput)

    setIsSearchingCustomer(true)
    try {
      const result = await searchCustomerByPhone(normalizedPhone)
      
      if (result.success && result.data) {
        // Existing customer found
        setCustomer({
          customer_id: result.data.customer_id,
          customer_name: result.data.customer_name,
          phone_number: result.data.phone_number,
          email: result.data.email
        })
        setIsNewCustomer(false)
        setIsPhoneVerified(true)
        
        // Pre-populate locations if available
        if (result.data.locations && result.data.locations.length > 0) {
          setLocations(result.data.locations.map(loc => ({
            location_id: loc.location_id,
            building_name: loc.building_name,
            floor: loc.floor,
            room_number: loc.room_number,
            description: loc.description || undefined,
            existing_acs: loc.ac_units?.map(ac => ({
              ac_unit_id: ac.ac_unit_id,
              brand: ac.brand,
              model_number: ac.model_number,
              serial_number: ac.serial_number || '',
              selected_services: [],
              notes: ''
            })) || [],
            new_ac_units: []
          })))
          setExpandedLocations(new Set([0]))
        }
        
        toast({
          title: 'Customer Found',
          description: `Welcome back, ${result.data.customer_name}!`
        })
      } else {
        // No customer found - enable new customer creation
        setIsPhoneVerified(true)
        setIsNewCustomer(true)
        setCustomer(null)
        toast({
          title: 'New Customer',
          description: 'Phone not found. Please create new customer.',
          variant: 'default'
        })
      }
    } catch (error) {
      toast({
        title: 'Search Failed',
        description: error instanceof Error ? error.message : 'Failed to search customer',
        variant: 'destructive'
      })
    } finally {
      setIsSearchingCustomer(false)
    }
  }

  // Add new location
  const handleAddLocation = () => {
    setLocations([...locations, {
      existing_acs: [],
      new_ac_units: []
    }])
    setExpandedLocations(prev => {
      const next = new Set(prev)
      next.add(locations.length)
      return next
    })
  }

  // Remove location
  const handleRemoveLocation = (index: number) => {
    setLocations(locations.filter((_, i) => i !== index))
    setExpandedLocations(prev => {
      const next = new Set(prev)
      next.delete(index)
      return next
    })
  }

  // Toggle location expansion
  const toggleLocation = (index: number) => {
    setExpandedLocations(prev => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  // Calculate estimated total
  const calculateTotal = (): number => {
    let total = 0
    
    locations.forEach(loc => {
      // Existing AC services
      loc.existing_acs.forEach(ac => {
        ac.selected_services.forEach(serviceType => {
          const pricing = servicePricing.find(p => p.service_type === serviceType)
          total += pricing?.base_price || 0
        })
      })
      
      // New AC services (each unit can have different services)
      loc.new_ac_units.forEach(unit => {
        unit.selected_services.forEach(serviceType => {
          const pricing = servicePricing.find(p => p.service_type === serviceType)
          total += pricing?.base_price || 0
        })
      })
    })
    
    return total
  }

  // Validate and show confirm modal
  const handleSubmitClick = () => {
    // Validation
    if (!isPhoneVerified) {
      toast({ title: 'Error', description: 'Please verify phone number first', variant: 'destructive' })
      return
    }

    if (isNewCustomer && !newCustomerName.trim()) {
      toast({ title: 'Error', description: 'Customer name is required', variant: 'destructive' })
      return
    }

    if (locations.length === 0) {
      toast({ title: 'Error', description: 'Please add at least one location', variant: 'destructive' })
      return
    }

    if (!scheduledDate) {
      toast({ title: 'Error', description: 'Please select scheduled visit date', variant: 'destructive' })
      return
    }
    
    // Count total services
    const totalServices = locations.reduce((acc, loc) => {
      const existingServices = loc.existing_acs.reduce((sum, ac) => sum + ac.selected_services.length, 0)
      const newServices = loc.new_ac_units.reduce((sum, unit) => sum + unit.selected_services.length, 0)
      return acc + existingServices + newServices
    }, 0)
    
    if (totalServices === 0) {
      toast({ title: 'Error', description: 'Please select at least one service', variant: 'destructive' })
      return
    }

    // Show confirmation modal
    setShowConfirmModal(true)
  }

  // Submit order (called after confirmation)
  const handleConfirmSubmit = async () => {
    setShowConfirmModal(false)
    setIsSubmitting(true)
    
    try {
      let customerId = customer?.customer_id

      // Step 1: Create customer if new
      if (isNewCustomer) {
        // Auto-generate billing_address from first location
        const firstLocation = locations[0]
        let billingAddress = 'TBD'
        
        if (firstLocation) {
          const parts = []
          if (firstLocation.building_name) parts.push(firstLocation.building_name)
          if (firstLocation.floor) parts.push(`Floor ${firstLocation.floor}`)
          if (firstLocation.room_number) parts.push(`Room ${firstLocation.room_number}`)
          if (firstLocation.description) parts.push(firstLocation.description)
          
          billingAddress = parts.length > 0 ? parts.join(', ') : 'TBD'
        }
        
        const customerResult = await createCustomer({
          customer_name: newCustomerName,
          phone_number: normalizePhone(phoneInput),
          email: newCustomerEmail || undefined,
          billing_address: billingAddress
        })
        
        if (!customerResult.success || !customerResult.data) {
          throw new Error(customerResult.error || 'Failed to create customer')
        }
        
        customerId = customerResult.data.customer_id
      }

      if (!customerId) throw new Error('Customer ID not found')

      // Step 2: Create new locations if needed and collect order items
      const orderItems = []
      
      for (const loc of locations) {
        let locationId = loc.location_id

        // Create new location if needed
        if (!locationId && loc.building_name) {
          const locResult = await createLocation({
            customer_id: customerId,
            building_name: loc.building_name,
            floor: loc.floor,
            room_number: loc.room_number,
            description: loc.description
          })
          
          if (!locResult.success || !locResult.data) {
            throw new Error('Failed to create location')
          }
          
          locationId = locResult.data.location_id
        }

        if (!locationId) continue

        // Add existing AC services
        for (const ac of loc.existing_acs) {
          for (const serviceType of ac.selected_services) {
            const pricing = servicePricing.find(p => p.service_type === serviceType)
            orderItems.push({
              location_id: locationId,
              ac_unit_id: ac.ac_unit_id,
              service_type: serviceType,
              quantity: 1,
              description: ac.notes || undefined,
              estimated_price: pricing?.base_price || 0
            })
          }
        }

        // Add new AC services (each unit individually)
        for (const unit of loc.new_ac_units) {
          for (const serviceType of unit.selected_services) {
            const pricing = servicePricing.find(p => p.service_type === serviceType)
            orderItems.push({
              location_id: locationId,
              ac_unit_id: null,
              service_type: serviceType,
              quantity: 1, // Each new AC unit = 1 quantity
              description: unit.notes || undefined,
              estimated_price: pricing?.base_price || 0
            })
          }
        }
      }

      if (orderItems.length === 0) {
        throw new Error('No services selected')
      }

      // Step 3: Create order with items
      const orderResult = await createOrderWithItems({
        customer_id: customerId,
        scheduled_visit_date: format(scheduledDate!, 'yyyy-MM-dd'),
        assigned_technician_id: technicianId || null,
        notes: notes || undefined,
        items: orderItems
      })

      if (!orderResult.success) {
        throw new Error(orderResult.error || 'Failed to create order')
      }

      // Show success modal instead of toast
      setCreatedOrderId(orderResult.data?.order_id || null)
      setShowSuccessModal(true)
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create order',
        variant: 'destructive'
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <LoadingOverlay isLoading={isSubmitting}>
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold mb-2">Create Order</h1>
          <p className="text-muted-foreground">Create new service order with multiple locations and services</p>
        </div>

        {/* Step 1: Customer Search */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Customer Information
            </CardTitle>
            <CardDescription>Search existing customer or create new</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <div className="flex-1">
                <Label>Phone Number *</Label>
                <Input
                  type="tel"
                  placeholder="08123456789 or 628123456789"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  disabled={isPhoneVerified}
                  className={isPhoneVerified ? 'bg-muted' : ''}
                />
              </div>
              {!isPhoneVerified ? (
                <Button 
                  onClick={handleSearchCustomer}
                  disabled={isSearchingCustomer}
                  className="mt-auto"
                >
                  {isSearchingCustomer ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                  Search
                </Button>
              ) : (
                <Button 
                  variant="outline"
                  onClick={() => {
                    setIsPhoneVerified(false)
                    setCustomer(null)
                    setIsNewCustomer(false)
                    setNewCustomerName('')
                    setNewCustomerEmail('')
                    setLocations([])
                    setScheduledDate(undefined)
                    setTechnicianId('')
                    setNotes('')
                  }}
                  className="mt-auto"
                >
                  <X className="h-4 w-4 mr-2" />
                  Reset
                </Button>
              )}
            </div>

            {isPhoneVerified && customer && (
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription>
                  <strong>{customer.customer_name}</strong>
                  {customer.email && ` • ${customer.email}`}
                </AlertDescription>
              </Alert>
            )}

            {isPhoneVerified && isNewCustomer && (
              <div className="space-y-4 border rounded-lg p-4 bg-blue-50">
                <p className="text-sm font-medium text-blue-900">New Customer - Fill details below:</p>
                <div>
                  <Label>Customer Name *</Label>
                  <Input
                    placeholder="PT. Company Name"
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Email (Optional)</Label>
                  <Input
                    type="email"
                    placeholder="email@company.com"
                    value={newCustomerEmail}
                    onChange={(e) => setNewCustomerEmail(e.target.value)}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Step 2: Locations & Services (Unlocked after phone verified) */}
        {isPhoneVerified && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Locations & Services
                  </CardTitle>
                  <CardDescription>Add locations and select services for each AC unit</CardDescription>
                </div>
                <Button onClick={handleAddLocation} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Location
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {locations.length === 0 ? (
                <Alert>
                  <AlertDescription>No locations added yet. Click &quot;Add Location&quot; to start.</AlertDescription>
                </Alert>
              ) : (
                locations.map((loc, locIndex) => (
                  <LocationCard
                    key={locIndex}
                    location={loc}
                    index={locIndex}
                    isExpanded={expandedLocations.has(locIndex)}
                    onToggle={() => toggleLocation(locIndex)}
                    onRemove={() => handleRemoveLocation(locIndex)}
                    onChange={(updated) => {
                      const next = [...locations]
                      next[locIndex] = updated
                      setLocations(next)
                    }}
                    servicePricing={servicePricing}
                    customerLocations={customer?.customer_id ? locations : []}
                    isNewCustomer={isNewCustomer}
                  />
                ))
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 3: Schedule (Unlocked after locations added) */}
        {isPhoneVerified && locations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                Schedule & Assignment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Scheduled Visit Date *</Label>
                  <div className="flex gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("flex-1 justify-start text-left font-normal", !scheduledDate && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {scheduledDate ? format(scheduledDate, 'PPP') : 'Pick a date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar mode="single" selected={scheduledDate} onSelect={setScheduledDate} initialFocus />
                      </PopoverContent>
                    </Popover>
                    {scheduledDate && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setScheduledDate(undefined)}
                        title="Reset date"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                <div>
                  <Label>Assign Technician (Optional)</Label>
                  <div className="flex gap-2">
                    <Select value={technicianId} onValueChange={setTechnicianId}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select technician" />
                      </SelectTrigger>
                      <SelectContent>
                        {technicians.map(tech => (
                          <SelectItem key={tech.technician_id} value={tech.technician_id}>
                            {tech.full_name} ({tech.employee_id})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {technicianId && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setTechnicianId('')}
                        title="Reset technician"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              <div>
                <Label>Order Notes</Label>
                <Textarea
                  placeholder="Additional notes or special instructions..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Summary & Submit */}
        {isPhoneVerified && locations.length > 0 && scheduledDate && (
          <Card className="border-2 border-primary">
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center text-2xl font-bold">
                <span>Estimated Total:</span>
                <span className="text-primary">Rp {calculateTotal().toLocaleString('id-ID')}</span>
              </div>
              <Separator />
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => router.back()} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={handleSubmitClick} disabled={isSubmitting} className="flex-1">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Create Order
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </LoadingOverlay>
      
      {/* Modals */}
      <ConfirmationModal
        open={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleConfirmSubmit}
        customer={customer}
        isNewCustomer={isNewCustomer}
        newCustomerName={newCustomerName}
        newCustomerEmail={newCustomerEmail}
        phoneInput={phoneInput}
        locations={locations}
        scheduledDate={scheduledDate}
        technicianId={technicianId}
        technicians={technicians}
        servicePricing={servicePricing}
        notes={notes}
        totalPrice={calculateTotal()}
      />
      
      <SuccessModal
        open={showSuccessModal}
        onClose={() => {
          setShowSuccessModal(false)
          // Reset form
          setPhoneInput('')
          setIsPhoneVerified(false)
          setCustomer(null)
          setIsNewCustomer(false)
          setNewCustomerName('')
          setNewCustomerEmail('')
          setLocations([])
          setScheduledDate(undefined)
          setTechnicianId('')
          setNotes('')
          setCreatedOrderId(null)
        }}
        orderId={createdOrderId}
        customer={customer}
        isNewCustomer={isNewCustomer}
        newCustomerName={newCustomerName}
        phoneInput={phoneInput}
        scheduledDate={scheduledDate}
        technicianId={technicianId}
        technicians={technicians}
        totalPrice={calculateTotal()}
        serviceCount={locations.reduce((acc, loc) => {
          const existingServices = loc.existing_acs.reduce((sum, ac) => sum + ac.selected_services.length, 0)
          const newServices = loc.new_ac_units.reduce((sum, unit) => sum + unit.selected_services.length, 0)
          return acc + existingServices + newServices
        }, 0)}
      />
    </div>
  )
}

// Location Card Component (continued in next file due to length)
function LocationCard({
  location,
  index,
  isExpanded,
  onToggle,
  onRemove,
  onChange,
  servicePricing,
  customerLocations,
  isNewCustomer
}: {
  location: LocationFormData
  index: number
  isExpanded: boolean
  onToggle: () => void
  onRemove: () => void
  onChange: (location: LocationFormData) => void
  servicePricing: ServicePricing[]
  customerLocations: LocationFormData[]
  isNewCustomer: boolean
}) {
  const isNewLocation = !location.location_id

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onToggle} className="flex items-center gap-2">
          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <Package className="h-4 w-4" />
          <span className="font-semibold">
            Location {index + 1} {location.building_name && `- ${location.building_name}`}
          </span>
        </Button>
        <Button variant="ghost" size="sm" onClick={onRemove}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>

      {isExpanded && (
        <div className="space-y-4 pl-6">
          {/* Location Selection/Input */}
          {isNewLocation ? (
            <div className="space-y-3 bg-muted/50 p-3 rounded-lg">
              <div>
                <Label>Building Name *</Label>
                <Input
                  placeholder="e.g., Head Office, Branch A"
                  value={location.building_name || ''}
                  onChange={(e) => onChange({ ...location, building_name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Floor</Label>
                  <Input
                    type="number"
                    placeholder="e.g., 1, 2, 3"
                    value={location.floor || 1}
                    onChange={(e) => onChange({ ...location, floor: parseInt(e.target.value) || 1 })}
                  />
                </div>
                <div>
                  <Label>Room Number</Label>
                  <Input
                    placeholder="e.g., 101, A-12"
                    value={location.room_number || ''}
                    onChange={(e) => onChange({ ...location, room_number: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  placeholder="Additional notes about this location..."
                  value={location.description || ''}
                  onChange={(e) => onChange({ ...location, description: e.target.value })}
                  rows={2}
                />
              </div>
            </div>
          ) : (
            <Alert>
              <AlertDescription>
                <strong>{location.building_name}</strong> - Floor {location.floor}, Room {location.room_number}<br />
                {location.description && <span className="text-sm text-muted-foreground">{location.description}</span>}
              </AlertDescription>
            </Alert>
          )}

          {/* Existing AC Units */}
          {location.existing_acs.length > 0 && (
            <div className="space-y-2">
              <Label className="text-base">Existing AC Units</Label>
              {location.existing_acs.map((ac, acIndex) => (
                <div key={acIndex} className="border rounded p-3 space-y-2 bg-card">
                  <div className="font-medium text-sm">
                    {ac.brand} {ac.model_number} {ac.serial_number && `(${ac.serial_number})`}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Select Services:</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {SERVICE_TYPES.map(svc => (
                        <div key={svc.value} className="flex items-center space-x-2">
                          <Checkbox
                            id={`ac-${index}-${acIndex}-${svc.value}`}
                            checked={ac.selected_services.includes(svc.value)}
                            onCheckedChange={(checked) => {
                              const updated = { ...location }
                              if (checked) {
                                updated.existing_acs[acIndex].selected_services.push(svc.value)
                              } else {
                                updated.existing_acs[acIndex].selected_services = 
                                  updated.existing_acs[acIndex].selected_services.filter(s => s !== svc.value)
                              }
                              onChange(updated)
                            }}
                          />
                          <label htmlFor={`ac-${index}-${acIndex}-${svc.value}`} className="text-sm cursor-pointer">
                            {svc.label}
                            <span className="text-xs text-muted-foreground ml-1">
                              (Rp {servicePricing.find(p => p.service_type === svc.value)?.base_price.toLocaleString('id-ID') || 0})
                            </span>
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* New AC Units */}
          <div className="space-y-3 border-t pt-3">
            <div className="flex items-center justify-between">
              <Label className="text-base">New AC Units (to be registered by technician)</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const updated = { ...location }
                  updated.new_ac_units.push({
                    temp_id: `new-ac-${Date.now()}-${Math.random()}`,
                    selected_services: [],
                    notes: ''
                  })
                  onChange(updated)
                }}
              >
                <Plus className="w-4 h-4 mr-1" />
                Add New AC
              </Button>
            </div>
            
            {location.new_ac_units.length > 0 && (
              <div className="space-y-3">
                {location.new_ac_units.map((unit, unitIndex) => (
                  <div key={unit.temp_id} className="border rounded p-3 space-y-2 bg-muted/30">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">New AC #{unitIndex + 1}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const updated = { ...location }
                          updated.new_ac_units = updated.new_ac_units.filter((_, i) => i !== unitIndex)
                          onChange(updated)
                        }}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                    
                    <div className="space-y-1">
                      <Label className="text-xs">Select Services:</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {SERVICE_TYPES.map(svc => (
                          <div key={svc.value} className="flex items-center space-x-2">
                            <Checkbox
                              id={`new-ac-${index}-${unitIndex}-${svc.value}`}
                              checked={unit.selected_services.includes(svc.value)}
                              onCheckedChange={(checked) => {
                                const updated = { ...location }
                                if (checked) {
                                  updated.new_ac_units[unitIndex].selected_services.push(svc.value)
                                } else {
                                  updated.new_ac_units[unitIndex].selected_services = 
                                    updated.new_ac_units[unitIndex].selected_services.filter(s => s !== svc.value)
                                }
                                onChange(updated)
                              }}
                            />
                            <label htmlFor={`new-ac-${index}-${unitIndex}-${svc.value}`} className="text-sm cursor-pointer">
                              {svc.label}
                              <span className="text-xs text-muted-foreground ml-1">
                                (Rp {servicePricing.find(p => p.service_type === svc.value)?.base_price.toLocaleString('id-ID') || 0})
                              </span>
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <Label className="text-xs">Notes</Label>
                      <Input
                        placeholder="Specifications or special instructions..."
                        value={unit.notes}
                        onChange={(e) => {
                          const updated = { ...location }
                          updated.new_ac_units[unitIndex].notes = e.target.value
                          onChange(updated)
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Confirmation Modal Component
function ConfirmationModal({ 
  open, 
  onClose, 
  onConfirm, 
  customer, 
  isNewCustomer,
  newCustomerName,
  newCustomerEmail,
  phoneInput,
  locations, 
  scheduledDate, 
  technicianId,
  technicians,
  servicePricing,
  notes,
  totalPrice
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  customer: any
  isNewCustomer: boolean
  newCustomerName: string
  newCustomerEmail: string
  phoneInput: string
  locations: LocationFormData[]
  scheduledDate: Date | undefined
  technicianId: string
  technicians: any[]
  servicePricing: ServicePricing[]
  notes: string
  totalPrice: number
}) {
  const selectedTech = technicians.find(t => t.technician_id === technicianId)
  
  // Count services
  const serviceCount = locations.reduce((acc, loc) => {
    const existingServices = loc.existing_acs.reduce((sum, ac) => sum + ac.selected_services.length, 0)
    const newServices = loc.new_ac_units.reduce((sum, unit) => sum + unit.selected_services.length, 0)
    return acc + existingServices + newServices
  }, 0)
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <CheckCircle2 className="w-6 h-6 text-blue-500" />
            Confirm Order Creation
          </DialogTitle>
          <DialogDescription>
            Please review the order details before submitting
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Customer Info */}
          <div className="border rounded-lg p-4 space-y-2">
            <h3 className="font-semibold flex items-center gap-2">
              <User className="w-4 h-4" />
              Customer Information
            </h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Name:</span>
                <p className="font-medium">{isNewCustomer ? newCustomerName : customer?.customer_name}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Phone:</span>
                <p className="font-medium">{phoneInput}</p>
              </div>
              {(isNewCustomer ? newCustomerEmail : customer?.email) && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">Email:</span>
                  <p className="font-medium">{isNewCustomer ? newCustomerEmail : customer?.email}</p>
                </div>
              )}
              {isNewCustomer && (
                <div className="col-span-2">
                  <Badge variant="outline" className="text-blue-600">New Customer</Badge>
                </div>
              )}
            </div>
          </div>
          
          {/* Schedule Info */}
          <div className="border rounded-lg p-4 space-y-2">
            <h3 className="font-semibold flex items-center gap-2">
              <CalendarIcon className="w-4 h-4" />
              Schedule
            </h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Visit Date:</span>
                <p className="font-medium">{scheduledDate ? format(scheduledDate, 'dd MMMM yyyy') : '-'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Assigned Technician:</span>
                <p className="font-medium">{selectedTech ? selectedTech.full_name : 'Not assigned'}</p>
              </div>
            </div>
          </div>
          
          {/* Locations Summary */}
          <div className="border rounded-lg p-4 space-y-2">
            <h3 className="font-semibold flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Locations ({locations.length})
            </h3>
            {locations.map((loc, idx) => (
              <div key={idx} className="text-sm space-y-1 pl-4 border-l-2">
                <p className="font-medium">
                  {loc.location_id ? `${loc.building_name}, Floor ${loc.floor}, Room ${loc.room_number}` : `New Location: ${loc.building_name || 'Unnamed'}`}
                </p>
                <div className="text-muted-foreground text-xs">
                  {loc.existing_acs.length > 0 && <span>{loc.existing_acs.length} existing AC(s)</span>}
                  {loc.existing_acs.length > 0 && loc.new_ac_units.length > 0 && <span> • </span>}
                  {loc.new_ac_units.length > 0 && <span>{loc.new_ac_units.length} new AC(s)</span>}
                </div>
              </div>
            ))}
          </div>
          
          {/* Services Summary */}
          <div className="border rounded-lg p-4 space-y-2">
            <h3 className="font-semibold flex items-center gap-2">
              <Package className="w-4 h-4" />
              Services Summary
            </h3>
            <div className="text-sm space-y-1">
              <p>Total Services: <span className="font-semibold">{serviceCount}</span></p>
              <p className="text-lg font-bold text-blue-600">
                Estimated Total: Rp {totalPrice.toLocaleString('id-ID')}
              </p>
            </div>
          </div>
          
          {notes && (
            <div className="border rounded-lg p-4 space-y-2">
              <h3 className="font-semibold">Notes</h3>
              <p className="text-sm text-muted-foreground">{notes}</p>
            </div>
          )}
        </div>
        
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onConfirm} className="bg-blue-600 hover:bg-blue-700">
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Create Order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Success Modal Component
function SuccessModal({ 
  open, 
  onClose, 
  orderId,
  customer,
  isNewCustomer,
  newCustomerName,
  phoneInput,
  scheduledDate,
  technicianId,
  technicians,
  totalPrice,
  serviceCount
}: {
  open: boolean
  onClose: () => void
  orderId: string | null
  customer: any
  isNewCustomer: boolean
  newCustomerName: string
  phoneInput: string
  scheduledDate: Date | undefined
  technicianId: string
  technicians: any[]
  totalPrice: number
  serviceCount: number
}) {
  const selectedTech = technicians.find(t => t.technician_id === technicianId)
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <DialogTitle className="text-2xl text-center">
            Order Created Successfully!
          </DialogTitle>
          <DialogDescription className="text-center">
            Your service order has been created and {technicianId ? 'assigned' : 'is waiting for technician assignment'}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="bg-muted rounded-lg p-4 space-y-2">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Order ID</p>
              <p className="text-xl font-bold font-mono text-blue-600">{orderId}</p>
            </div>
          </div>
          
          <Separator />
          
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Customer:</span>
              <span className="font-medium">{isNewCustomer ? newCustomerName : customer?.customer_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Phone:</span>
              <span className="font-medium">{phoneInput}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Visit Date:</span>
              <span className="font-medium">{scheduledDate ? format(scheduledDate, 'dd MMM yyyy') : '-'}</span>
            </div>
            {selectedTech && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Technician:</span>
                <span className="font-medium">{selectedTech.full_name}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Services:</span>
              <span className="font-medium">{serviceCount} service(s)</span>
            </div>
            <Separator />
            <div className="flex justify-between text-base font-bold">
              <span>Estimated Total:</span>
              <span className="text-green-600">Rp {totalPrice.toLocaleString('id-ID')}</span>
            </div>
          </div>
        </div>
        
        <DialogFooter className="sm:justify-center gap-2">
          <Button variant="outline" onClick={onClose}>
            Create Another Order
          </Button>
          <Button onClick={() => {
            onClose()
            window.location.href = '/dashboard/operasional/monitoring-ongoing'
          }} className="bg-blue-600 hover:bg-blue-700">
            View Orders
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
