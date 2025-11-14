'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getCustomers } from '@/lib/actions/customers'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { SortableTableHead } from '@/components/ui/sortable-table-head'
import { useSortableTable } from '@/hooks/use-sortable-table'
import { Plus, Pencil, Trash2, Search, MapPin, Building2 } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { TableSkeleton } from '@/components/ui/skeleton'
import { LoadingState, LoadingOverlay } from '@/components/ui/loading-state'
import { useOptimisticArray } from '@/hooks/use-optimistic'
import { ResourceHints } from '@/components/ui/priority-components'

interface CustomerFormData {
  customer_name: string
  primary_contact_person: string
  phone_number: string
  email: string
  billing_address: string
  notes: string
}

const emptyForm: CustomerFormData = {
  customer_name: '',
  primary_contact_person: '',
  phone_number: '',
  email: '',
  billing_address: '',
  notes: ''
}

export default function CustomerManagementPage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState('')
  const [page, setPage] = useState(1)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [formData, setFormData] = useState<CustomerFormData>(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const itemsPerPage = 10

  const { data, isLoading } = useQuery({
    queryKey: ['customers', page, searchTerm],
    queryFn: () => getCustomers({ page, limit: itemsPerPage, search: searchTerm })
  })

  // Loading states for operations
  const [isCreating, setIsCreating] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Optimistic UI untuk delete operation
  const { optimisticArray: optimisticCustomersBase, handleArrayAction } = useOptimisticArray(
    data?.data || [],
    async ({ type, id }) => {
      if (type === 'remove') {
        const response = await fetch(`/api/customers/${id}`, { method: 'DELETE' })
        const result = await response.json()
        return { success: result.success, data: result.data }
      }
      return { success: true, data: [] }
    }
  )

  // Apply sorting
  const { sortedData: optimisticCustomers, sortConfig, requestSort } = useSortableTable(optimisticCustomersBase, {
    key: 'customer_name',
    direction: 'asc'
  })

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    
    // Basic validation
    if (!formData.customer_name.trim()) {
      toast({
        title: "Validation Error",
        description: "Nama customer wajib diisi",
        variant: "destructive",
      })
      return
    }
    
    if (!formData.primary_contact_person.trim()) {
      toast({
        title: "Validation Error", 
        description: "Kontak person wajib diisi",
        variant: "destructive",
      })
      return
    }
    
    if (!formData.phone_number.trim()) {
      toast({
        title: "Validation Error",
        description: "Nomor telepon wajib diisi", 
        variant: "destructive",
      })
      return
    }
    
    if (!formData.email.trim()) {
      toast({
        title: "Validation Error",
        description: "Email wajib diisi",
        variant: "destructive",
      })
      return
    }
    
    if (!formData.billing_address.trim()) {
      toast({
        title: "Validation Error",
        description: "Alamat billing wajib diisi",
        variant: "destructive",
      })
      return
    }
    
    console.log('Submitting customer data:', formData)
    
    // Use API route for create
    console.log('Creating customer via API...')
    setIsCreating(true)
    fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    }).then(res => res.json()).then(result => {
      console.log('Create API result:', result)
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['customers'] })
        queryClient.refetchQueries({ queryKey: ['customers', page, searchTerm] })
        setIsCreateOpen(false)
        setFormData(emptyForm)
        toast({
          title: "Berhasil",
          description: "Customer berhasil ditambahkan",
        })
      } else {
        toast({
          title: "Gagal",
          description: result.error || "Gagal menambahkan customer",
          variant: "destructive",
        })
      }
    }).catch(error => {
      console.error('Create API error:', error)
      toast({
        title: "Error",
        description: "Terjadi kesalahan saat menambahkan customer",
        variant: "destructive",
      })
    }).finally(() => {
      setIsCreating(false)
    })
    
    // createMutation.mutate(formData)
  }

  const handleEdit = (customer: any) => {
    setEditingId(customer.customer_id)
    setFormData({
      customer_name: customer.customer_name,
      primary_contact_person: customer.primary_contact_person,
      phone_number: customer.phone_number,
      email: customer.email,
      billing_address: customer.billing_address,
      notes: customer.notes || ''
    })
    setIsEditOpen(true)
  }

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault()
    if (editingId) {
      console.log('Updating customer via API...')
      setIsUpdating(true)
      fetch(`/api/customers/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      }).then(res => res.json()).then(result => {
        console.log('Update API result:', result)
        if (result.success) {
          queryClient.invalidateQueries({ queryKey: ['customers'] })
          queryClient.refetchQueries({ queryKey: ['customers', page, searchTerm] })
          setIsEditOpen(false)
          setFormData(emptyForm)
          setEditingId(null)
          toast({
            title: "Berhasil",
            description: "Customer berhasil diupdate",
          })
        } else {
          toast({
            title: "Gagal",
            description: result.error || "Gagal mengupdate customer",
            variant: "destructive",
          })
        }
      }).catch(error => {
        console.error('Update API error:', error)
        toast({
          title: "Error",
          description: "Terjadi kesalahan saat mengupdate customer",
          variant: "destructive",
        })
      }).finally(() => {
        setIsUpdating(false)
      })
    }
  }

  const handleDelete = (id: string) => {
    setDeletingId(id)
    setIsDeleteOpen(true)
  }

  const confirmDelete = () => {
    if (deletingId) {
      console.log('Deleting customer via API...')
      setIsDeleting(true)
      
      // Optimistic UI - hapus item dari array sebelum API call
      handleArrayAction({ type: 'remove', item: {}, id: deletingId })
      
      fetch(`/api/customers/${deletingId}`, {
        method: 'DELETE',
      }).then(res => res.json()).then(result => {
        console.log('Delete API result:', result)
        if (result.success) {
          queryClient.invalidateQueries({ queryKey: ['customers'] })
          queryClient.refetchQueries({ queryKey: ['customers', page, searchTerm] })
          setIsDeleteOpen(false)
          setDeletingId(null)
          toast({
            title: "Berhasil",
            description: "Customer berhasil dihapus",
          })
        } else {
          // Jika gagal, refresh data untuk mengembalikan item yang terhapus
          queryClient.refetchQueries({ queryKey: ['customers', page, searchTerm] })
          toast({
            title: "Gagal",
            description: result.error || "Gagal menghapus customer",
            variant: "destructive",
          })
        }
      }).catch(error => {
        console.error('Delete API error:', error)
        // Jika error, refresh data untuk mengembalikan item yang terhapus
        queryClient.refetchQueries({ queryKey: ['customers', page, searchTerm] })
        toast({
          title: "Error",
          description: "Terjadi kesalahan saat menghapus customer",
          variant: "destructive",
        })
      }).finally(() => {
        setIsDeleting(false)
      })
    }
  }

  const totalPages = data ? Math.ceil(data.pagination.total / itemsPerPage) : 0

  return (
    <>
      <ResourceHints
        domains={['api.supabase.co', 'fonts.googleapis.com', 'fonts.gstatic.com']}
      />
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Manajemen Customer</h1>
            <p className="text-muted-foreground mt-1">
              Kelola data customer dan informasi kontak
            </p>
          </div>
          <LoadingOverlay isLoading={isCreating || isUpdating || isDeleting}>
            <Button onClick={() => setIsCreateOpen(true)} disabled={isCreating || isUpdating || isDeleting}>
              <Plus className="mr-2 h-4 w-4" />
              Tambah Customer
            </Button>
          </LoadingOverlay>
        </div>

        <div className="flex gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari nama, telepon, email, alamat billing, atau lokasi service..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setPage(1)
              }}
              className="pl-10"
            />
          </div>
        </div>

        <div className="border rounded-lg">
          <LoadingState
            isLoading={isLoading}
            timeout={8000}
            message="Loading customer data..."
            showRetry={true}
            onRetry={() => queryClient.refetchQueries({ queryKey: ['customers', page, searchTerm] })}
            fallback={
              <div className="p-8 text-center">
                <p className="text-muted-foreground">Taking longer than expected to load customer data.</p>
                <Button
                  variant="outline"
                  className="mt-2"
                  onClick={() => queryClient.refetchQueries({ queryKey: ['customers', page, searchTerm] })}
                >
                  Retry
                </Button>
              </div>
            }
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead sortKey="customer_name" currentSort={sortConfig} onSort={requestSort}>
                    Nama Customer
                  </SortableTableHead>
                  <SortableTableHead sortKey="primary_contact_person" currentSort={sortConfig} onSort={requestSort}>
                    Kontak Person
                  </SortableTableHead>
                  <SortableTableHead sortKey="phone_number" currentSort={sortConfig} onSort={requestSort}>
                    Nomor Telepon
                  </SortableTableHead>
                  <SortableTableHead sortKey="email" currentSort={sortConfig} onSort={requestSort}>
                    Email
                  </SortableTableHead>
                  <SortableTableHead sortKey="billing_address" currentSort={sortConfig} onSort={requestSort}>
                    Alamat Billing
                  </SortableTableHead>
                  <TableHead>Lokasi Service</TableHead>
                  <TableHead>Catatan</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableSkeleton rows={5} columns={8} />
                ) : optimisticCustomers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center">
                      Tidak ada data customer
                    </TableCell>
                  </TableRow>
                ) : (
                  optimisticCustomers.map((customer) => {
                    const locations = customer.locations || []
                    const locationsCount = locations.length
                    const totalAcUnits = locations.reduce((sum: number, loc: any) => 
                      sum + (loc.ac_units?.length || 0), 0
                    )
                    
                    return (
                      <TableRow
                        key={customer.customer_id}
                        className={deletingId === customer.customer_id ? "opacity-50" : ""}
                      >
                        <TableCell className="font-medium">
                          {customer.customer_name}
                        </TableCell>
                        <TableCell>{customer.primary_contact_person}</TableCell>
                        <TableCell>{customer.phone_number}</TableCell>
                        <TableCell>{customer.email}</TableCell>
                        <TableCell>{customer.billing_address}</TableCell>
                        <TableCell>
                          {locationsCount === 0 ? (
                            <Badge variant="secondary" className="gap-1">
                              <MapPin className="w-3 h-3" />
                              0 lokasi
                            </Badge>
                          ) : (
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 gap-1">
                                  <MapPin className="w-4 h-4" />
                                  {locationsCount} lokasi
                                  {totalAcUnits > 0 && (
                                    <Badge variant="secondary" className="ml-1">
                                      {totalAcUnits} AC
                                    </Badge>
                                  )}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-80" align="start">
                                <div className="space-y-3">
                                  <div className="flex items-center gap-2 pb-2 border-b">
                                    <Building2 className="w-4 h-4 text-muted-foreground" />
                                    <h4 className="font-semibold text-sm">
                                      Lokasi Service ({locationsCount})
                                    </h4>
                                  </div>
                                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                    {locations.map((loc: any, idx: number) => (
                                      <div 
                                        key={loc.location_id} 
                                        className="p-2 rounded-md bg-muted/50 hover:bg-muted transition-colors"
                                      >
                                        <div className="flex items-start gap-2">
                                          <div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold flex-shrink-0 mt-0.5">
                                            {idx + 1}
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <div className="font-medium text-sm">
                                              {loc.building_name}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                              Floor {loc.floor}
                                              {loc.room_number && ` • Room ${loc.room_number}`}
                                            </div>
                                            {loc.description && (
                                              <div className="text-xs text-muted-foreground mt-1">
                                                {loc.description}
                                              </div>
                                            )}
                                            {loc.ac_units && loc.ac_units.length > 0 && (
                                              <Badge variant="outline" className="mt-1 text-xs">
                                                {loc.ac_units.length} AC unit{loc.ac_units.length > 1 ? 's' : ''}
                                              </Badge>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </PopoverContent>
                            </Popover>
                          )}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {customer.notes || '-'}
                        </TableCell>
                      <TableCell className="text-right w-[180px]">
                        <div className="flex justify-end gap-2">
                          <LoadingOverlay isLoading={isUpdating && editingId === customer.customer_id}>
                            <Button
                              variant="outline"
                              className="group relative overflow-hidden transition-all duration-300 ease-in-out w-10 hover:w-24 flex items-center justify-start px-2"
                              onClick={() => handleEdit(customer)}
                              disabled={isDeleting}
                            >
                              <Pencil className="h-4 w-4 flex-shrink-0" />
                              <span className="ml-2 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                Ubah
                              </span>
                            </Button>
                          </LoadingOverlay>
                          <LoadingOverlay isLoading={isDeleting && deletingId === customer.customer_id}>
                            <Button
                              variant="destructive"
                              className="group relative overflow-hidden transition-all duration-300 ease-in-out w-10 hover:w-28 flex items-center justify-start px-2"
                              onClick={() => handleDelete(customer.customer_id)}
                              disabled={isUpdating}
                            >
                              <Trash2 className="h-4 w-4 flex-shrink-0" />
                              <span className="ml-2 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                Hapus
                              </span>
                            </Button>
                          </LoadingOverlay>
                        </div>
                      </TableCell>
                    </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </LoadingState>
        </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <Button
            variant="outline"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Previous
          </Button>
          <span className="flex items-center px-4">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Next
          </Button>
        </div>
      )}

      {/* Create Dialog */}
      <Sheet open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Tambah Customer Baru</SheetTitle>
            <SheetDescription>
              Lengkapi informasi customer di bawah ini
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={handleCreate} className="space-y-4 mt-4">
            <div>
              <Label htmlFor="customer_name">Nama Customer *</Label>
              <Input
                id="customer_name"
                value={formData.customer_name}
                onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="primary_contact_person">Kontak Person *</Label>
              <Input
                id="primary_contact_person"
                value={formData.primary_contact_person}
                onChange={(e) => setFormData({ ...formData, primary_contact_person: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="phone_number">Nomor Telepon *</Label>
              <Input
                id="phone_number"
                type="tel"
                value={formData.phone_number}
                onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="billing_address">Alamat Billing *</Label>
              <Textarea
                id="billing_address"
                value={formData.billing_address}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, billing_address: e.target.value })}
                required
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="notes">Catatan</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsCreateOpen(false)
                  setFormData(emptyForm)
                }}
              >
                Batal
              </Button>
              <Button type="submit" disabled={isCreating}>
                {isCreating ? 'Menyimpan...' : 'Simpan'}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {/* Edit Dialog */}
      <Sheet open={isEditOpen} onOpenChange={setIsEditOpen}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit Customer</SheetTitle>
            <SheetDescription>
              Perbarui informasi customer
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={handleUpdate} className="space-y-4 mt-4">
            <div>
              <Label htmlFor="edit_customer_name">Nama Customer *</Label>
              <Input
                id="edit_customer_name"
                value={formData.customer_name}
                onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="edit_primary_contact_person">Kontak Person *</Label>
              <Input
                id="edit_primary_contact_person"
                value={formData.primary_contact_person}
                onChange={(e) => setFormData({ ...formData, primary_contact_person: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="edit_phone_number">Nomor Telepon *</Label>
              <Input
                id="edit_phone_number"
                type="tel"
                value={formData.phone_number}
                onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="edit_email">Email *</Label>
              <Input
                id="edit_email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="edit_billing_address">Alamat Billing *</Label>
              <Textarea
                id="edit_billing_address"
                value={formData.billing_address}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, billing_address: e.target.value })}
                required
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="edit_notes">Catatan</Label>
              <Textarea
                id="edit_notes"
                value={formData.notes}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsEditOpen(false)
                  setFormData(emptyForm)
                  setEditingId(null)
                }}
              >
                Batal
              </Button>
              <Button type="submit" disabled={isUpdating}>
                {isUpdating ? 'Menyimpan...' : 'Simpan'}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Hapus</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus customer ini? 
              Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingId(null)}>
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Menghapus...' : 'Hapus'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </>
  )
}
