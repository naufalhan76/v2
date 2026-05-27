'use client'

import { useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Pencil,
  Plus,
  MapPin,
  Building2,
  Wind,
  ClipboardList,
  Phone,
  Mail,
  User,
  FileText,
  Trash2,
  Eye,
} from 'lucide-react'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { EmptyState } from '@/components/ui/empty-state'
import { useToast } from '@/hooks/use-toast'
import { logger } from '@/lib/logger'
import { formatPhone } from '@/lib/utils'
import { formatCurrency } from '@/lib/format'

import { getCustomerById } from '@/lib/actions/customers'
import { getLocations, updateLocation, deleteLocation } from '@/lib/actions/locations'
import { createLocation } from '@/lib/actions/create-order'
import { getAcUnits, createAcUnit, updateAcUnit, deleteAcUnit } from '@/lib/actions/ac-units'
import { getUnitTypes, getCapacityRanges, getAcBrands } from '@/lib/actions/service-config'
import { getOrders } from '@/lib/actions/orders'
import { OrderDetailPanel } from '@/components/orders/order-detail-panel'
import { StatusBadge } from '@/components/orders/status-badge'

// =====================================================================
// Types
// =====================================================================

interface Customer {
  customer_id: string
  customer_name: string
  primary_contact_person: string
  phone_number: string
  email: string
  billing_address: string
  notes?: string | null
  locations?: Array<{
    location_id: string
    full_address?: string | null
    house_number?: string | null
    city?: string | null
    landmarks?: string | null
    ac_units?: Array<{ ac_unit_id: string }>
  }>
}

interface Location {
  location_id: string
  customer_id: string
  full_address: string
  house_number: string
  city: string
  landmarks?: string | null
}

interface AcUnit {
  ac_unit_id: string
  location_id: string
  brand: string
  model_number: string
  serial_number: string
  ac_type?: string | null
  capacity_btu?: number | null
  installation_date?: string | null
  status: string
  last_service_date?: string | null
  next_service_due_date?: string | null
  unit_type_id?: string | null
  capacity_id?: string | null
  brand_id?: string | null
  unit_types?: { name?: string | null } | null
  capacity_ranges?: { capacity_label?: string | null } | null
  ac_brands?: { name?: string | null } | null
}

interface OrderRow {
  order_id: string
  status: string | null
  scheduled_visit_date?: string | null
  req_visit_date?: string | null
  created_at?: string | null
  order_items?: Array<{
    estimated_price?: number | null
    actual_price?: number | null
  }>
}

// =====================================================================
// Helpers
// =====================================================================

function formatDateOnly(value: string | null | undefined) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return format(d, 'd MMM yyyy', { locale: localeId })
}

function getStatusBadge(status: string) {
  const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    ACTIVE: 'default',
    MAINTENANCE: 'secondary',
    WORKSHOP: 'secondary',
    INACTIVE: 'destructive',
  }
  return <Badge variant={variants[status] || 'outline'}>{status}</Badge>
}

function orderTotal(order: OrderRow): number {
  return (order.order_items ?? []).reduce((sum, item) => {
    return sum + (item.actual_price ?? item.estimated_price ?? 0)
  }, 0)
}

