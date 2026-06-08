'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import {
  AlertTriangle,
  Building2,
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Loader2,
  MapPin,
  Package,
  Plus,
  User,
  Wrench,
  X,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Calendar } from '@/components/ui/calendar'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { LoadingOverlay } from '@/components/ui/loading-state'
import { MultiSelectDropdown } from '@/components/ui/multi-select-dropdown'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

import {
  searchCustomers,
  getCustomerWithLocationsById,
  createCustomer as createCustomerAction,
  createLocation as createLocationAction,
  createOrderWithItems,
  getOrderConfigMasterData,
  getServiceTypesForCatalog,
  getTechnicians,
} from '@/lib/actions/create-order'
import { createProformaInvoice } from '@/lib/actions/invoices'
import { normalizeOrderServiceType } from '@/lib/service-types'
import type { CustomerSearchResult } from '@/types/create-order'

// ---------------------------------------------------------------------------
// Types & helpers
// ---------------------------------------------------------------------------

type CustomerSuggestion = {
  customer_id: string
  customer_name: string
  phone_number: string
  email: string | null
}

type LocationLite = NonNullable<CustomerSearchResult['locations']>[number]
type AcUnitLite = NonNullable<LocationLite['ac_units']>[number]

type SelectedAcLine = {
  // unique row id within the order
  line_id: string
  unit_instance_id: string
  location_id: string
  ac_unit_id: string
  // For UI display
  ac_label: string
  location_label: string
  // Service selection
  service_type_id: string
  service_type_code: string
  service_name: string
  estimated_price: number
  manual_price: boolean
  description?: string
  quantity: number
  // Service config matching fields
  unit_type_id?: string
  capacity_id?: string
  catalog_id?: string
  msn_code?: string
}

const idrFmt = (n: number) => `Rp ${n.toLocaleString('id-ID')}`

const formatLocationLabel = (loc: Pick<LocationLite, 'full_address' | 'house_number' | 'city'>) => {
  const parts = [loc.full_address, loc.house_number ? `No ${loc.house_number}` : null, loc.city]
    .filter(Boolean)
  return parts.join(', ')
}

const formatAcLabel = (ac: AcUnitLite) =>
  [ac.brand, ac.model_number, ac.serial_number ? `(${ac.serial_number})` : null]
    .filter(Boolean)
    .join(' ')

// ---------------------------------------------------------------------------
// Inline forms (sub-forms via react-hook-form)
// ---------------------------------------------------------------------------

const newCustomerSchema = z.object({
  customer_name: z.string().min(2, 'Nama minimal 2 karakter'),
  primary_contact_person: z.string().optional(),
  phone_number: z
    .string()
    .min(8, 'Nomor telepon minimal 8 digit')
    .regex(/^[0-9+]+$/, 'Hanya angka dan +'),
  email: z.string().email('Email tidak valid').optional().or(z.literal('')),
  billing_address: z.string().optional(),
})
type NewCustomerInput = z.infer<typeof newCustomerSchema>

