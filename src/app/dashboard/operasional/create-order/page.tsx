'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { MultiSelectDropdown } from '@/components/ui/multi-select-dropdown'
import { SearchableSelect } from '@/components/ui/searchable-select'
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
  searchCustomers,
  searchCustomerByPhone, 
  getCustomerWithLocationsById,
  createCustomer,
  createLocation,
  createOrderWithItems,
  getOrderConfigMasterData,
  getTechnicians
} from '@/lib/actions/create-order'
import { updateCustomer } from '@/lib/actions/customers'
import { createInvoice, getInvoiceById, getOrderItemsForInvoice } from '@/lib/actions/invoices'
import { getInvoiceConfig } from '@/lib/actions/invoice-config'
import { exportInvoiceToPDF } from '@/lib/pdf-export'
import { Switch } from '@/components/ui/switch'
import { parseBankAccounts, type BankAccount } from '@/lib/bank-accounts'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type {
  OrderFormState,
  LocationFormData,
  CustomerSearchResult
} from '@/types/create-order'
import { LocationCard } from './components/LocationCard'
import { 
  Search, 
  Plus, 
  Calendar as CalendarIcon,
  Package,
  MapPin,
  User,
  CheckCircle2,
  Loader2,
  X,
  Edit2,
  Building2,
  AlertCircle,
  FileText
} from 'lucide-react'
import { format } from 'date-fns'
import { cn, formatPhone } from '@/lib/utils'

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

// Service type colors mapping
const _SERVICE_TYPE_COLORS: Record<string, string> = {
  'INSTALLATION': 'bg-blue-500',
  'MAINTENANCE': 'bg-green-500',
  'REPAIR': 'bg-orange-500',
  'CLEANING': 'bg-purple-500',
}

type CustomerSuggestion = {
  customer_id: string
  customer_name: string
  phone_number: string
  email: string | null
}