// =====================================================================
// Page
// =====================================================================

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const customerId = params.id

  const queryClient = useQueryClient()
  const { toast } = useToast()

  // ----- Edit customer dialog -----
  const [isEditCustomerOpen, setIsEditCustomerOpen] = useState(false)
  const [customerForm, setCustomerForm] = useState({
    customer_name: '',
    primary_contact_person: '',
    phone_number: '',
    email: '',
    billing_address: '',
    notes: '',
  })
  const [isSavingCustomer, setIsSavingCustomer] = useState(false)

  // ----- Selected order panel -----
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [orderPanelOpen, setOrderPanelOpen] = useState(false)

  // ----- Customer query -----
  const customerQueryKey = ['customer-detail', customerId] as const
  const {
    data: customerResult,
    isLoading: isLoadingCustomer,
    isError: isCustomerError,
  } = useQuery({
    queryKey: customerQueryKey,
    queryFn: () => getCustomerById(customerId),
    enabled: !!customerId,
  })

  const customer = (customerResult?.success ? (customerResult.data as Customer) : null)

  const handleOpenEditCustomer = () => {
    if (!customer) return
    setCustomerForm({
      customer_name: customer.customer_name ?? '',
      primary_contact_person: customer.primary_contact_person ?? '',
      phone_number: customer.phone_number ?? '',
      email: customer.email ?? '',
      billing_address: customer.billing_address ?? '',
      notes: customer.notes ?? '',
    })
    setIsEditCustomerOpen(true)
  }

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSavingCustomer(true)
    try {
      const res = await fetch(`/api/customers/${customerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customerForm),
      })
      const result = await res.json()
      if (result.success) {
        toast({ title: 'Berhasil', description: 'Customer berhasil diperbarui' })
        queryClient.invalidateQueries({ queryKey: customerQueryKey })
        queryClient.invalidateQueries({ queryKey: ['customers'] })
        setIsEditCustomerOpen(false)
      } else {
        toast({
          title: 'Gagal',
          description: result.error || 'Gagal memperbarui customer',
          variant: 'destructive',
        })
      }
    } catch (error) {
      logger.error('Error updating customer:', error)
      toast({
        title: 'Error',
        description: 'Terjadi kesalahan saat memperbarui customer',
        variant: 'destructive',
      })
    } finally {
      setIsSavingCustomer(false)
    }
  }

  // ----- Render -----

  if (isLoadingCustomer) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-10 w-96" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (isCustomerError || !customer) {
    return (
      <div className="p-6">
        <Button variant="ghost" onClick={() => router.back()} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Kembali
        </Button>
        <EmptyState
          icon={User}
          title="Customer tidak ditemukan"
          description="Customer yang dicari tidak tersedia atau telah dihapus."
        />
      </div>
    )
  }

  const locationsCount = customer.locations?.length ?? 0
  const totalAcUnits = (customer.locations ?? []).reduce(
    (sum, loc) => sum + (loc.ac_units?.length ?? 0),
    0,
  )

  return (
    <>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Button variant="ghost" size="icon" onClick={() => router.back()} className="mt-1">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">{customer.customer_name}</h1>
              <p className="text-muted-foreground mt-1">
                Detail customer & riwayat layanan
              </p>
            </div>
          </div>
          <Button onClick={handleOpenEditCustomer}>
            <Pencil className="h-4 w-4 mr-2" />
            Edit Customer
          </Button>
        </div>

        {/* Summary Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide">
                  <User className="h-3.5 w-3.5" />
                  Kontak Person
                </div>
                <p className="text-sm font-medium">{customer.primary_contact_person || '-'}</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide">
                  <Phone className="h-3.5 w-3.5" />
                  Telepon
                </div>
                <p className="text-sm font-medium font-mono">
                  {formatPhone(customer.phone_number) || '-'}
                </p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide">
                  <Mail className="h-3.5 w-3.5" />
                  Email
                </div>
                <p className="text-sm font-medium truncate">{customer.email || '-'}</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide">
                  <Building2 className="h-3.5 w-3.5" />
                  Aset
                </div>
                <p className="text-sm font-medium">
                  {locationsCount} lokasi · {totalAcUnits} AC
                </p>
              </div>
            </div>
            {customer.billing_address && (
              <div className="mt-4 pt-4 border-t">
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                      Alamat Billing
                    </p>
                    <p>{customer.billing_address}</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="detail" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4 max-w-2xl">
            <TabsTrigger value="detail">Detail</TabsTrigger>
            <TabsTrigger value="lokasi">Lokasi</TabsTrigger>
            <TabsTrigger value="ac-units">AC Units</TabsTrigger>
            <TabsTrigger value="orders">Riwayat Order</TabsTrigger>
          </TabsList>

          <TabsContent value="detail">
            <DetailTab customer={customer} onEdit={handleOpenEditCustomer} />
          </TabsContent>

          <TabsContent value="lokasi">
            <LokasiTab customerId={customerId} />
          </TabsContent>

          <TabsContent value="ac-units">
            <AcUnitsTab customerId={customerId} />
          </TabsContent>

          <TabsContent value="orders">
            <OrdersTab
              customerId={customerId}
              onOpenOrder={(orderId) => {
                setSelectedOrderId(orderId)
                setOrderPanelOpen(true)
              }}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Customer Sheet */}
      <Sheet open={isEditCustomerOpen} onOpenChange={setIsEditCustomerOpen}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit Customer</SheetTitle>
            <SheetDescription>Perbarui informasi customer</SheetDescription>
          </SheetHeader>
          <form onSubmit={handleSaveCustomer} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="customer_name">Nama Customer *</Label>
              <Input
                id="customer_name"
                value={customerForm.customer_name}
                onChange={(e) =>
                  setCustomerForm({ ...customerForm, customer_name: e.target.value })
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="primary_contact_person">Kontak Person *</Label>
              <Input
                id="primary_contact_person"
                value={customerForm.primary_contact_person}
                onChange={(e) =>
                  setCustomerForm({
                    ...customerForm,
                    primary_contact_person: e.target.value,
                  })
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone_number">Nomor Telepon *</Label>
              <Input
                id="phone_number"
                type="tel"
                value={customerForm.phone_number}
                onChange={(e) =>
                  setCustomerForm({ ...customerForm, phone_number: e.target.value })
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={customerForm.email}
                onChange={(e) =>
                  setCustomerForm({ ...customerForm, email: e.target.value })
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="billing_address">Alamat Billing *</Label>
              <Textarea
                id="billing_address"
                value={customerForm.billing_address}
                onChange={(e) =>
                  setCustomerForm({ ...customerForm, billing_address: e.target.value })
                }
                required
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Catatan</Label>
              <Textarea
                id="notes"
                value={customerForm.notes}
                onChange={(e) =>
                  setCustomerForm({ ...customerForm, notes: e.target.value })
                }
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditCustomerOpen(false)}
              >
                Batal
              </Button>
              <Button type="submit" disabled={isSavingCustomer}>
                {isSavingCustomer ? 'Menyimpan...' : 'Simpan'}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {/* Order Detail Panel */}
      <OrderDetailPanel
        orderId={selectedOrderId}
        open={orderPanelOpen}
        onOpenChange={(open) => {
          setOrderPanelOpen(open)
          if (!open) setSelectedOrderId(null)
        }}
      />
    </>
  )
}

// =====================================================================
// Detail Tab
// =====================================================================

function DetailTab({
  customer,
  onEdit,
}: {
  customer: Customer
  onEdit: () => void
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Informasi Customer</CardTitle>
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Pencil className="h-4 w-4 mr-2" />
          Ubah
        </Button>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-4 sm:grid-cols-2">
          <DetailRow label="Nama Customer" value={customer.customer_name} />
          <DetailRow label="Kontak Person" value={customer.primary_contact_person} />
          <DetailRow
            label="Nomor Telepon"
            value={formatPhone(customer.phone_number) || '-'}
            mono
          />
          <DetailRow label="Email" value={customer.email} />
          <DetailRow
            label="Alamat Billing"
            value={customer.billing_address}
            className="sm:col-span-2"
          />
          <DetailRow
            label="Catatan"
            value={customer.notes || '-'}
            className="sm:col-span-2"
            icon={FileText}
          />
        </dl>
      </CardContent>
    </Card>
  )
}

function DetailRow({
  label,
  value,
  mono,
  className,
  icon: Icon,
}: {
  label: string
  value: string | null | undefined
  mono?: boolean
  className?: string
  icon?: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className={className}>
      <dt className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
      </dt>
      <dd className={`mt-1 text-sm ${mono ? 'font-mono' : ''}`}>{value || '-'}</dd>
    </div>
  )
}

// =====================================================================
// Lokasi Tab
// =====================================================================

function LokasiTab({ customerId }: { customerId: string }) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const queryKey = ['customer-locations', customerId] as const

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => getLocations({ customerId, limit: 200 }),
  })

  const locations = (data?.success ? (data.data as Location[]) : []) ?? []

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingLocation, setEditingLocation] = useState<Location | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [form, setForm] = useState({
    full_address: '',
    house_number: '1',
    city: '',
    landmarks: '',
  })

  const openCreate = () => {
    setEditingLocation(null)
    setForm({ full_address: '', house_number: '1', city: '', landmarks: '' })
    setIsFormOpen(true)
  }

  const openEdit = (loc: Location) => {
    setEditingLocation(loc)
    setForm({
      full_address: loc.full_address ?? '',
      house_number: loc.house_number ?? '1',
      city: loc.city ?? '',
      landmarks: loc.landmarks ?? '',
    })
    setIsFormOpen(true)
  }

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey })
    queryClient.invalidateQueries({ queryKey: ['customer-detail', customerId] })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const result = editingLocation
        ? await updateLocation(editingLocation.location_id, form)
        : await createLocation({ customer_id: customerId, ...form })

      if (result.success) {
        toast({
          title: 'Berhasil',
          description: editingLocation
            ? 'Lokasi berhasil diperbarui'
            : 'Lokasi berhasil ditambahkan',
        })
        setIsFormOpen(false)
        invalidate()
      } else {
        toast({
          title: 'Gagal',
          description: result.error || 'Gagal menyimpan lokasi',
          variant: 'destructive',
        })
      }
    } catch (error) {
      logger.error('Error saving location:', error)
      toast({
        title: 'Error',
        description: 'Terjadi kesalahan saat menyimpan lokasi',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteId) return
    setIsSubmitting(true)
    try {
      const result = await deleteLocation(deleteId)
      if (result.success) {
        toast({ title: 'Berhasil', description: 'Lokasi dihapus' })
        setDeleteId(null)
        invalidate()
      } else {
        toast({
          title: 'Gagal',
          description: result.error || 'Gagal menghapus lokasi',
          variant: 'destructive',
        })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Lokasi ({locations.length})</CardTitle>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Tambah Lokasi
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : locations.length === 0 ? (
          <EmptyState
            icon={MapPin}
            title="Belum ada lokasi"
            description="Tambahkan lokasi untuk mulai mencatat AC unit pada customer ini."
            action={{
              label: 'Tambah Lokasi',
              icon: Plus,
              onClick: openCreate,
            }}
          />
        ) : (
          <div className="data-table-container overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Alamat</TableHead>
                  <TableHead>No. Rumah</TableHead>
                  <TableHead>Kota</TableHead>
                  <TableHead>Patokan</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {locations.map((loc) => (
                  <TableRow key={loc.location_id}>
                    <TableCell className="font-medium">{loc.full_address}</TableCell>
                    <TableCell>{loc.house_number}</TableCell>
                    <TableCell>{loc.city}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {loc.landmarks || '-'}
                    </TableCell>
                    <TableCell className="text-right w-[140px]">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => openEdit(loc)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="icon"
                          onClick={() => setDeleteId(loc.location_id)}
                        >
                          <Trash2 className="h-4 w-4" />
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

      {/* Form Sheet */}
      <Sheet open={isFormOpen} onOpenChange={setIsFormOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {editingLocation ? 'Edit Lokasi' : 'Tambah Lokasi'}
            </SheetTitle>
            <SheetDescription>
              {editingLocation
                ? 'Perbarui informasi lokasi'
                : 'Tambahkan lokasi service baru untuk customer ini'}
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="loc_full_address">Alamat Lengkap *</Label>
              <Textarea
                id="loc_full_address"
                value={form.full_address}
                onChange={(e) => setForm({ ...form, full_address: e.target.value })}
                required
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="loc_house_number">No. Rumah *</Label>
              <Input
                id="loc_house_number"
                value={form.house_number}
                onChange={(e) =>
                  setForm({ ...form, house_number: e.target.value || '1' })
                }
                placeholder="contoh: 12, 12A"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="loc_city">Kota *</Label>
              <Input
                id="loc_city"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="loc_landmarks">Patokan</Label>
              <Input
                id="loc_landmarks"
                value={form.landmarks}
                onChange={(e) => setForm({ ...form, landmarks: e.target.value })}
                placeholder="contoh: dekat masjid, sebelah toko ABC"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsFormOpen(false)}
              >
                Batal
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Menyimpan...' : 'Simpan'}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Lokasi?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini tidak dapat dibatalkan. Lokasi yang masih memiliki AC unit
              tidak dapat dihapus.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSubmitting ? 'Menghapus...' : 'Hapus'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

// =====================================================================
// AC Units Tab
// =====================================================================

function AcUnitsTab({ customerId }: { customerId: string }) {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const acUnitsKey = ['customer-ac-units', customerId] as const
  const locationsKey = ['customer-locations', customerId] as const

  const { data: locationsData } = useQuery({
    queryKey: locationsKey,
    queryFn: () => getLocations({ customerId, limit: 200 }),
  })
  const locations = useMemo<Location[]>(
    () => (locationsData?.success ? (locationsData.data as Location[]) : []) ?? [],
    [locationsData],
  )
  const locationIds = useMemo(() => locations.map((l) => l.location_id), [locations])

  const { data: acUnitsData, isLoading: isLoadingAcUnits } = useQuery({
    queryKey: [...acUnitsKey, locationIds],
    queryFn: async () => {
      // Fetch all AC units (server action limit is generous) then filter by this customer's locations
      const result = await getAcUnits({ limit: 1000 })
      if (!result.success) return result
      const filtered = (result.data as Array<AcUnit & { locations?: { location_id: string } }>)
        .filter((u) => u.locations?.location_id && locationIds.includes(u.locations.location_id))
      return { ...result, data: filtered }
    },
    enabled: locations.length > 0,
  })

  const acUnits = useMemo<AcUnit[]>(
    () => (acUnitsData?.success ? (acUnitsData.data as AcUnit[]) : []) ?? [],
    [acUnitsData],
  )

  // Master data for form
  const { data: masterData } = useQuery({
    queryKey: ['ac-master-data'],
    queryFn: async () => {
      const [unitTypesResult, capacityResult, brandsResult] = await Promise.all([
        getUnitTypes(),
        getCapacityRanges(),
        getAcBrands(),
      ])
      return {
        unitTypes: unitTypesResult.success ? unitTypesResult.data ?? [] : [],
        capacityRanges: capacityResult.success ? capacityResult.data ?? [] : [],
        brands: brandsResult.success ? brandsResult.data ?? [] : [],
      }
    },
  })

  const unitTypes = useMemo(() => masterData?.unitTypes ?? [], [masterData])
  const capacityRanges = useMemo(() => masterData?.capacityRanges ?? [], [masterData])
  const masterBrands = useMemo(() => masterData?.brands ?? [], [masterData])

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingAcUnit, setEditingAcUnit] = useState<AcUnit | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const initialForm = {
    location_id: '',
    brand: '',
    model_number: '',
    serial_number: '',
    ac_type: '',
    capacity_btu: 0,
    installation_date: '',
    status: 'ACTIVE',
    unit_type_id: '',
    capacity_id: '',
    brand_id: '',
  }
  const [form, setForm] = useState(initialForm)

  const filteredCapacities = useMemo(() => {
    if (!form.unit_type_id) return capacityRanges
    return capacityRanges.filter(
      (c: { capacity_id: string; unit_type_id: string; capacity_label: string }) =>
        c.unit_type_id === form.unit_type_id,
    )
  }, [form.unit_type_id, capacityRanges])

  const openCreate = () => {
    setEditingAcUnit(null)
    setForm({
      ...initialForm,
      location_id: locations[0]?.location_id ?? '',
    })
    setIsFormOpen(true)
  }

  const openEdit = (unit: AcUnit) => {
    setEditingAcUnit(unit)
    setForm({
      location_id: unit.location_id ?? '',
      brand: unit.brand ?? '',
      model_number: unit.model_number ?? '',
      serial_number: unit.serial_number ?? '',
      ac_type: unit.ac_type ?? '',
      capacity_btu: unit.capacity_btu ?? 0,
      installation_date: unit.installation_date ?? '',
      status: unit.status ?? 'ACTIVE',
      unit_type_id: unit.unit_type_id ?? '',
      capacity_id: unit.capacity_id ?? '',
      brand_id: unit.brand_id ?? '',
    })
    setIsFormOpen(true)
  }

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: acUnitsKey })
    queryClient.invalidateQueries({ queryKey: ['customer-detail', customerId] })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.location_id) {
      toast({
        title: 'Validasi',
        description: 'Pilih lokasi terlebih dahulu',
        variant: 'destructive',
      })
      return
    }
    setIsSubmitting(true)
    try {
      const payload = {
        ...form,
        capacity_btu: Number(form.capacity_btu) || undefined,
        unit_type_id: form.unit_type_id || undefined,
        capacity_id: form.capacity_id || undefined,
        brand_id: form.brand_id || undefined,
        installation_date: form.installation_date || undefined,
      }

      const result = editingAcUnit
        ? await updateAcUnit(editingAcUnit.ac_unit_id, payload)
        : await createAcUnit({
            ...payload,
            location_id: form.location_id,
          })

      if (result.success) {
        toast({
          title: 'Berhasil',
          description: editingAcUnit
            ? 'AC unit diperbarui'
            : 'AC unit berhasil ditambahkan',
        })
        setIsFormOpen(false)
        invalidate()
      } else {
        toast({
          title: 'Gagal',
          description: result.error || 'Gagal menyimpan AC unit',
          variant: 'destructive',
        })
      }
    } catch (error) {
      logger.error('Error saving AC unit:', error)
      toast({
        title: 'Error',
        description: 'Terjadi kesalahan saat menyimpan AC unit',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteId) return
    setIsSubmitting(true)
    try {
      const result = await deleteAcUnit(deleteId)
      if (result.success) {
        toast({ title: 'Berhasil', description: 'AC unit dihapus' })
        setDeleteId(null)
        invalidate()
      } else {
        toast({
          title: 'Gagal',
          description: result.error || 'Gagal menghapus AC unit',
          variant: 'destructive',
        })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  // Group AC units by location
  const groupedByLocation = useMemo(() => {
    const map = new Map<string, AcUnit[]>()
    for (const unit of acUnits) {
      const arr = map.get(unit.location_id) ?? []
      arr.push(unit)
      map.set(unit.location_id, arr)
    }
    return map
  }, [acUnits])

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>AC Units ({acUnits.length})</CardTitle>
        <Button size="sm" onClick={openCreate} disabled={locations.length === 0}>
          <Plus className="h-4 w-4 mr-2" />
          Tambah AC
        </Button>
      </CardHeader>
      <CardContent>
        {locations.length === 0 ? (
          <EmptyState
            icon={MapPin}
            title="Belum ada lokasi"
            description="Tambahkan lokasi terlebih dahulu sebelum mencatat AC unit."
          />
        ) : isLoadingAcUnits ? (
          <div className="space-y-2">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : acUnits.length === 0 ? (
          <EmptyState
            icon={Wind}
            title="Belum ada AC unit"
            description="Tambahkan AC unit pertama untuk customer ini."
            action={{
              label: 'Tambah AC',
              icon: Plus,
              onClick: openCreate,
            }}
          />
        ) : (
          <div className="space-y-6">
            {locations.map((loc) => {
              const units = groupedByLocation.get(loc.location_id) ?? []
              if (units.length === 0) return null
              return (
                <div key={loc.location_id} className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold border-b pb-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{loc.full_address}</span>
                    <Badge variant="secondary" className="ml-auto">
                      {units.length} unit
                    </Badge>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {units.map((unit) => (
                      <div
                        key={unit.ac_unit_id}
                        className="rounded-lg border p-4 space-y-2 hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-medium">
                              {unit.ac_brands?.name || unit.brand || '-'}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              Model {unit.model_number || '-'}
                              {unit.serial_number && ` · SN ${unit.serial_number}`}
                            </p>
                          </div>
                          {getStatusBadge(unit.status)}
                        </div>
                        <div className="flex flex-wrap gap-1.5 text-xs">
                          {unit.unit_types?.name && (
                            <Badge variant="outline">{unit.unit_types.name}</Badge>
                          )}
                          {unit.capacity_ranges?.capacity_label && (
                            <Badge variant="outline" className="font-mono">
                              {unit.capacity_ranges.capacity_label}
                            </Badge>
                          )}
                          {!unit.capacity_ranges?.capacity_label && unit.capacity_btu ? (
                            <Badge variant="outline" className="font-mono">
                              {unit.capacity_btu} BTU
                            </Badge>
                          ) : null}
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                          <div>
                            <p className="text-muted-foreground">Service Terakhir</p>
                            <p>{formatDateOnly(unit.last_service_date)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Service Berikutnya</p>
                            <p>{formatDateOnly(unit.next_service_due_date)}</p>
                          </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEdit(unit)}
                          >
                            <Pencil className="h-3.5 w-3.5 mr-1.5" />
                            Ubah
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setDeleteId(unit.ac_unit_id)}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                            Hapus
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>

      {/* Form Sheet */}
      <Sheet open={isFormOpen} onOpenChange={setIsFormOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {editingAcUnit ? 'Edit AC Unit' : 'Tambah AC Unit'}
            </SheetTitle>
            <SheetDescription>
              {editingAcUnit
                ? 'Perbarui informasi AC unit'
                : 'Tambahkan AC unit baru untuk customer ini'}
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="ac_location">Lokasi *</Label>
              <Select
                value={form.location_id}
                onValueChange={(value) => setForm({ ...form, location_id: value })}
                disabled={!!editingAcUnit}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih lokasi" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((l) => (
                    <SelectItem key={l.location_id} value={l.location_id}>
                      {l.full_address}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1 pt-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Klasifikasi Unit
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ac_unit_type_id">Unit Type</Label>
              <SearchableSelect
                options={[
                  { id: '', label: '— Tidak diisi —' },
                  ...unitTypes.map((ut: { unit_type_id: string; name: string }) => ({
                    id: ut.unit_type_id,
                    label: ut.name,
                  })),
                ]}
                value={form.unit_type_id}
                onValueChange={(value) =>
                  setForm({ ...form, unit_type_id: value, capacity_id: '' })
                }
                placeholder="Pilih Unit Type"
                searchPlaceholder="Cari unit type..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ac_capacity_id">Capacity</Label>
              <SearchableSelect
                options={[
                  { id: '', label: '— Tidak diisi —' },
                  ...filteredCapacities.map((cap: { capacity_id: string; capacity_label: string }) => ({
                    id: cap.capacity_id,
                    label: cap.capacity_label,
                  })),
                ]}
                value={form.capacity_id}
                onValueChange={(value) => setForm({ ...form, capacity_id: value })}
                placeholder={form.unit_type_id ? 'Pilih Capacity' : 'Pilih Unit Type dulu'}
                searchPlaceholder="Cari capacity..."
                className={!form.unit_type_id ? 'pointer-events-none opacity-50' : ''}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ac_brand_id">Merk AC</Label>
              <SearchableSelect
                options={[
                  { id: '', label: '— Tidak diisi —' },
                  ...masterBrands.map((b: { brand_id: string; name: string }) => ({
                    id: b.brand_id,
                    label: b.name,
                  })),
                ]}
                value={form.brand_id}
                onValueChange={(value) => setForm({ ...form, brand_id: value })}
                placeholder="Pilih Merk (opsional)"
                searchPlaceholder="Cari merk..."
              />
            </div>

            <div className="space-y-1 pt-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Informasi Unit
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ac_brand">Brand (teks) *</Label>
              <Input
                id="ac_brand"
                value={form.brand}
                onChange={(e) => setForm({ ...form, brand: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ac_model">Model Number *</Label>
              <Input
                id="ac_model"
                value={form.model_number}
                onChange={(e) => setForm({ ...form, model_number: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ac_serial">Serial Number *</Label>
              <Input
                id="ac_serial"
                value={form.serial_number}
                onChange={(e) => setForm({ ...form, serial_number: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ac_install">Tanggal Pemasangan</Label>
              <Input
                id="ac_install"
                type="date"
                value={form.installation_date}
                onChange={(e) =>
                  setForm({ ...form, installation_date: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ac_status">Status *</Label>
              <SearchableSelect
                options={[
                  { id: 'ACTIVE', label: 'Active' },
                  { id: 'MAINTENANCE', label: 'Maintenance' },
                  { id: 'WORKSHOP', label: 'Workshop' },
                  { id: 'INACTIVE', label: 'Inactive' },
                ]}
                value={form.status}
                onValueChange={(value) => setForm({ ...form, status: value })}
                placeholder="Pilih status"
                searchPlaceholder="Cari status..."
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsFormOpen(false)}
              >
                Batal
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Menyimpan...' : 'Simpan'}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus AC Unit?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini tidak dapat dibatalkan. AC unit dengan riwayat service tidak
              dapat dihapus.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSubmitting ? 'Menghapus...' : 'Hapus'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

// =====================================================================
// Orders Tab
// =====================================================================

function OrdersTab({
  customerId,
  onOpenOrder,
}: {
  customerId: string
  onOpenOrder: (orderId: string) => void
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['customer-orders', customerId],
    queryFn: () => getOrders({ customerId, limit: 100 }),
  })

  const orders = (data?.success ? (data.data as OrderRow[]) : []) ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle>Riwayat Order ({orders.length})</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : orders.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="Belum ada order"
            description="Customer ini belum memiliki order. Order akan muncul di sini setelah dibuat."
            action={{
              label: 'Buat Order',
              icon: Plus,
              onClick: () => {
                window.location.href = `/dashboard/operasional/create-order?customer=${customerId}`
              },
            }}
          />
        ) : (
          <div className="data-table-container overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead className="text-right">Total Estimasi</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => {
                  const dateStr =
                    order.scheduled_visit_date ?? order.req_visit_date ?? order.created_at
                  return (
                    <TableRow
                      key={order.order_id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => onOpenOrder(order.order_id)}
                    >
                      <TableCell className="font-mono text-xs">
                        {order.order_id}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={order.status} />
                      </TableCell>
                      <TableCell>{formatDateOnly(dateStr)}</TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatCurrency(orderTotal(order))}
                      </TableCell>
                      <TableCell className="text-right w-[100px]">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            onOpenOrder(order.order_id)
                          }}
                        >
                          <Eye className="h-4 w-4 mr-1.5" />
                          Lihat
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

