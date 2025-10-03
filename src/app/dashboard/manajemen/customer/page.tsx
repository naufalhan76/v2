'use client'

import { useEffect, useState } from 'react'
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
  SheetTrigger,
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
import { Plus, Pencil, Trash2, Search } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'

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
          toast({
            title: "Gagal",
            description: result.error || "Gagal menghapus customer",
            variant: "destructive",
          })
        }
      }).catch(error => {
        console.error('Delete API error:', error)
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
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Manajemen Customer</h1>
          <p className="text-muted-foreground mt-1">
            Kelola data customer dan informasi kontak
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Tambah Customer
        </Button>
      </div>

      <div className="flex gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari customer..."
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama Customer</TableHead>
              <TableHead>Kontak Person</TableHead>
              <TableHead>Nomor Telepon</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Alamat Billing</TableHead>
              <TableHead>Catatan</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center">
                  Loading...
                </TableCell>
              </TableRow>
            ) : data?.data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center">
                  Tidak ada data customer
                </TableCell>
              </TableRow>
            ) : (
              data?.data.map((customer) => (
                <TableRow key={customer.customer_id}>
                  <TableCell className="font-medium">
                    {customer.customer_name}
                  </TableCell>
                  <TableCell>{customer.primary_contact_person}</TableCell>
                  <TableCell>{customer.phone_number}</TableCell>
                  <TableCell>{customer.email}</TableCell>
                  <TableCell>{customer.billing_address}</TableCell>
                  <TableCell className="max-w-xs truncate">
                    {customer.notes || '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(customer)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(customer.customer_id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
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
  )
}