export default function CreateOrderPage() {
  const router = useRouter()
  const { toast } = useToast()
  
  // Form State
  const [phoneInput, setPhoneInput] = useState('')
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false)
  const [customerSuggestions, setCustomerSuggestions] = useState<CustomerSuggestion[]>([])
  const [isLoadingCustomerSuggestions, setIsLoadingCustomerSuggestions] = useState(false)
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false)
  const [highlightedSuggestionIndex, setHighlightedSuggestionIndex] = useState(-1)
  const [isPhoneVerified, setIsPhoneVerified] = useState(false)
  const [customer, setCustomer] = useState<OrderFormState['customer']>(null)
  const [isNewCustomer, setIsNewCustomer] = useState(false)
  const [newCustomerName, setNewCustomerName] = useState('')
  const [newCustomerEmail, setNewCustomerEmail] = useState('')
  const [newCustomerBillingAddress, setNewCustomerBillingAddress] = useState('')
  const [useSameAsFirstLocation, setUseSameAsFirstLocation] = useState(true)
  
  const [locations, setLocations] = useState<LocationFormData[]>([])
  const [scheduledDate, setScheduledDate] = useState<Date>()
  const [technicianId, setTechnicianId] = useState<string>('')
  const [helperTechnicianIds, setHelperTechnicianIds] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [expandedLocations, setExpandedLocations] = useState<Set<number>>(new Set([0]))
  
  // Modal states
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [showEditBillingModal, setShowEditBillingModal] = useState(false)
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null)
  const [createdInvoiceId, setCreatedInvoiceId] = useState<string | null>(null)
  const [proformaError, setProformaError] = useState<string | null>(null)

  // Proforma toggle state
  const [createProforma, setCreateProforma] = useState(false)
  const [proformaPaymentAccountId, setProformaPaymentAccountId] = useState('')
  const [proformaDueDate, setProformaDueDate] = useState('')
  const [proformaNotes, setProformaNotes] = useState('')
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  
  // Validation Alert Modal state
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [showValidationModal, setShowValidationModal] = useState(false)

  // Fetch master data
  const { data: masterDataResult } = useQuery({
    queryKey: ['order-master-data'],
    queryFn: getOrderConfigMasterData
  })
  const masterData = masterDataResult?.data || {
    unitTypes: [], capacityRanges: [], acBrands: [], serviceTypes: [], serviceCatalog: []
  }

  // Fetch technicians
  const { data: techniciansData } = useQuery({
    queryKey: ['technicians'],
    queryFn: getTechnicians
  })
  const technicians = techniciansData?.data || []

  // Load bank accounts for proforma payment account selection
  useEffect(() => {
    const loadBankAccounts = async () => {
      try {
        const { createClient } = await import('@/lib/supabase-browser')
        const supabase = createClient()
        const { data } = await supabase
          .from('invoice_configuration')
          .select('bank_accounts, default_due_days')
          .eq('is_active', true)
          .single()

        if (data?.bank_accounts) {
          setBankAccounts(parseBankAccounts(data.bank_accounts))
        }

        // Default due date: today + default_due_days
        const dueDays = data?.default_due_days || 30
        const due = new Date()
        due.setDate(due.getDate() + dueDays)
        setProformaDueDate(due.toISOString().split('T')[0])
      } catch {
        // Silent fail — toggle will show warning if user tries to enable
      }
    }
    loadBankAccounts()
  }, [])

  useEffect(() => {
    const query = phoneInput.trim()

    if (isPhoneVerified || query.length < 2) {
      setCustomerSuggestions([])
      setShowCustomerSuggestions(false)
      return
    }

    let isActive = true
    const timeoutId = window.setTimeout(async () => {
      setIsLoadingCustomerSuggestions(true)
      try {
        const result = await searchCustomers(query)
        if (!isActive) return

        const suggestions = result.success ? result.data || [] : []
        setCustomerSuggestions(suggestions)
        setShowCustomerSuggestions(suggestions.length > 0)
        setHighlightedSuggestionIndex(-1)
      } finally {
        if (isActive) setIsLoadingCustomerSuggestions(false)
      }
    }, 300)

    return () => {
      isActive = false
      window.clearTimeout(timeoutId)
    }
  }, [phoneInput, isPhoneVerified])

  const applyExistingCustomer = (data: CustomerSearchResult) => {
    setCustomer({
      customer_id: data.customer_id,
      customer_name: data.customer_name,
      phone_number: data.phone_number,
      email: data.email,
      billing_address: data.billing_address
    })
    setIsNewCustomer(false)
    setIsPhoneVerified(true)
    setPhoneInput(data.phone_number)
    setCustomerSuggestions([])
    setShowCustomerSuggestions(false)
    
    // Pre-populate locations if available
    if (data.locations && data.locations.length > 0) {
      setLocations(data.locations.map(loc => ({
        location_id: loc.location_id,
        full_address: loc.full_address,
        house_number: loc.house_number,
        city: loc.city,
        landmarks: loc.landmarks || undefined,
        existing_acs: loc.ac_units?.map(ac => ({
          ac_unit_id: ac.ac_unit_id,
          brand: ac.brand,
          model_number: ac.model_number,
          serial_number: ac.serial_number || '',
          selected_services: [],
          notes: '',
          is_selected: false
        })) || [],
        new_ac_units: []
      })))
      setExpandedLocations(new Set([0]))
    }
  }

  const handleSelectCustomerSuggestion = async (suggestion: CustomerSuggestion) => {
    setPhoneInput(suggestion.phone_number)
    setShowCustomerSuggestions(false)
    setIsSearchingCustomer(true)

    try {
      const result = await getCustomerWithLocationsById(suggestion.customer_id)

      if (result.success && result.data) {
        applyExistingCustomer(result.data)
        toast({
          title: 'Customer Selected',
          description: `${result.data.customer_name} is ready for this order.`
        })
      } else {
        toast({
          title: 'Customer Not Found',
          description: 'Please search by phone number again.',
          variant: 'destructive'
        })
      }
    } catch (error) {
      toast({
        title: 'Search Failed',
        description: error instanceof Error ? error.message : 'Failed to load customer details',
        variant: 'destructive'
      })
    } finally {
      setIsSearchingCustomer(false)
    }
  }

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
        applyExistingCustomer(result.data)
        
        toast({
          title: 'Customer Found',
          description: `Welcome back, ${result.data.customer_name}!`
        })
      } else {
        // No customer found - enable new customer creation
        setIsPhoneVerified(true)
        setIsNewCustomer(true)
        setCustomer(null)
        setCustomerSuggestions([])
        setShowCustomerSuggestions(false)
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
        ac.selected_services?.forEach((service: unknown) => {
          total += (service as Record<string, unknown>).price as number || 0
        })
      })
      // New AC services (each unit can have different services)
      loc.new_ac_units.forEach(unit => {
        unit.selected_services?.forEach((service: unknown) => {
          total += (service as Record<string, unknown>).price as number || 0
        })
      })
    })
    return total
  }

  const formatPaymentAccountLabel = (account: BankAccount, index: number) => {
    const label = account.account_label || `Payment Account ${index + 1}`
    const bank = account.bank || 'Unknown bank'
    const accountNumber = account.account_number || 'No. rekening belum diisi'
    const taxText = Number.isFinite(account.tax_percentage) ? `PPN ${account.tax_percentage}%` : 'PPN 11%'

    return `${label} • ${bank} - ${accountNumber} (${taxText})`
  }

  // Validate and show confirm modal
  const handleSubmitClick = () => {
    // Collect all validation errors
    const errors: string[] = []
    
    if (!isPhoneVerified) {
      errors.push('Phone number must be verified')
    }

    if (isNewCustomer && !newCustomerName.trim()) {
      errors.push('Customer name is required')
    }

    if (locations.length === 0) {
      errors.push('Please add at least one location')
    }

    // Check that each location has a full address
    locations.forEach((loc, index) => {
      if (!loc.full_address || !loc.full_address.trim()) {
        errors.push(`Location ${index + 1}: Full address is required`)
      }
    })

    if (!scheduledDate) {
      errors.push('Scheduled visit date is required')
    }
    
    // Count total services
    const totalServices = locations.reduce((acc, loc) => {
      const existingServices = loc.existing_acs.reduce((sum, ac) => sum + ac.selected_services.length, 0)
      const newServices = loc.new_ac_units.reduce((sum, unit) => sum + unit.selected_services.length, 0)
      return acc + existingServices + newServices
    }, 0)
    
    if (totalServices === 0) {
      errors.push('Please select at least one service')
    }

    // Proforma validation
    if (createProforma) {
      if (!technicianId) {
        errors.push('Proforma requires a lead technician to be assigned')
      }
      if (!proformaPaymentAccountId) {
        errors.push('Please select a payment account for the proforma')
      }
      if (!proformaDueDate) {
        errors.push('Please pick a proforma due date')
      }
      if (bankAccounts.length === 0) {
        errors.push('No payment accounts configured. Configure one in Invoice Config first.')
      }
    }

    // If there are errors, show modal instead of toast
    if (errors.length > 0) {
      setValidationErrors(errors)
      setShowValidationModal(true)
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
        // Determine billing address based on checkbox
        let billingAddress = 'TBD'
        
        if (useSameAsFirstLocation) {
          // Auto-generate from first location
          const firstLocation = locations[0]
          if (firstLocation) {
            const parts = []
            if (firstLocation.full_address) parts.push(firstLocation.full_address)
            if (firstLocation.house_number) parts.push(`House ${firstLocation.house_number}`)
            if (firstLocation.city) parts.push(firstLocation.city)
            
            billingAddress = parts.length > 0 ? parts.join(', ') : 'TBD'
          }
        } else {
          // Use custom billing address
          billingAddress = newCustomerBillingAddress.trim() || 'TBD'
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
      const orderItems: import('@/types/create-order').CreateOrderItemInput[] = []
      
      for (const loc of locations) {
        let locationId = loc.location_id

        // Create new location if needed
        if (!locationId && loc.full_address) {
          const locResult = await createLocation({
            customer_id: customerId,
            full_address: loc.full_address,
            house_number: loc.house_number,
            city: loc.city,
            landmarks: loc.landmarks
          })
          
          if (!locResult.success || !locResult.data) {
            throw new Error('Failed to create location')
          }
          
          locationId = locResult.data.location_id
        }

        if (!locationId) continue

        // Add existing AC services
        for (const ac of loc.existing_acs) {
          if (!ac.selected_services) continue;
          for (const service of ac.selected_services as unknown[]) {
            const svc = service as Record<string, unknown>
            orderItems.push({
              location_id: locationId,
              ac_unit_id: ac.ac_unit_id,
              unit_type_id: svc.unit_type_id as string | undefined,
              capacity_id: svc.capacity_id as string | undefined,
              brand_id: undefined,
              service_type_id: svc.service_type_id as string | undefined,
              catalog_id: svc.catalog_id as string | undefined,
              msn_code: svc.msn_code as string | undefined,
              service_type: svc.service_type as string,
              quantity: 1,
              description: ac.notes || undefined,
              estimated_price: (svc.price as number) || 0
            })
          }
        }

        // Add new AC services (each unit individually)
        for (const unit of loc.new_ac_units) {
          if (!unit.selected_services) continue;
          for (const service of unit.selected_services as unknown[]) {
            const usvc = service as Record<string, unknown>
            orderItems.push({
              location_id: locationId,
              ac_unit_id: null,
              unit_type_id: usvc.unit_type_id as string | undefined,
              capacity_id: usvc.capacity_id as string | undefined,
              brand_id: unit.brand_id,
              service_type_id: usvc.service_type_id as string | undefined,
              catalog_id: usvc.catalog_id as string | undefined,
              msn_code: usvc.msn_code as string | undefined,
              service_type: usvc.service_type as string,
              quantity: 1,
              description: unit.notes || undefined,
              estimated_price: (usvc.price as number) || 0,
              new_ac_data: {
                brand: unit.brand_id || 'TBD',
                model_number: 'TBD',
                capacity_btu: undefined
              }
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
        helper_technician_ids: helperTechnicianIds.length > 0 ? helperTechnicianIds : undefined,
        notes: notes || undefined,
        items: orderItems
      })

      if (!orderResult.success) {
        throw new Error(orderResult.error || 'Failed to create order')
      }

      const newOrderId = orderResult.data?.order_id || null
      setCreatedOrderId(newOrderId)
      setCreatedInvoiceId(null)
      setProformaError(null)

      // Auto-create proforma invoice if toggle enabled
      if (createProforma && newOrderId) {
        try {
          const orderItemsForInvoice = await getOrderItemsForInvoice(newOrderId)

          const invoiceItems = orderItemsForInvoice.map(item => {
            let desc = item.serviceName
            if (item.msnCode) {
              const unitInfo = [item.unitTypeName, item.capacityLabel].filter(Boolean).join(' ')
              desc = `[${item.msnCode}] ${item.serviceName}${unitInfo ? ` (${unitInfo})` : ''}`
            }
            if (item.quantity > 1) desc += ` × ${item.quantity}`
            return {
              item_type: 'BASE_SERVICE' as const,
              description: desc,
              quantity: item.quantity,
              unit_price: item.estimatedPrice,
            }
          })

          const baseServiceTotal = invoiceItems.reduce(
            (sum, it) => sum + it.quantity * it.unit_price,
            0
          )

          const serviceName = invoiceItems.length > 1
            ? 'Multiple Services'
            : (invoiceItems[0]?.description || 'Service')

          const firstOrderItem = orderItems[0]
          const serviceType = (firstOrderItem?.service_type as string) || 'PROFORMA'

          const selectedBankAccount = bankAccounts.find(
            acc => acc.id === proformaPaymentAccountId
          )
          if (!selectedBankAccount) {
            throw new Error('Selected payment account not found')
          }

          const newInvoice = await createInvoice({
            order_id: newOrderId,
            customer_id: customerId,
            invoice_type: 'PROFORMA',
            due_date: proformaDueDate,
            service_type: serviceType,
            service_name: serviceName,
            base_service_price: baseServiceTotal,
            items: invoiceItems,
            notes: proformaNotes || undefined,
            payment_account_id: selectedBankAccount.id,
            payment_account_label: selectedBankAccount.account_label,
            payment_bank_name: selectedBankAccount.bank,
            payment_account_number: selectedBankAccount.account_number,
            payment_account_name: selectedBankAccount.account_name,
            tax_percentage: selectedBankAccount.tax_percentage,
          })

          setCreatedInvoiceId(newInvoice.invoice_id)
        } catch (err) {
          setProformaError(
            err instanceof Error ? err.message : 'Failed to create proforma invoice'
          )
        }
      }

      // Show success modal
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
            <div className="space-y-2">
              <Label htmlFor="customer-search-input">Customer Name or Phone Number *</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="customer-search-input"
                    type="text"
                    placeholder="Search name or phone number"
                    value={phoneInput}
                    onChange={(e) => {
                      setPhoneInput(e.target.value)
                      setShowCustomerSuggestions(true)
                    }}
                    onFocus={() => setShowCustomerSuggestions(customerSuggestions.length > 0)}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape') {
                        setShowCustomerSuggestions(false)
                        setHighlightedSuggestionIndex(-1)
                      } else if (event.key === 'ArrowDown') {
                        if (!showCustomerSuggestions || customerSuggestions.length === 0) return
                        event.preventDefault()
                        setHighlightedSuggestionIndex(prev =>
                          prev < customerSuggestions.length - 1 ? prev + 1 : 0
                        )
                      } else if (event.key === 'ArrowUp') {
                        if (!showCustomerSuggestions || customerSuggestions.length === 0) return
                        event.preventDefault()
                        setHighlightedSuggestionIndex(prev =>
                          prev > 0 ? prev - 1 : customerSuggestions.length - 1
                        )
                      } else if (event.key === 'Enter') {
                        if (showCustomerSuggestions && highlightedSuggestionIndex >= 0 && customerSuggestions[highlightedSuggestionIndex]) {
                          event.preventDefault()
                          handleSelectCustomerSuggestion(customerSuggestions[highlightedSuggestionIndex])
                          setHighlightedSuggestionIndex(-1)
                        }
                      }
                    }}
                    disabled={isPhoneVerified}
                    className={isPhoneVerified ? 'bg-muted' : ''}
                  />
                  {!isPhoneVerified && (showCustomerSuggestions || isLoadingCustomerSuggestions) && (
                    <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
                      {isLoadingCustomerSuggestions ? (
                        <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Searching customers...
                        </div>
                      ) : customerSuggestions.length > 0 ? (
                        <div className="max-h-72 overflow-y-auto p-1">
                          {customerSuggestions.map((suggestion, index) => (
                            <button
                              key={suggestion.customer_id}
                              type="button"
                              data-testid="customer-suggestion-item"
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => handleSelectCustomerSuggestion(suggestion)}
                              onMouseEnter={() => setHighlightedSuggestionIndex(index)}
                              onMouseLeave={() => setHighlightedSuggestionIndex(-1)}
                              className={cn(
                                "flex w-full items-start gap-3 rounded-sm px-3 py-2 text-left text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
                                highlightedSuggestionIndex === index && "bg-accent text-accent-foreground"
                              )}
                            >
                              <User className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate font-medium">{suggestion.customer_name}</span>
                                <span className="block truncate text-xs text-muted-foreground">
                                  {formatPhone(suggestion.phone_number)}{suggestion.email ? ` • ${suggestion.email}` : ''}
                                </span>
                              </span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="px-3 py-2 text-sm text-muted-foreground">No matching customers found.</div>
                      )}
                    </div>
                  )}
                </div>
                {!isPhoneVerified ? (
                  <Button
                    onClick={handleSearchCustomer}
                    disabled={isSearchingCustomer}
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
                      setPhoneInput('')
                      setIsPhoneVerified(false)
                      setCustomer(null)
                      setIsNewCustomer(false)
                      setNewCustomerName('')
                      setNewCustomerEmail('')
                      setNewCustomerBillingAddress('')
                      setUseSameAsFirstLocation(true)
                      setLocations([])
                      setScheduledDate(undefined)
                      setTechnicianId('')
                      setNotes('')
                      setCustomerSuggestions([])
                      setShowCustomerSuggestions(false)
                    }}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Reset
                  </Button>
                )}
              </div>
              {!isPhoneVerified && (
                <p className="text-xs text-muted-foreground">
                  Pick an existing customer from suggestions or enter a new phone number and press Search.
                </p>
              )}
            </div>

            {isPhoneVerified && customer && (
              <div className="space-y-3">
                <Alert className="bg-green-50 border-green-200">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription>
                    <strong>{customer.customer_name}</strong>
                    {customer.email && ` • ${customer.email}`}
                  </AlertDescription>
                </Alert>
                
                {/* Billing Address Display with Edit Button */}
                <div className="border rounded-lg p-3 bg-muted/30">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <Label className="text-sm font-medium">Billing Address</Label>
                      </div>
                      <p className="text-sm text-muted-foreground pl-6">
                        {customer.billing_address || 'TBD - Not set yet'}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowEditBillingModal(true)}
                      className="shrink-0"
                    >
                      <Edit2 className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                  </div>
                </div>
              </div>
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
                
                {/* Billing Address */}
                <div className="space-y-2">
                  <Label>Billing Address</Label>
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="use-same-location"
                      checked={useSameAsFirstLocation}
                      onCheckedChange={(checked) => setUseSameAsFirstLocation(checked as boolean)}
                    />
                    <div className="flex-1">
                      <label htmlFor="use-same-location" className="text-sm cursor-pointer">
                        Use first service location as billing address
                      </label>
                      <p className="text-xs text-muted-foreground mt-1">
                        {useSameAsFirstLocation 
                          ? 'Billing address will be auto-generated from the first location you add below'
                          : 'Enter a custom billing address manually'}
                      </p>
                    </div>
                  </div>
                  
                  {!useSameAsFirstLocation && (
                    <Textarea
                      placeholder="Enter complete billing address..."
                      value={newCustomerBillingAddress}
                      onChange={(e) => setNewCustomerBillingAddress(e.target.value)}
                      rows={3}
                      className="mt-2"
                    />
                  )}
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
                    masterData={masterData}
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
                        <div data-testid="schedule-date-picker">
                          <Calendar
                            mode="single"
                            selected={scheduledDate}
                            onSelect={setScheduledDate}
                            disabled={(date) => { const today = new Date(); today.setHours(0, 0, 0, 0); return date < today }}
                            initialFocus
                          />
                        </div>
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
                <div className="space-y-4">
                  <div>
                    <Label>Assign Lead Technician (Optional)</Label>
                    <div className="flex gap-2">
                      <SearchableSelect
                        options={technicians.map(tech => ({
                          id: tech.technician_id,
                          label: tech.full_name,
                          secondaryLabel: tech.employee_id
                        }))}
                        value={technicianId}
                        onValueChange={setTechnicianId}
                        placeholder="Select lead technician"
                        searchPlaceholder="Search technician..."
                        className="flex-1"
                      />
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
                  
                  {technicianId && (
                    <div>
                      <Label>Helper Technicians (Optional)</Label>
                      <MultiSelectDropdown
                        options={technicians
                          .filter(t => t.technician_id !== technicianId)
                          .map(tech => ({
                            id: tech.technician_id,
                            label: tech.full_name,
                            secondaryLabel: tech.employee_id
                          }))}
                        selected={helperTechnicianIds}
                        onSelectionChange={setHelperTechnicianIds}
                        placeholder="Select helper technicians..."
                        searchPlaceholder="Search technicians..."
                      />
                    </div>
                  )}
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

              {/* Proforma toggle */}
              <div className="space-y-3 rounded-lg border p-4 bg-muted/30">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      <Label htmlFor="create-proforma" className="text-sm font-medium cursor-pointer">
                        Create Proforma Invoice
                      </Label>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Auto-generate a proforma invoice with this order. You can download the PDF right after creation.
                    </p>
                  </div>
                  <Switch
                    id="create-proforma"
                    checked={createProforma}
                    onCheckedChange={setCreateProforma}
                    disabled={!technicianId}
                  />
                </div>

                {!technicianId && createProforma && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Assign a lead technician first — proforma needs the order to be ASSIGNED.
                    </AlertDescription>
                  </Alert>
                )}

                {createProforma && technicianId && (
                  <div className="space-y-3 pt-2 border-t">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Payment Account *</Label>
                        <Select
                          value={proformaPaymentAccountId}
                          onValueChange={setProformaPaymentAccountId}
                        >
                          <SelectTrigger data-testid="payment-account-select">
                            <SelectValue placeholder="Pick payment account" />
                          </SelectTrigger>
                          <SelectContent>
                            {bankAccounts.length === 0 ? (
                              <div className="px-3 py-2 text-xs text-muted-foreground">
                                No payment accounts configured
                              </div>
                            ) : (
                              bankAccounts.map((acc, index) => {
                                const paymentAccountLabel = formatPaymentAccountLabel(acc, index)

                                return (
                                <SelectItem
                                  key={acc.id}
                                  value={acc.id}
                                  data-testid="payment-account-option"
                                >
                                  {paymentAccountLabel}
                                </SelectItem>
                                )
                              })
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Due Date *</Label>
                        <Input
                          type="date"
                          value={proformaDueDate}
                          onChange={(e) => setProformaDueDate(e.target.value)}
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Proforma Notes (Optional)</Label>
                      <Textarea
                        placeholder="Any notes for the proforma..."
                        value={proformaNotes}
                        onChange={(e) => setProformaNotes(e.target.value)}
                        rows={2}
                      />
                    </div>
                  </div>
                )}
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
      <ValidationAlertModal
        open={showValidationModal}
        onClose={() => setShowValidationModal(false)}
        errors={validationErrors}
      />
      
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
          setNewCustomerBillingAddress('')
          setUseSameAsFirstLocation(true)
          setLocations([])
          setScheduledDate(undefined)
          setTechnicianId('')
          setNotes('')
          setCreatedOrderId(null)
          setCreatedInvoiceId(null)
          setCreateProforma(false)
          setProformaPaymentAccountId('')
          setProformaNotes('')
          setProformaError(null)
        }}
        orderId={createdOrderId}
        invoiceId={createdInvoiceId}
        proformaError={proformaError}
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
      
      <EditBillingAddressModal
        open={showEditBillingModal}
        onClose={() => setShowEditBillingModal(false)}
        customer={customer}
        locations={locations}
        onUpdate={(newAddress) => {
          if (customer) {
            setCustomer({
              ...customer,
              billing_address: newAddress
            })
            toast({
              title: 'Success',
              description: 'Billing address updated successfully'
            })
          }
        }}
      />
    </div>
  )
}

// Validation Alert Modal Component
function ValidationAlertModal({
  open,
  onClose,
  errors
}: {
  open: boolean
  onClose: () => void
  errors: string[]
}) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md border-0 shadow-2xl">
        {/* Header dengan background gradient */}
        <div className="bg-gradient-to-r from-red-50 to-red-100 -m-6 mb-0 p-6 rounded-t-lg border-b border-red-200">
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div className="bg-red-100 p-2 rounded-full">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <div className="flex-1">
                <DialogTitle className="text-xl font-bold text-red-900">
                  Validation Error
                </DialogTitle>
                <DialogDescription className="text-red-700 mt-1">
                  Please fix the following issues to continue
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* Error List */}
        <div className="space-y-2 py-4">
          {errors.map((error, idx) => (
            <div 
              key={idx} 
              className="flex gap-3 p-3 bg-gradient-to-r from-red-50 to-orange-50 rounded-lg border border-red-200 hover:border-red-300 hover:shadow-sm transition-all"
            >
              <span className="text-red-500 flex-shrink-0 mt-0.5">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </span>
              <span className="text-sm font-medium text-red-800 flex-1">{error}</span>
            </div>
          ))}
        </div>

        {/* Action Footer */}
        <DialogFooter className="mt-6 pt-4 border-t border-red-100">
          <Button 
            onClick={onClose} 
            className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-semibold shadow-md hover:shadow-lg transition-all"
          >
            Got it, Let me fix this
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
  notes,
  totalPrice
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  customer: unknown
  isNewCustomer: boolean
  newCustomerName: string
  newCustomerEmail: string
  phoneInput: string
  locations: LocationFormData[]
  scheduledDate: Date | undefined
  technicianId: string
  technicians: unknown[]
  notes: string
  totalPrice: number
}) {
  const selectedTech = technicians.find((t: unknown) => (t as Record<string, unknown>).technician_id === technicianId) as Record<string, unknown> | undefined

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
                <p className="font-medium">{isNewCustomer ? newCustomerName : (customer as Record<string, unknown>)?.customer_name as string}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Phone:</span>
                <p className="font-medium">{phoneInput}</p>
              </div>
              {(isNewCustomer ? newCustomerEmail : (customer as Record<string, unknown>)?.email as string) && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">Email:</span>
                  <p className="font-medium">{isNewCustomer ? newCustomerEmail : (customer as Record<string, unknown>)?.email as string}</p>
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
                <p className="font-medium">{selectedTech ? selectedTech.full_name as string : 'Not assigned'}</p>
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
                  {loc.location_id ? `${loc.full_address}, ${loc.city}` : `New Location: ${loc.full_address || 'Unnamed'}`}
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
  invoiceId,
  proformaError,
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
  invoiceId: string | null
  proformaError: string | null
  customer: unknown
  isNewCustomer: boolean
  newCustomerName: string
  phoneInput: string
  scheduledDate: Date | undefined
  technicianId: string
  technicians: unknown[]
  totalPrice: number
  serviceCount: number
}) {
  const { toast } = useToast()
  const [isDownloading, setIsDownloading] = useState(false)
  const selectedTech = technicians.find((t: unknown) => (t as Record<string, unknown>).technician_id === technicianId) as Record<string, unknown> | undefined

  const handleDownloadProforma = async () => {
    if (!invoiceId) return
    setIsDownloading(true)
    try {
      const [invoiceData, config] = await Promise.all([
        getInvoiceById(invoiceId),
        getInvoiceConfig(),
      ])
      if (!invoiceData) throw new Error('Invoice not found')

      exportInvoiceToPDF({
        invoice: invoiceData.invoice,
        items: invoiceData.items,
        payments: invoiceData.payments,
        invoiceConfig: config,
        orderItemsDetailed: invoiceData.orderItemsDetailed,
      })

      toast({
        title: 'Downloaded',
        description: 'Proforma PDF exported',
      })
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Download Failed',
        description: err instanceof Error ? err.message : 'Failed to export proforma',
      })
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
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
          
          <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-3 text-sm">
            <span className="text-muted-foreground">Customer:</span>
            <span className="text-right font-medium truncate">{isNewCustomer ? newCustomerName : (customer as Record<string, unknown>)?.customer_name as string}</span>
            <span className="text-muted-foreground">Phone:</span>
            <span className="text-right font-medium truncate">{formatPhone(phoneInput)}</span>
            <span className="text-muted-foreground">Visit Date:</span>
            <span className="text-right font-medium truncate">{scheduledDate ? format(scheduledDate, 'dd MMM yyyy') : '-'}</span>
            {selectedTech && (
              <>
                <span className="text-muted-foreground">Technician:</span>
                <span className="text-right font-medium truncate">{selectedTech.full_name as string}</span>
              </>
            )}
            <span className="text-muted-foreground">Services:</span>
            <span className="text-right font-medium truncate">{serviceCount} service(s)</span>
            <div className="col-span-2"><Separator /></div>
            <span className="text-base font-bold">Estimated Total:</span>
            <span className="text-right text-base font-bold text-green-600">Rp {totalPrice.toLocaleString('id-ID')}</span>
          </div>

          {/* Proforma status */}
          {invoiceId && (
            <Alert className="bg-blue-50 border-blue-200">
              <FileText className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-900">
                Proforma invoice created. Download the PDF below.
              </AlertDescription>
            </Alert>
          )}
          {proformaError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Order created, but proforma failed: {proformaError}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="sm:justify-center gap-2">
          <Button variant="outline" onClick={onClose}>
            Create Another Order
          </Button>
          {invoiceId && (
            <Button
              onClick={handleDownloadProforma}
              disabled={isDownloading}
              variant="outline"
              className="border-blue-600 text-blue-700 hover:bg-blue-50"
            >
              {isDownloading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <FileText className="w-4 h-4 mr-2" />
              )}
              Download Proforma PDF
            </Button>
          )}
          {/* Manual create invoice link — only when no proforma was auto-created and tech assigned */}
          {!invoiceId && technicianId && (
            <Button onClick={() => {
              onClose()
              window.location.href = `/dashboard/keuangan/invoices/create?order_id=${orderId}&type=PROFORMA`
            }} variant="outline">
              <FileText className="w-4 h-4 mr-2" />
              Create Invoice Proforma
            </Button>
          )}
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

// Edit Billing Address Modal Component
function EditBillingAddressModal({
  open,
  onClose,
  customer,
  locations,
  onUpdate
}: {
  open: boolean
  onClose: () => void
  customer: unknown
  locations: LocationFormData[]
  onUpdate: (newAddress: string) => void
}) {
  const [mode, setMode] = useState<'manual' | 'select'>('manual')
  const [manualAddress, setManualAddress] = useState('')
  const [selectedLocationIndex, setSelectedLocationIndex] = useState<number | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const { toast } = useToast()

  // Reset state when modal opens
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setManualAddress((customer as Record<string, unknown>)?.billing_address as string || '')
      setMode('manual')
      setSelectedLocationIndex(null)
    } else {
      onClose()
    }
  }

  const handleSave = async () => {
    if (!(customer as Record<string, unknown>)?.customer_id) return

    let newAddress = ''
    
    if (mode === 'manual') {
      newAddress = manualAddress.trim()
    } else if (mode === 'select' && selectedLocationIndex !== null) {
      const loc = locations[selectedLocationIndex]
      if (loc) {
        const parts = []
        if (loc.full_address) parts.push(loc.full_address)
        if (loc.house_number) parts.push(`House ${loc.house_number}`)
        if (loc.city) parts.push(loc.city)
        if (loc.landmarks) parts.push(loc.landmarks)
        newAddress = parts.join(', ')
      }
    }

    if (!newAddress) {
      toast({
        title: 'Error',
        description: 'Please enter a billing address',
        variant: 'destructive'
      })
      return
    }

    setIsSaving(true)
    try {
      const result = await updateCustomer((customer as Record<string, unknown>).customer_id as string, {
        billing_address: newAddress
      })

      if (result.success) {
        onUpdate(newAddress)
        onClose()
      } else {
        throw new Error(result.error || 'Failed to update')
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update billing address',
        variant: 'destructive'
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit2 className="w-5 h-5" />
            Edit Billing Address
          </DialogTitle>
          <DialogDescription>
            Update the billing address for {(customer as Record<string, unknown>)?.customer_name as string}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Mode Selection */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant={mode === 'manual' ? 'default' : 'outline'}
              onClick={() => setMode('manual')}
              className="flex-1"
            >
              <Edit2 className="w-4 h-4 mr-2" />
              Enter Manually
            </Button>
            <Button
              type="button"
              variant={mode === 'select' ? 'default' : 'outline'}
              onClick={() => setMode('select')}
              className="flex-1"
              disabled={locations.length === 0}
            >
              <MapPin className="w-4 h-4 mr-2" />
              Select from Locations
            </Button>
          </div>

          {/* Manual Input Mode */}
          {mode === 'manual' && (
            <div className="space-y-2">
              <Label>Billing Address</Label>
              <Textarea
                placeholder="Enter complete billing address..."
                value={manualAddress}
                onChange={(e) => setManualAddress(e.target.value)}
                rows={4}
              />
            </div>
          )}

          {/* Select from Locations Mode */}
          {mode === 'select' && (
            <div className="space-y-2">
              <Label>Select Location</Label>
              {locations.length === 0 ? (
                <Alert>
                  <AlertDescription>No locations available. Add a location first or switch to manual entry.</AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg p-2">
                  {locations.map((loc, idx) => {
                    const addressPreview = [
                      loc.full_address,
                      loc.house_number && `House ${loc.house_number}`,
                      loc.city && `City: ${loc.city}`,
                      loc.landmarks
                    ].filter(Boolean).join(', ')

                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSelectedLocationIndex(idx)}
                        className={cn(
                          'w-full text-left p-3 border rounded-lg transition-colors',
                          selectedLocationIndex === idx
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'hover:bg-muted'
                        )}
                      >
                        <div className="flex items-start gap-2">
                          <Building2 className="w-4 h-4 mt-0.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium">Location {idx + 1}</p>
                            <p className="text-sm opacity-90 truncate">{addressPreview || 'Incomplete location'}</p>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Preview */}
          {((mode === 'manual' && manualAddress) || (mode === 'select' && selectedLocationIndex !== null)) && (
            <div className="border rounded-lg p-3 bg-muted/30">
              <Label className="text-xs text-muted-foreground">Preview:</Label>
              <p className="text-sm mt-1">
                {mode === 'manual' 
                  ? manualAddress
                  : selectedLocationIndex !== null && locations[selectedLocationIndex]
                    ? [
                        locations[selectedLocationIndex].full_address,
                        locations[selectedLocationIndex].house_number && `${locations[selectedLocationIndex].house_number}`,
                        locations[selectedLocationIndex].city && `${locations[selectedLocationIndex].city}`,
                        locations[selectedLocationIndex].landmarks && `Landmark: ${locations[selectedLocationIndex].landmarks}`
                      ].filter(Boolean).join(', ')
                    : ''
                }
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
