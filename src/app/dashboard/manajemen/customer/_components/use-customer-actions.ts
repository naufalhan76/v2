import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/use-toast'
import { logger } from '@/lib/logger'

export interface CustomerFormData {
  customer_name: string
  primary_contact_person: string
  phone_number: string
  email: string
  billing_address: string
  notes: string
}

const emptyForm: CustomerFormData = {
  customer_name: '', primary_contact_person: '', phone_number: '',
  email: '', billing_address: '', notes: ''
}

export function useCustomerActions(page: number, searchTerm: string) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [formData, setFormData] = useState<CustomerFormData>(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['customers'] })
    queryClient.refetchQueries({ queryKey: ['customers', page, searchTerm] })
  }

  const handleCreate = (data: CustomerFormData) => {
    if (!data.customer_name.trim() || !data.primary_contact_person.trim() ||
        !data.phone_number.trim() || !data.email.trim() || !data.billing_address.trim()) {
      toast({ title: "Validation Error", description: "Semua field wajib diisi", variant: "destructive" })
      return false
    }
    setIsCreating(true)
    fetch('/api/customers', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(res => res.json()).then(result => {
      if (result.success) { invalidate(); setFormData(emptyForm); toast({ title: "Berhasil", description: "Customer berhasil ditambahkan" }) }
      else toast({ title: "Gagal", description: result.error || "Gagal menambahkan customer", variant: "destructive" })
    }).catch(error => {
      logger.error('Create API error:', error)
      toast({ title: "Error", description: "Terjadi kesalahan saat menambahkan customer", variant: "destructive" })
    }).finally(() => setIsCreating(false))
    return true
  }

  const handleEdit = (customer: Record<string, unknown>) => {
    setEditingId(customer.customer_id as string)
    setFormData({
      customer_name: customer.customer_name as string,
      primary_contact_person: customer.primary_contact_person as string,
      phone_number: customer.phone_number as string,
      email: customer.email as string,
      billing_address: customer.billing_address as string,
      notes: (customer.notes as string) || ''
    })
  }

  const handleUpdate = (data: CustomerFormData) => {
    if (!editingId) return
    setIsUpdating(true)
    fetch(`/api/customers/${editingId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(res => res.json()).then(result => {
      if (result.success) { invalidate(); setFormData(emptyForm); setEditingId(null); toast({ title: "Berhasil", description: "Customer berhasil diupdate" }) }
      else toast({ title: "Gagal", description: result.error || "Gagal mengupdate customer", variant: "destructive" })
    }).catch(error => {
      logger.error('Update API error:', error)
      toast({ title: "Error", description: "Terjadi kesalahan saat mengupdate customer", variant: "destructive" })
    }).finally(() => setIsUpdating(false))
  }

  const handleDelete = (id: string, handleArrayAction: (action: { type: 'add' | 'remove' | 'update'; item: Record<string, unknown>; id?: string }) => Promise<void>) => {
    setDeletingId(id)
    setIsDeleting(true)
    handleArrayAction({ type: 'remove', item: {}, id })
    fetch(`/api/customers/${id}`, { method: 'DELETE' })
      .then(res => res.json()).then(result => {
        if (result.success) { invalidate(); setDeletingId(null); toast({ title: "Berhasil", description: "Customer berhasil dihapus" }) }
        else { queryClient.refetchQueries({ queryKey: ['customers', page, searchTerm] }); toast({ title: "Gagal", description: result.error || "Gagal menghapus customer", variant: "destructive" }) }
      }).catch(() => {
        queryClient.refetchQueries({ queryKey: ['customers', page, searchTerm] })
        toast({ title: "Error", description: "Terjadi kesalahan saat menghapus customer", variant: "destructive" })
      }).finally(() => setIsDeleting(false))
  }

  const resetForm = () => { setFormData(emptyForm); setEditingId(null) }

  return {
    formData, setFormData, editingId, setEditingId, deletingId, setDeletingId,
    isCreating, isUpdating, isDeleting,
    handleCreate, handleEdit, handleUpdate, handleDelete, resetForm,
    emptyForm
  }
}