function NewCustomerForm({
  onCreated,
  onCancel,
}: {
  onCreated: (customer: CustomerSearchResult) => void
  onCancel: () => void
}) {
  const { toast } = useToast()
  const [submitting, setSubmitting] = useState(false)
  const form = useForm<NewCustomerInput>({
    resolver: zodResolver(newCustomerSchema),
    defaultValues: {
      customer_name: '',
      primary_contact_person: '',
      phone_number: '',
      email: '',
      billing_address: '',
    },
  })

  const onSubmit = async (values: NewCustomerInput) => {
    setSubmitting(true)
    try {
      const res = await createCustomerAction({
        customer_name: values.customer_name,
        phone_number: values.phone_number,
        email: values.email || undefined,
        primary_contact_person: values.primary_contact_person || values.customer_name,
        billing_address: values.billing_address || undefined,
      })
      if (!res.success || !res.data) {
        toast({
          title: 'Gagal membuat customer',
          description: res.error || 'Terjadi kesalahan',
          variant: 'destructive',
        })
        return
      }
      const detail = await getCustomerWithLocationsById(res.data.customer_id)
      if (!detail.success || !detail.data) {
        toast({ title: 'Customer dibuat tapi gagal memuat data', variant: 'destructive' })
        return
      }
      toast({ title: 'Customer baru tersimpan' })
      onCreated(detail.data)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3 rounded-md border bg-muted/30 p-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <Label>Nama Customer *</Label>
          <Input {...form.register('customer_name')} placeholder="PT. Sumber Sejahtera" />
          {form.formState.errors.customer_name && (
            <p className="mt-1 text-xs text-destructive">{form.formState.errors.customer_name.message}</p>
          )}
        </div>
        <div>
          <Label>Kontak Person</Label>
          <Input {...form.register('primary_contact_person')} placeholder="Pak Budi" />
        </div>
        <div>
          <Label>Nomor Telepon *</Label>
          <Input {...form.register('phone_number')} placeholder="6281234567890" />
          {form.formState.errors.phone_number && (
            <p className="mt-1 text-xs text-destructive">{form.formState.errors.phone_number.message}</p>
          )}
        </div>
        <div>
          <Label>Email</Label>
          <Input {...form.register('email')} placeholder="customer@example.com" />
          {form.formState.errors.email && (
            <p className="mt-1 text-xs text-destructive">{form.formState.errors.email.message}</p>
          )}
        </div>
        <div className="md:col-span-2">
          <Label>Alamat Billing</Label>
          <Textarea
            rows={2}
            {...form.register('billing_address')}
            placeholder="Alamat untuk penagihan / invoice"
          />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
          Batal
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Simpan Customer
        </Button>
      </div>
    </form>
  )
}

const newLocationSchema = z.object({
  full_address: z.string().min(3, 'Alamat minimal 3 karakter'),
  house_number: z.string().optional(),
  city: z.string().optional(),
  landmarks: z.string().optional(),
})
type NewLocationInput = z.infer<typeof newLocationSchema>

function NewLocationForm({
  customerId,
  onCreated,
  onCancel,
}: {
  customerId: string
  onCreated: (loc: LocationLite) => void
  onCancel: () => void
}) {
  const { toast } = useToast()
  const [submitting, setSubmitting] = useState(false)
  const form = useForm<NewLocationInput>({
    resolver: zodResolver(newLocationSchema),
    defaultValues: { full_address: '', house_number: '', city: '', landmarks: '' },
  })

  const onSubmit = async (values: NewLocationInput) => {
    setSubmitting(true)
    try {
      const res = await createLocationAction({
        customer_id: customerId,
        full_address: values.full_address,
        house_number: values.house_number || undefined,
        city: values.city || undefined,
        landmarks: values.landmarks || undefined,
      })
      if (!res.success || !res.data) {
        toast({
          title: 'Gagal membuat lokasi',
          description: res.error || 'Terjadi kesalahan',
          variant: 'destructive',
        })
        return
      }
      const newLoc: LocationLite = {
        location_id: res.data.location_id,
        full_address: values.full_address,
        house_number: values.house_number || '',
        city: values.city || '',
        landmarks: values.landmarks || null,
        ac_units: [],
      }
      toast({ title: 'Lokasi baru tersimpan' })
      onCreated(newLoc)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3 rounded-md border bg-muted/30 p-4">
      <div>
        <Label>Alamat Lengkap *</Label>
        <Input {...form.register('full_address')} placeholder="Jl. Mawar No. 123" />
        {form.formState.errors.full_address && (
          <p className="mt-1 text-xs text-destructive">{form.formState.errors.full_address.message}</p>
        )}
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <Label>Nomor / Blok</Label>
          <Input {...form.register('house_number')} placeholder="12A / Blok B" />
        </div>
        <div>
          <Label>Kota</Label>
          <Input {...form.register('city')} placeholder="Jakarta" />
        </div>
      </div>
      <div>
        <Label>Patokan</Label>
        <Input {...form.register('landmarks')} placeholder="Dekat indomaret" />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
          Batal
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Simpan Lokasi
        </Button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function NewOrderAccordionPage() {
  const router = useRouter()
  const { toast } = useToast()

  // Accordion state
  const [openSection, setOpenSection] = useState<string>('section-customer')

  // Section 1: Customer
  const [customer, setCustomer] = useState<CustomerSearchResult | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false)

  // Section 2: Locations & AC selection
  // Map<location_id, Set<ac_unit_id>>
  const [selectedAcs, setSelectedAcs] = useState<Record<string, string[]>>({})
  const [showNewLocationForm, setShowNewLocationForm] = useState(false)

  // Section 3: Service items derived from selected ACs + new AC placeholders
  const [serviceLines, setServiceLines] = useState<SelectedAcLine[]>([])
  const [newAcCounter, setNewAcCounter] = useState(0)
  // Per-line filtered service types from service_catalog for (unit_type, capacity) combo
  const [lineServiceTypes, setLineServiceTypes] = useState<Record<string, Array<Record<string, unknown>>>>({})
  const [lineServiceTypesLoading, setLineServiceTypesLoading] = useState<Record<string, boolean>>({})
  const [lineCatalogMissing, setLineCatalogMissing] = useState<Record<string, boolean>>({})

  // Section 4: Schedule & assignment
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>()
  const [skipAssignment, setSkipAssignment] = useState(true)
  const [leadTechnicianId, setLeadTechnicianId] = useState<string>('')
  const [helperTechnicianIds, setHelperTechnicianIds] = useState<string[]>([])

  const [today, setToday] = useState<Date | undefined>()
  useEffect(() => {
    setToday(new Date(new Date().setHours(0, 0, 0, 0)))
  }, [])
  const [orderNotes, setOrderNotes] = useState('')

  // Section 5: Submit
  const [createProforma, setCreateProforma] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // ---------------------------------------------------------------------
  // Data queries
  // ---------------------------------------------------------------------
  const { data: masterData } = useQuery({
    queryKey: ['order-config-master-data'],
    queryFn: async () => {
      const res = await getOrderConfigMasterData()
      if (!res.success || !res.data) throw new Error(res.error || 'Gagal memuat master data')
      return res.data
    },
    staleTime: 5 * 60 * 1000,
  })

  const { data: technicians } = useQuery({
    queryKey: ['technicians'],
    queryFn: async () => {
      const res = await getTechnicians()
      if (!res.success || !res.data) return []
      return res.data
    },
    staleTime: 5 * 60 * 1000,
  })

  // Customer suggestions from search query (debounced)
  const [customerSuggestions, setCustomerSuggestions] = useState<CustomerSuggestion[]>([])
  const [searchingCustomers, setSearchingCustomers] = useState(false)
  useEffect(() => {
    const q = searchQuery.trim()
    if (q.length < 2) {
      setCustomerSuggestions([])
      return
    }
    const timer = setTimeout(async () => {
      setSearchingCustomers(true)
      try {
        const res = await searchCustomers(q)
        if (res.success && res.data) setCustomerSuggestions(res.data)
      } finally {
        setSearchingCustomers(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // ---------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------
  const handlePickCustomerSuggestion = async (suggestion: CustomerSuggestion) => {
    const res = await getCustomerWithLocationsById(suggestion.customer_id)
    if (!res.success || !res.data) {
      toast({
        title: 'Gagal memuat customer',
        description: res.error || '',
        variant: 'destructive',
      })
      return
    }
    setCustomer(res.data)
    setSearchQuery('')
    setCustomerSuggestions([])
    setShowNewCustomerForm(false)
    setSelectedAcs({})
    setServiceLines([])
    setOpenSection('section-locations')
  }

  const handleCustomerCreated = (newCustomer: CustomerSearchResult) => {
    setCustomer(newCustomer)
    setShowNewCustomerForm(false)
    setSelectedAcs({})
    setServiceLines([])
    setOpenSection('section-locations')
  }

  const handleLocationCreated = (newLoc: LocationLite) => {
    if (!customer) return
    setCustomer({
      ...customer,
      locations: [...(customer.locations || []), newLoc],
    })
    setShowNewLocationForm(false)
  }

  // Toggle AC unit selection
  const toggleAc = (locationId: string, acUnitId: string) => {
    const exists = serviceLines.some((l) => l.location_id === locationId && l.ac_unit_id === acUnitId)

    setSelectedAcs((prev) => {
      const current = prev[locationId] || []
      const isCurrentlySelected = current.includes(acUnitId)
      const next = isCurrentlySelected ? current.filter((id) => id !== acUnitId) : [...current, acUnitId]
      const out = { ...prev, [locationId]: next }
      if (next.length === 0) delete out[locationId]
      return out
    })

    if (exists) {
      // Remove service lines for this AC
      setServiceLines((prev) => prev.filter((l) => !(l.location_id === locationId && l.ac_unit_id === acUnitId)))
    } else {
      // Add service line for this AC
      const loc = customer?.locations?.find((l) => l.location_id === locationId)
      const ac = loc?.ac_units?.find((a) => a.ac_unit_id === acUnitId)
      if (loc && ac) {
        const newLineId = `${locationId}:${acUnitId}:${Date.now()}`
        
        // Auto-load available service types immediately on selection if config exists
        if (ac.unit_type_id && ac.capacity_id) {
          void fetchServiceTypesForLine(newLineId, ac.unit_type_id, ac.capacity_id)
        }
        
        setServiceLines((prev) => [
          ...prev,
          {
            line_id: newLineId,
            unit_instance_id: acUnitId,
            location_id: locationId,
            ac_unit_id: acUnitId,
            location_label: formatLocationLabel(loc),
            ac_label: formatAcLabel(ac),
            service_type_id: '',
            service_type_code: '',
            service_name: '',
            estimated_price: 0,
            manual_price: false,
            description: '',
            quantity: 1,
            unit_type_id: ac.unit_type_id || '',
            capacity_id: ac.capacity_id || '',
          },
        ])
      }
    }
  }

  // Add a placeholder AC line for a new AC (details filled by technician)
  const addNewAcLine = (locationId: string) => {
    setNewAcCounter((c) => c + 1)
    const loc = customer?.locations?.find((l) => l.location_id === locationId)
    if (!loc) return
    const now = Date.now()
    const newAcTempId = `new-ac-${locationId}-${now}-${newAcCounter}`
    const lineId = `${locationId}:__new__:${now}:${newAcCounter}`
    
    // Count how many new ACs are already added for this location
    const uniqueNewAcs = Array.from(new Set(
      serviceLines.flatMap((l) =>
        l.location_id === locationId && l.ac_unit_id === '__new__' ? [l.unit_instance_id] : []
      )
    ))
    const count = uniqueNewAcs.length

    setServiceLines((prev) => [
      ...prev,
      {
        line_id: lineId,
        unit_instance_id: newAcTempId,
        location_id: locationId,
        ac_unit_id: '__new__',
        location_label: formatLocationLabel(loc),
        ac_label: `AC Baru #${count + 1}`,
        service_type_id: '',
        service_type_code: '',
        service_name: '',
        estimated_price: 0,
        manual_price: false,
        description: '',
        quantity: 1,
        unit_type_id: '',
        capacity_id: '',
      },
    ])
  }

  // Fetch service types available in service_catalog for a given (unit_type, capacity) combo
  const fetchServiceTypesForLine = async (
    lineId: string,
    unitTypeId: string,
    capacityId: string
  ) => {
    if (!unitTypeId || !capacityId) {
      setLineServiceTypes((prev) => ({ ...prev, [lineId]: [] }))
      setLineCatalogMissing((prev) => ({ ...prev, [lineId]: false }))
      return
    }
    setLineServiceTypesLoading((prev) => ({ ...prev, [lineId]: true }))
    try {
      const res = await getServiceTypesForCatalog(unitTypeId, capacityId)
      if (res.success) {
        setLineServiceTypes((prev) => ({ ...prev, [lineId]: (res.data || []) as Array<Record<string, unknown>> }))
        setLineCatalogMissing((prev) => ({ ...prev, [lineId]: (res.data || []).length === 0 }))
      } else {
        setLineServiceTypes((prev) => ({ ...prev, [lineId]: [] }))
        setLineCatalogMissing((prev) => ({ ...prev, [lineId]: true }))
      }
    } finally {
      setLineServiceTypesLoading((prev) => ({ ...prev, [lineId]: false }))
    }
  }

  // When a service is picked or details change, dynamically compute the catalog price
  const updateServiceLine = (lineId: string, patch: Partial<SelectedAcLine>) => {
    let nextUnitType = ''
    let nextCapacity = ''
    let configChanged = false
    let noCatalogMatch = false

    let updatedLines: SelectedAcLine[] = []
    setServiceLines((prev) => {
      updatedLines = prev.map((l) => {
        if (l.line_id !== lineId) return l

        const updated = { ...l, ...patch }
        nextUnitType = updated.unit_type_id || ''
        nextCapacity = updated.capacity_id || ''

        // If config changed (unit type, capacity, or service type), recalculate price if not manually locked
        const isConfigChanging =
          'unit_type_id' in patch || 'capacity_id' in patch || 'service_type_id' in patch
        configChanged = isConfigChanging
        const shouldRecalculate = isConfigChanging && !updated.manual_price

        if (shouldRecalculate) {
          let price = 0
          let catalogId = ''
          let msnCode = ''
          let matchFound = false

          if (updated.service_type_id && updated.unit_type_id && updated.capacity_id) {
            const catalog = (masterData?.serviceCatalog || []) as Array<Record<string, unknown>>
            const match = catalog.find(
              (c) =>
                c.is_active !== false &&
                c.service_type_id === updated.service_type_id &&
                c.unit_type_id === updated.unit_type_id &&
                c.capacity_id === updated.capacity_id
            )
            if (match) {
              price = Number(match.base_price) || 0
              catalogId = (match.catalog_id as string) || ''
              msnCode = (match.msn_code as string) || ''
              matchFound = true
            }
          }

          updated.estimated_price = price
          updated.catalog_id = catalogId
          updated.msn_code = msnCode

          // Mark catalog as missing if all 3 keys set but no active match
          noCatalogMatch =
            !!updated.service_type_id && !!updated.unit_type_id && !!updated.capacity_id && !matchFound
        }

        return updated
      })
      return updatedLines
    })

    // Sync catalog-missing flag for this line
    if (configChanged) {
      setLineCatalogMissing((prev) => ({ ...prev, [lineId]: noCatalogMatch }))
    }

    // Refetch cascading service types when unit_type or capacity changes
    if ('unit_type_id' in patch || 'capacity_id' in patch) {
      void fetchServiceTypesForLine(lineId, nextUnitType, nextCapacity)
    }
  }

  // When unit type/capacity changes, update all lines in the group
  const updateServiceLineForGroup = (unitInstanceId: string, patch: Partial<SelectedAcLine>) => {
    const nextUnitType = patch.unit_type_id || ''
    const nextCapacity = patch.capacity_id || ''
    const configChanged = 'unit_type_id' in patch || 'capacity_id' in patch

    // Update the service lines state
    let updatedLines: SelectedAcLine[] = []
    setServiceLines((prev) => {
      updatedLines = prev.map((l) => {
        if (l.unit_instance_id !== unitInstanceId) return l

        const updated = { ...l, ...patch }

        // Recalculate price if config changed and not manual price
        if (configChanged && !updated.manual_price) {
          let price = 0
          let catalogId = ''
          let msnCode = ''

          if (updated.service_type_id && nextUnitType && nextCapacity) {
            const catalog = (masterData?.serviceCatalog || []) as Array<Record<string, unknown>>
            const match = catalog.find(
              (c) =>
                c.is_active !== false &&
                c.service_type_id === updated.service_type_id &&
                c.unit_type_id === nextUnitType &&
                c.capacity_id === nextCapacity
            )
            if (match) {
              price = Number(match.base_price) || 0
              catalogId = (match.catalog_id as string) || ''
              msnCode = (match.msn_code as string) || ''
            }
          }

          updated.estimated_price = price
          updated.catalog_id = catalogId
          updated.msn_code = msnCode
        }

        return updated
      })
      return updatedLines
    })

    // Perform side effects outside the state updater callback using computed lines
    if (configChanged) {
      // Find the updated group lines in our freshly calculated updatedLines
      const linesInGroup = updatedLines.filter((l) => l.unit_instance_id === unitInstanceId)
      
      linesInGroup.forEach((l) => {
        let matchFound = false
        if (l.service_type_id && nextUnitType && nextCapacity) {
          const catalog = (masterData?.serviceCatalog || []) as Array<Record<string, unknown>>
          matchFound = catalog.some(
            (c) =>
              c.is_active !== false &&
              c.service_type_id === l.service_type_id &&
              c.unit_type_id === nextUnitType &&
              c.capacity_id === nextCapacity
          )
        }
        const noCatalogMatch = !!l.service_type_id && !!nextUnitType && !!nextCapacity && !matchFound
        
        setLineCatalogMissing((prev) => ({ ...prev, [l.line_id]: noCatalogMatch }))
        void fetchServiceTypesForLine(l.line_id, nextUnitType, nextCapacity)
      })
    }
  }

  const addServiceLineToGroup = (unitInstanceId: string) => {
    const groupLines = serviceLines.filter((l) => l.unit_instance_id === unitInstanceId)
    if (groupLines.length === 0) return
    const firstLine = groupLines[0]
    
    const newLineId = `${firstLine.location_id}:${firstLine.ac_unit_id}:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`
    
    // Call fetchServiceTypesForLine if group already has unit type & capacity
    if (firstLine.unit_type_id && firstLine.capacity_id) {
      void fetchServiceTypesForLine(newLineId, firstLine.unit_type_id, firstLine.capacity_id)
    }

    setServiceLines((prev) => [
      ...prev,
      {
        line_id: newLineId,
        unit_instance_id: unitInstanceId,
        location_id: firstLine.location_id,
        ac_unit_id: firstLine.ac_unit_id,
        location_label: firstLine.location_label,
        ac_label: firstLine.ac_label,
        service_type_id: '',
        service_type_code: '',
        service_name: '',
        estimated_price: 0,
        manual_price: false,
        description: '',
        quantity: 1,
        unit_type_id: firstLine.unit_type_id || '',
        capacity_id: firstLine.capacity_id || '',
      },
    ])
  }

  const deleteServiceLine = (lineId: string) => {
    const lineToRemove = serviceLines.find((l) => l.line_id === lineId)
    if (!lineToRemove) return

    const remainingInGroup = serviceLines.filter(
      (l) => l.unit_instance_id === lineToRemove.unit_instance_id && l.line_id !== lineId
    )

    // If no lines remain in the group, we deselect the AC unit in Section 2
    if (remainingInGroup.length === 0) {
      const locationId = lineToRemove.location_id
      const acUnitId = lineToRemove.ac_unit_id
      
      setSelectedAcs((prevSelected) => {
        const current = prevSelected[locationId] || []
        const next = current.filter((id) => id !== acUnitId)
        const out = { ...prevSelected, [locationId]: next }
        if (next.length === 0) delete out[locationId]
        return out
      })
    }

    setServiceLines((prev) => prev.filter((l) => l.line_id !== lineId))
  }

  const pickServiceForLine = (lineId: string, serviceTypeId: string) => {
    const serviceTypes = (masterData?.serviceTypes || []) as Array<Record<string, unknown>>
    const st = serviceTypes.find((s) => s.service_type_id === serviceTypeId)
    if (!st) return

    const code = String(st.code || '')
    const name = String(st.name || code)

    updateServiceLine(lineId, {
      service_type_id: serviceTypeId,
      service_type_code: code,
      service_name: name,
    })
  }

  const uniqueUnitInstanceIds = useMemo(() => {
    const ids: string[] = []
    serviceLines.forEach((line) => {
      if (!ids.includes(line.unit_instance_id)) {
        ids.push(line.unit_instance_id)
      }
    })
    return ids
  }, [serviceLines])

  const totalEstimatedPrice = useMemo(
    () => serviceLines.reduce((sum, l) => sum + l.estimated_price * l.quantity, 0),
    [serviceLines]
  )

  // Counters for AC visibility (unique unit instances)
  const newAcCount = useMemo(() => {
    const newAcIds = new Set(
      serviceLines.flatMap((l) => (l.ac_unit_id === '__new__' ? [l.unit_instance_id] : []))
    )
    return newAcIds.size
  }, [serviceLines])

  const existingAcCount = useMemo(() => {
    const existingAcIds = new Set(
      serviceLines.flatMap((l) => (l.ac_unit_id !== '__new__' ? [l.unit_instance_id] : []))
    )
    return existingAcIds.size
  }, [serviceLines])

  // ---------------------------------------------------------------------
  // Section validation
  // ---------------------------------------------------------------------
  const isCustomerFilled = !!customer
  const isLocationsFilled = serviceLines.length > 0
  const isServicesFilled =
    serviceLines.length > 0 &&
    serviceLines.every((l) => !!l.service_type_id && !!l.unit_type_id && !!l.capacity_id)
  const isScheduleFilled = !!scheduledDate && (skipAssignment || !!leadTechnicianId)
  const completedSections = [isCustomerFilled, isLocationsFilled, isServicesFilled, isScheduleFilled].filter(Boolean).length
  const progressPct = (completedSections / 4) * 100

  // ---------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------
  const handleSubmit = async () => {
    if (!customer) {
      toast({ title: 'Customer belum dipilih', variant: 'destructive' })
      setOpenSection('section-customer')
      return
    }
    if (!isLocationsFilled) {
      toast({ title: 'Belum ada AC yang dipilih', variant: 'destructive' })
      setOpenSection('section-locations')
      return
    }
    if (!isServicesFilled) {
      toast({ title: 'Pilih jenis service untuk semua AC', variant: 'destructive' })
      setOpenSection('section-services')
      return
    }
    if (!scheduledDate) {
      toast({ title: 'Tentukan tanggal kunjungan', variant: 'destructive' })
      setOpenSection('section-schedule')
      return
    }
    if (!skipAssignment && !leadTechnicianId) {
      toast({
        title: 'Pilih teknisi atau klik "Assign nanti"',
        variant: 'destructive',
      })
      setOpenSection('section-schedule')
      return
    }

    setSubmitting(true)
    try {
      const items = serviceLines.map((l) => ({
        location_id: l.location_id,
        ac_unit_id: l.ac_unit_id === '__new__' ? null : l.ac_unit_id,
        new_ac_temp_id: l.ac_unit_id === '__new__' ? l.unit_instance_id : undefined,
        ...(l.ac_unit_id === '__new__' ? { new_ac_data: { brand: 'TBD', model_number: 'TBD' } } : {}),
        service_type_id: l.service_type_id,
        service_type: normalizeOrderServiceType(l.service_type_code),
        quantity: l.quantity,
        description: l.description || undefined,
        estimated_price: l.estimated_price,
        unit_type_id: l.unit_type_id || undefined,
        capacity_id: l.capacity_id || undefined,
        catalog_id: l.catalog_id || undefined,
        msn_code: l.msn_code || undefined,
      }))

      const orderRes = await createOrderWithItems({
        customer_id: customer.customer_id,
        scheduled_visit_date: format(scheduledDate, 'yyyy-MM-dd'),
        assigned_technician_id: skipAssignment ? null : leadTechnicianId || null,
        helper_technician_ids:
          !skipAssignment && helperTechnicianIds.length > 0 ? helperTechnicianIds : undefined,
        notes: orderNotes || undefined,
        items,
      })

      if (!orderRes.success || !orderRes.data) {
        throw new Error(orderRes.error || 'Gagal membuat order')
      }

      const orderId = orderRes.data.order_id

      if (createProforma) {
        const proformaRes = await createProformaInvoice(orderId)
        if (proformaRes.success && proformaRes.data) {
          toast({
            title: 'Order dan Proforma berhasil dibuat',
            description: `Invoice ${proformaRes.data.invoice_number}`,
          })
          router.push(
            `/dashboard/keuangan/invoices/${proformaRes.data.invoice_id}?proforma=true`
          )
          return
        }
        toast({
          title: 'Order dibuat, tapi proforma gagal',
          description: proformaRes.error || 'Cek kembali konfigurasi invoice',
          variant: 'destructive',
        })
        router.push('/dashboard/orders')
        return
      }

      toast({ title: 'Order berhasil dibuat' })
      router.push('/dashboard/orders')
    } catch (err) {
      toast({
        title: 'Gagal membuat order',
        description: err instanceof Error ? err.message : 'Terjadi kesalahan',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  // ---------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------
  const customerLocations = customer?.locations || []

  return (
    <div className="p-4 md:p-6">
      <LoadingOverlay isLoading={submitting} message="Menyimpan order..." fullscreen autoFocus>
        <div className="mb-4 sm:mb-6 space-y-3">
          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Link
              href="/dashboard/orders"
              className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
            >
              <ClipboardList className="h-3.5 w-3.5" />
              Orders
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground font-medium">Buat Order Baru</span>
          </nav>

          {/* Title + progress */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-xl font-bold sm:text-2xl md:text-3xl tracking-tight">Buat Order Baru</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Isi setiap section secara berurutan. Section yang sudah lengkap akan menampilkan ringkasan.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground tabular-nums">
                {completedSections}/4 section
              </span>
              <div
                className="h-1.5 w-24 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuenow={completedSections}
                aria-valuemin={0}
                aria-valuemax={4}
                aria-label="Progres pengisian order"
              >
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <Accordion
          type="single"
          collapsible
          value={openSection}
          onValueChange={(v) => setOpenSection(v || '')}
          className="space-y-3"
        >
          {/* ==============================================================
              SECTION 1: CUSTOMER
              ============================================================== */}
          <AccordionItem value="section-customer" className="rounded-md border bg-card px-3 sm:px-4">
            <AccordionTrigger className="hover:no-underline">
              <SectionHeader
                icon={<User className="h-5 w-5" />}
                step={1}
                title="Customer"
                filled={isCustomerFilled}
                summary={
                  customer
                    ? `${customer.customer_name} • ${customer.phone_number}`
                    : 'Cari atau buat customer baru'
                }
              />
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-2">
                {customer ? (
                  <div className="rounded-md border bg-muted/30 p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold">{customer.customer_name}</p>
                        <p className="text-sm text-muted-foreground">{customer.phone_number}</p>
                        {customer.email && (
                          <p className="text-sm text-muted-foreground">{customer.email}</p>
                        )}
                        {customer.billing_address && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {customer.billing_address}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setCustomer(null)
                          setSelectedAcs({})
                          setServiceLines([])
                        }}
                      >
                        <X className="mr-1 h-4 w-4" />
                        Ganti
                      </Button>
                    </div>
                  </div>
                ) : showNewCustomerForm ? (
                  <NewCustomerForm
                    onCreated={handleCustomerCreated}
                    onCancel={() => setShowNewCustomerForm(false)}
                  />
                ) : (
                  <div className="space-y-3">
                    <div>
                      <Label>Cari Customer (nama atau nomor telepon)</Label>
                      <Command className="rounded-md border">
                        <CommandInput
                          placeholder="Ketik minimal 2 karakter..."
                          value={searchQuery}
                          onValueChange={setSearchQuery}
                        />
                        {searchQuery.length >= 2 && (
                          <CommandList>
                            {searchingCustomers ? (
                              <div className="p-3 text-sm text-muted-foreground">
                                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                                Mencari...
                              </div>
                            ) : customerSuggestions.length === 0 ? (
                              <CommandEmpty>Tidak ada customer ditemukan</CommandEmpty>
                            ) : (
                              <CommandGroup>
                                {customerSuggestions.map((c) => (
                                  <CommandItem
                                    key={c.customer_id}
                                    value={`${c.customer_name} ${c.phone_number}`}
                                    onSelect={() => handlePickCustomerSuggestion(c)}
                                  >
                                    <div className="flex flex-col">
                                      <span className="font-medium">{c.customer_name}</span>
                                      <span className="text-xs text-muted-foreground">
                                        {c.phone_number}
                                        {c.email ? ` • ${c.email}` : ''}
                                      </span>
                                    </div>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            )}
                          </CommandList>
                        )}
                      </Command>
                    </div>
                    <div className="text-center">
                      <span className="text-xs text-muted-foreground">atau</span>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => setShowNewCustomerForm(true)}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Buat Customer Baru
                    </Button>
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* ==============================================================
              SECTION 2: LOCATIONS & AC UNITS
              ============================================================== */}
          <AccordionItem
            value="section-locations"
            className={cn(
              'rounded-md border bg-card px-3 sm:px-4',
              !isCustomerFilled && 'pointer-events-none opacity-60'
            )}
          >
            <AccordionTrigger className="hover:no-underline">
              <SectionHeader
                icon={<MapPin className="h-5 w-5" />}
                step={2}
                title="Lokasi & Unit AC"
                filled={isLocationsFilled}
                summary={
                  isLocationsFilled
                    ? `${serviceLines.length} unit AC dari ${
                        new Set(serviceLines.map((l) => l.location_id)).size
                      } lokasi • ${newAcCount} baru • ${existingAcCount} existing`
                    : 'Pilih lokasi dan unit AC yang akan diservice'
                }
              />
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-2">
                {customerLocations.length === 0 && !showNewLocationForm && (
                  <Alert>
                    <AlertDescription>
                      Customer ini belum punya lokasi. Tambahkan lokasi terlebih dahulu.
                    </AlertDescription>
                  </Alert>
                )}

                {customerLocations.map((loc) => {
                  const acUnits = loc.ac_units || []
                  const selected = selectedAcs[loc.location_id] || []
                  const uniqueAddedNewAcs = serviceLines.reduce((acc, current) => {
                    if (current.location_id === loc.location_id && current.ac_unit_id === '__new__') {
                      if (!acc.some(item => item.unit_instance_id === current.unit_instance_id)) {
                        acc.push(current)
                      }
                    }
                    return acc
                  }, [] as SelectedAcLine[])
                  return (
                    <div key={loc.location_id} className="rounded-md border p-4">
                      <div className="mb-3 flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2">
                          <Building2 className="mt-0.5 h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{formatLocationLabel(loc)}</p>
                            {loc.landmarks && (
                              <p className="text-xs text-muted-foreground">{loc.landmarks}</p>
                            )}
                          </div>
                        </div>
                        {uniqueAddedNewAcs.length > 0 && (
                          <Badge variant="secondary" className="shrink-0 gap-1 bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800">
                            <Plus className="h-3 w-3" />
                            {uniqueAddedNewAcs.length} AC Baru
                          </Badge>
                        )}
                      </div>
 
                      {acUnits.length === 0 ? (
                        <div className="space-y-3">
                          <p className="text-sm italic text-muted-foreground">
                            Belum ada AC terdaftar di lokasi ini.
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => addNewAcLine(loc.location_id)}
                            className="h-9 text-xs"
                          >
                            <Plus className="mr-1.5 h-3.5 w-3.5" />
                            Tambah AC Baru
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">
                            Pilih unit AC yang akan diservice
                          </Label>
                          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                            {acUnits.map((ac) => {
                              const isSelected = selected.includes(ac.ac_unit_id)
                              return (
                                <button
                                  key={ac.ac_unit_id}
                                  type="button"
                                  onClick={() => toggleAc(loc.location_id, ac.ac_unit_id)}
                                  aria-pressed={isSelected}
                                  className={cn(
                                    'group flex items-start gap-3 rounded-lg border p-3 text-left transition-all duration-200 cursor-pointer',
                                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                                    'active:scale-[0.99]',
                                    isSelected
                                      ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                                      : 'border-border hover:border-primary/40 hover:bg-muted/40'
                                  )}
                                >
                                  <div
                                    className={cn(
                                      'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                                      isSelected
                                        ? 'border-primary bg-primary text-primary-foreground'
                                        : 'border-input bg-background group-hover:border-primary/60'
                                    )}
                                    aria-hidden="true"
                                  >
                                    {isSelected && (
                                      <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3">
                                        <path d="M3 8l3.5 3.5L13 5" strokeLinecap="round" strokeLinejoin="round" />
                                      </svg>
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0 text-sm">
                                    <p className="font-medium truncate">
                                      {ac.brand} {ac.model_number}
                                    </p>
                                    <p className="text-xs text-muted-foreground truncate">
                                      {ac.serial_number || 'Tanpa SN'}
                                      {ac.capacity_btu ? ` • ${ac.capacity_btu} BTU` : ''}
                                    </p>
                                  </div>
                                </button>
                              )
                            })}
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => addNewAcLine(loc.location_id)}
                            className="h-9 text-xs mt-2"
                          >
                            <Plus className="mr-1.5 h-3.5 w-3.5" />
                            Tambah AC Baru
                          </Button>
                        </div>
                      )}
 
                      {/* List added new ACs */}
                      {uniqueAddedNewAcs.length > 0 && (
                        <div className="mt-3 space-y-2 border-t pt-3">
                          <Label className="text-xs text-muted-foreground">AC Baru yang Ditambahkan:</Label>
                          <div className="space-y-1.5">
                            {uniqueAddedNewAcs.map((line) => (
                              <div key={line.unit_instance_id} className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-sm">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">NEW</span>
                                  <span>{line.ac_label}</span>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setServiceLines((prev) => prev.filter((l) => l.unit_instance_id !== line.unit_instance_id))
                                  }}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}

                {showNewLocationForm && customer && (
                  <NewLocationForm
                    customerId={customer.customer_id}
                    onCreated={handleLocationCreated}
                    onCancel={() => setShowNewLocationForm(false)}
                  />
                )}

                {!showNewLocationForm && (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => setShowNewLocationForm(true)}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Tambah Lokasi Baru
                  </Button>
                )}

                {isLocationsFilled && (
                  <div className="flex justify-end">
                    <Button
                      onClick={() => setOpenSection('section-services')}
                      className="h-11 w-full sm:h-9 sm:w-auto"
                    >
                      Lanjut ke Service Items
                    </Button>
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* ==============================================================
              SECTION 3: SERVICE ITEMS
              ============================================================== */}
          <AccordionItem
            value="section-services"
            className={cn(
              'rounded-md border bg-card px-3 sm:px-4',
              !isLocationsFilled && 'pointer-events-none opacity-60'
            )}
          >
            <AccordionTrigger className="hover:no-underline">
              <SectionHeader
                icon={<Wrench className="h-5 w-5" />}
                step={3}
                title="Service Items"
                filled={isServicesFilled}
                summary={
                  isServicesFilled
                    ? `${serviceLines.length} service • Total estimasi ${idrFmt(totalEstimatedPrice)}`
                    : 'Pilih jenis service untuk setiap AC'
                }
              />
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-2">
                {uniqueUnitInstanceIds.length === 0 ? (
                  <Alert>
                    <AlertDescription>
                      Pilih AC pada section sebelumnya terlebih dahulu.
                    </AlertDescription>
                  </Alert>
                ) : (
                  uniqueUnitInstanceIds.map((unitInstanceId) => {
                    const groupLines = serviceLines.filter((l) => l.unit_instance_id === unitInstanceId)
                    const firstLine = groupLines[0]
                    if (!firstLine) return null

                    return (
                      <div key={unitInstanceId} className="space-y-4 rounded-lg border p-4 shadow-sm bg-card/50">
                        {/* Group Header */}
                        <div className="flex items-start justify-between border-b pb-3">
                          <div>
                            <p className="font-semibold text-base text-primary">{firstLine.ac_label}</p>
                            <p className="text-xs text-muted-foreground">{firstLine.location_label}</p>
                          </div>
                          {firstLine.ac_unit_id === '__new__' && (
                            <Badge className="bg-blue-600 hover:bg-blue-700 text-white border-none text-[10px]">AC Baru</Badge>
                          )}
                        </div>

                        {/* Shared Specs: Tipe Unit & Kapasitas */}
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 bg-muted/20 p-3 rounded-md">
                          <div>
                            <Label className="text-xs font-semibold">Tipe Unit *</Label>
                            <Select 
                              value={firstLine.unit_type_id || ''} 
                              onValueChange={(val) => {
                                updateServiceLineForGroup(unitInstanceId, { 
                                  unit_type_id: val, 
                                  capacity_id: '', 
                                  estimated_price: 0,
                                  catalog_id: '',
                                  msn_code: '',
                                  service_type_id: ''
                                })
                              }}
                            >
                              <SelectTrigger className="h-9 bg-background">
                                <SelectValue placeholder="Pilih tipe unit..." />
                              </SelectTrigger>
                              <SelectContent>
                                {((masterData?.unitTypes || []) as Array<Record<string, unknown>>).map((ut) => (
                                  <SelectItem key={ut.unit_type_id as string} value={ut.unit_type_id as string}>
                                    {ut.name as string}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <Label className="text-xs font-semibold">Kapasitas *</Label>
                            <Select 
                              value={firstLine.capacity_id || ''} 
                              disabled={!firstLine.unit_type_id}
                              onValueChange={(val) => {
                                updateServiceLineForGroup(unitInstanceId, { 
                                  capacity_id: val, 
                                  estimated_price: 0,
                                  catalog_id: '',
                                  msn_code: '',
                                  service_type_id: ''
                                })
                              }}
                            >
                              <SelectTrigger className="h-9 bg-background">
                                <SelectValue placeholder={firstLine.unit_type_id ? "Pilih kapasitas..." : "Pilih tipe unit dulu"} />
                              </SelectTrigger>
                              <SelectContent>
                                {((masterData?.capacityRanges || []) as Array<Record<string, unknown>>).flatMap((cr) => cr.unit_type_id === firstLine.unit_type_id ? [(
                                  <SelectItem key={cr.capacity_id as string} value={cr.capacity_id as string}>
                                    {cr.capacity_label as string}
                                  </SelectItem>
                                )] : [])}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {/* Service Items for this AC */}
                        <div className="space-y-4 pt-2">
                          <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Service Items</Label>
                          {groupLines.map((line, idx) => (
                            <div key={line.line_id} className="relative pl-4 border-l-2 border-primary/20 space-y-3 pb-4 last:pb-0 last:border-b-0">
                              {/* Header for service item row */}
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-muted-foreground">Item #{idx + 1}</span>
                                {groupLines.length > 1 && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => deleteServiceLine(line.line_id)}
                                    className="h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10 gap-1 text-xs"
                                  >
                                    <X className="h-3 w-3" />
                                    Hapus
                                  </Button>
                                )}
                              </div>

                              {/* Service Type Selection */}
                              <div>
                                <Label className="text-[11px] font-medium">Jenis Service *</Label>
                                <Select
                                  value={line.service_type_id || ''}
                                  disabled={!line.capacity_id || !!lineServiceTypesLoading[line.line_id]}
                                  onValueChange={(stId) => pickServiceForLine(line.line_id, stId)}
                                >
                                  <SelectTrigger className="h-9">
                                    <SelectValue
                                      placeholder={
                                        !line.capacity_id
                                          ? 'Pilih tipe unit & kapasitas dulu'
                                          : lineServiceTypesLoading[line.line_id]
                                            ? 'Memuat...'
                                            : 'Pilih jenis service...'
                                      }
                                    />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {(!line.unit_type_id || !line.capacity_id
                                      ? []
                                      : (lineServiceTypes[line.line_id] || [])).length === 0 ? (
                                      <SelectItem value="no_service_type" disabled className="text-[11px] text-amber-600 dark:text-amber-400">
                                        Tidak ada jenis service untuk tipe unit + kapasitas ini.
                                      </SelectItem>
                                    ) : (
                                      (lineServiceTypes[line.line_id] || []).map((st) => (
                                        <SelectItem key={st.service_type_id as string} value={st.service_type_id as string}>
                                          {(st.name as string) || (st.code as string)}
                                        </SelectItem>
                                      ))
                                    )}
                                  </SelectContent>
                                </Select>
                              </div>

                              {/* Qty, Price, Subtotal */}
                              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                <div>
                                  <Label className="text-[11px] font-medium">Quantity</Label>
                                  <Input
                                    type="number"
                                    min={1}
                                    value={line.quantity}
                                    className="h-9"
                                    onChange={(e) =>
                                      updateServiceLine(line.line_id, { quantity: Math.max(1, parseInt(e.target.value, 10) || 1) })
                                    }
                                  />
                                </div>
                                <div>
                                  <Label className="text-[11px] font-medium">Estimasi Harga (Rp)</Label>
                                  <Input
                                    type="number"
                                    min={0}
                                    value={line.estimated_price}
                                    className="h-9 font-medium"
                                    disabled={!line.service_type_id}
                                    onChange={(e) =>
                                      updateServiceLine(line.line_id, {
                                        estimated_price: Math.max(0, parseInt(e.target.value, 10) || 0),
                                        manual_price: true,
                                      })
                                    }
                                  />
                                  {!line.manual_price && line.estimated_price > 0 && (
                                    <p className="mt-1 flex items-center gap-1 text-[9px] text-emerald-600 dark:text-emerald-400 font-medium">
                                      <CheckCircle2 className="h-2.5 w-2.5" aria-hidden="true" />
                                      Sesuai harga katalog
                                    </p>
                                  )}
                                  {lineCatalogMissing[line.line_id] && !line.manual_price && (
                                    <p className="mt-1 flex items-center gap-1 text-[9px] text-amber-600 dark:text-amber-400 font-medium">
                                      <AlertTriangle className="h-2.5 w-2.5" aria-hidden="true" />
                                      Belum ada harga katalog. Isi manual.
                                    </p>
                                  )}
                                  {line.manual_price && (
                                    <div className="mt-1 flex items-center justify-between text-[9px] font-medium">
                                      <span className="flex items-center gap-0.5 text-amber-600 dark:text-amber-400">
                                        <AlertTriangle className="h-2.5 w-2.5" aria-hidden="true" />
                                        Manual
                                      </span>
                                      <button
                                        type="button"
                                        className="text-primary hover:underline"
                                        onClick={() => {
                                          updateServiceLine(line.line_id, { manual_price: false })
                                        }}
                                      >
                                        Reset
                                      </button>
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <Label className="text-[11px] font-medium text-muted-foreground/80">Subtotal</Label>
                                  <div className="flex h-9 items-center rounded-md border bg-muted/40 px-3 text-sm font-bold tracking-tight">
                                    {idrFmt(line.estimated_price * line.quantity)}
                                  </div>
                                </div>
                              </div>

                              {/* Item Description */}
                              <div>
                                <Label className="text-[11px] font-medium">Catatan Item (opsional)</Label>
                                <Textarea
                                  rows={1}
                                  value={line.description || ''}
                                  onChange={(e) => updateServiceLine(line.line_id, { description: e.target.value })}
                                  placeholder="Ruangan/posisi unit AC (misal: R. Tamu, Lt. 2) atau keluhan..."
                                  className="text-xs"
                                />
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Add service button for this AC */}
                        <div className="flex justify-start border-t pt-3">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => addServiceLineToGroup(unitInstanceId)}
                            className="h-8 text-xs gap-1.5"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Tambah Service
                          </Button>
                        </div>
                      </div>
                    )
                  })
                )}

                {serviceLines.length > 0 && (
                  <>
                    <div className="flex items-center justify-between rounded-md bg-muted/50 px-4 py-3">
                      <span className="text-sm font-medium">Total Estimasi</span>
                      <span className="text-base font-bold">{idrFmt(totalEstimatedPrice)}</span>
                    </div>
                    {isServicesFilled && (
                      <div className="flex justify-end">
                        <Button
                          onClick={() => setOpenSection('section-schedule')}
                          className="h-11 w-full sm:h-9 sm:w-auto"
                        >
                          Lanjut ke Schedule
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* ==============================================================
              SECTION 4: SCHEDULE & ASSIGNMENT
              ============================================================== */}
          <AccordionItem
            value="section-schedule"
            className={cn(
              'rounded-md border bg-card px-3 sm:px-4',
              !isServicesFilled && 'pointer-events-none opacity-60'
            )}
          >
            <AccordionTrigger className="hover:no-underline">
              <SectionHeader
                icon={<CalendarIcon className="h-5 w-5" />}
                step={4}
                title="Jadwal & Penugasan"
                filled={isScheduleFilled}
                summary={
                  isScheduleFilled
                    ? `${format(scheduledDate!, 'dd MMM yyyy')}${
                        skipAssignment
                          ? ' • Belum ditugaskan'
                          : ` • ${
                              technicians?.find((t) => t.technician_id === leadTechnicianId)
                                ?.full_name || 'Teknisi'
                            }`
                      }`
                    : 'Tentukan tanggal kunjungan dan penugasan teknisi'
                }
              />
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-2">
                <div>
                  <Label>Tanggal Kunjungan *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'h-11 w-full justify-start text-left font-normal sm:h-9',
                          !scheduledDate && 'text-muted-foreground'
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {scheduledDate
                          ? format(scheduledDate, 'EEEE, dd MMMM yyyy')
                          : 'Pilih tanggal'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={scheduledDate}
                        onSelect={setScheduledDate}
                        disabled={today ? (d) => d < today : undefined}
                        locale={localeId as unknown as Record<string, unknown>}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="rounded-md border p-4">
                  <div className="mb-3 flex items-start gap-2">
                    <Checkbox
                      id="skip-assignment"
                      checked={skipAssignment}
                      onCheckedChange={(v) => setSkipAssignment(v === true)}
                    />
                    <Label htmlFor="skip-assignment" className="cursor-pointer">
                      Skip — assign teknisi nanti
                    </Label>
                  </div>

                  {!skipAssignment && (
                    <div className="space-y-3">
                      <div>
                        <Label>Lead Teknisi *</Label>
                        <Select value={leadTechnicianId} onValueChange={setLeadTechnicianId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Pilih teknisi..." />
                          </SelectTrigger>
                          <SelectContent>
                            {(technicians || []).map((t) => (
                              <SelectItem key={t.technician_id} value={t.technician_id}>
                                {t.full_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Helper (opsional)</Label>
                        <MultiSelectDropdown
                          options={(technicians || []).flatMap((t) =>
                            t.technician_id === leadTechnicianId ? [] : [{ id: t.technician_id, label: t.full_name }]
                          )}
                          selected={helperTechnicianIds}
                          onSelectionChange={setHelperTechnicianIds}
                          placeholder="Pilih helper..."
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <Label>Catatan Order (opsional)</Label>
                  <Textarea
                    rows={3}
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    placeholder="Catatan tambahan untuk order ini..."
                  />
                </div>

                {isScheduleFilled && (
                  <div className="flex justify-end">
                    <Button
                      onClick={() => setOpenSection('section-review')}
                      className="h-11 w-full sm:h-9 sm:w-auto"
                    >
                      Lanjut ke Review
                    </Button>
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* ==============================================================
              SECTION 5: REVIEW & SUBMIT
              ============================================================== */}
          <AccordionItem
            value="section-review"
            className={cn(
              'rounded-md border bg-card px-3 sm:px-4',
              !isScheduleFilled && 'pointer-events-none opacity-60'
            )}
          >
            <AccordionTrigger className="hover:no-underline">
              <SectionHeader
                icon={<Package className="h-5 w-5" />}
                step={5}
                title="Review & Submit"
                filled={false}
                summary={`Total estimasi ${idrFmt(totalEstimatedPrice)}`}
              />
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-2">
                {/* Summary */}
                <div className="space-y-3 rounded-md border p-4">
                  <SummaryRow label="Customer">
                    {customer ? (
                      <span>
                        {customer.customer_name} • {customer.phone_number}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Belum dipilih</span>
                    )}
                  </SummaryRow>
                  <SummaryRow label="Tanggal Kunjungan">
                    {scheduledDate ? format(scheduledDate, 'EEEE, dd MMMM yyyy') : '-'}
                  </SummaryRow>
                  <SummaryRow label="Teknisi">
                    {skipAssignment ? (
                      <Badge variant="outline">Assign nanti</Badge>
                    ) : (
                      <span>
                        {technicians?.find((t) => t.technician_id === leadTechnicianId)?.full_name ||
                          '-'}
                        {helperTechnicianIds.length > 0 && (
                          <span className="text-muted-foreground">
                            {' '}
                            (+{helperTechnicianIds.length} helper)
                          </span>
                        )}
                      </span>
                    )}
                  </SummaryRow>
                  <div>
                    <p className="mb-2 text-sm font-medium">Service Items</p>
                    <div className="space-y-1 text-sm">
                      {serviceLines.map((l) => (
                        <div
                          key={l.line_id}
                          className="flex items-start justify-between rounded bg-muted/30 px-3 py-2"
                        >
                          <div className="flex-1">
                            <p className="font-medium">
                              {l.service_name || '(Belum pilih service)'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {l.ac_label} • {l.location_label}
                              {l.quantity > 1 && ` × ${l.quantity}`}
                            </p>
                          </div>
                          <span>{idrFmt(l.estimated_price * l.quantity)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between border-t pt-3">
                    <span className="text-sm font-medium">Total Estimasi</span>
                    <span className="text-lg font-bold">{idrFmt(totalEstimatedPrice)}</span>
                  </div>
                </div>

                {/* Proforma checkbox */}
                <div className="flex items-start gap-3 rounded-md border bg-muted/20 p-4">
                  <Checkbox
                    id="create-proforma"
                    checked={createProforma}
                    onCheckedChange={(v) => setCreateProforma(v === true)}
                  />
                  <div className="flex-1">
                    <Label htmlFor="create-proforma" className="cursor-pointer text-sm font-medium">
                      Buat Proforma Invoice otomatis
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Proforma invoice akan dibuat dengan harga estimasi. Bisa direvisi setelah
                      service selesai dilakukan.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button
                    variant="ghost"
                    onClick={() => router.back()}
                    disabled={submitting}
                    className="h-11 w-full sm:h-9 sm:w-auto"
                  >
                    Batal
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="h-11 w-full sm:h-9 sm:w-auto"
                  >
                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {createProforma ? 'Buat Order + Proforma' : 'Buat Order'}
                  </Button>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </LoadingOverlay>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function SectionHeader({
  icon,
  step,
  title,
  filled,
  summary,
}: {
  icon: React.ReactNode
  step: number
  title: string
  filled: boolean
  summary: string
}) {
  return (
    <div className="flex w-full items-center gap-3 pr-2">
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
          filled ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-muted-foreground/30'
        )}
      >
        {filled ? <CheckCircle2 className="h-4 w-4" /> : step}
      </div>
      <div className="shrink-0 text-muted-foreground">{icon}</div>
      <div className="min-w-0 flex-1 text-left">
        <p className="font-semibold">{title}</p>
        <p className="truncate text-xs text-muted-foreground">{summary}</p>
      </div>
    </div>
  )
}

function SummaryRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  )
}
