'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { TableSkeleton } from '@/components/ui/skeleton'
import { LoadingState } from '@/components/ui/loading-state'
import { LoadingOverlay } from '@/components/ui/loading-state'
import { useOptimisticArray } from '@/hooks/use-optimistic'
import { useSortableTable } from '@/hooks/use-sortable-table'
import { ResourceHints } from '@/components/ui/priority-components'
import { CustomerFilters } from './_components/customer-filters'
import { CustomerTable } from './_components/customer-table'
import { CustomerFormModal, type CustomerFormData } from './_components/customer-form-modal'
import { DeleteConfirmDialog } from './_components/delete-confirm-dialog'
import { useCustomerActions } from './_components/use-customer-actions'

const itemsPerPage = 10

export default function CustomerManagementPage() {
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState('')
  const [page, setPage] = useState(1)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['customers', page, searchTerm],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page), limit: String(itemsPerPage),
        ...(searchTerm && { search: searchTerm })
      })
      const response = await fetch(`/api/customers?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch customers')
      return await response.json()
    }
  })

  const { optimisticArray: optimisticCustomersBase, handleArrayAction } = useOptimisticArray<Record<string, unknown>>(
    (data?.data || []) as Record<string, unknown>[],
    async ({ type, id }) => {
      if (type === 'remove') {
        const res = await fetch(`/api/customers/${id}`, { method: 'DELETE' })
        const result = await res.json()
        return { success: result.success, data: result.data }
      }
      return { success: true, data: [] }
    }
  )

  const { sortedData: optimisticCustomers, sortConfig, requestSort } = useSortableTable(optimisticCustomersBase, { key: 'customer_name', direction: 'asc' })

  const {
    formData, setFormData, editingId, setEditingId, deletingId, setDeletingId,
    isCreating, isUpdating, isDeleting,
    handleCreate: apiCreate, handleEdit: apiEdit, handleUpdate: apiUpdate, handleDelete: apiDelete, resetForm, emptyForm
  } = useCustomerActions(page, searchTerm)

  const handleSearchChange = (value: string) => { setSearchTerm(value); setPage(1) }
  const totalPages = data ? Math.ceil(data.pagination.total / itemsPerPage) : 0

  const onEdit = (customer: Record<string, unknown>) => { apiEdit(customer); setIsEditOpen(true) }
  const onDelete = (id: string) => { setDeletingId(id); setIsDeleteOpen(true) }
  const onConfirmDelete = () => {
    if (deletingId) { apiDelete(deletingId, handleArrayAction); setIsDeleteOpen(false) }
  }

  return (
    <>
      <ResourceHints domains={['api.supabase.co', 'fonts.googleapis.com', 'fonts.gstatic.com']} />
      <div className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Manajemen Customer</h1>
            <p className="text-muted-foreground mt-1 text-sm sm:text-base">Kelola data customer dan informasi kontak</p>
          </div>
          <LoadingOverlay isLoading={isCreating || isUpdating || isDeleting}>
            <Button onClick={() => setIsCreateOpen(true)} disabled={isCreating || isUpdating || isDeleting} className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />Tambah Customer
            </Button>
          </LoadingOverlay>
        </div>

        <CustomerFilters searchTerm={searchTerm} onSearchChange={handleSearchChange} />

        <LoadingState isLoading={isLoading} timeout={8000} message="Loading customer data..." showRetry
          onRetry={() => queryClient.refetchQueries({ queryKey: ['customers', page, searchTerm] })}
          fallback={
            <div className="p-8 text-center">
              <p className="text-muted-foreground">Taking longer than expected to load customer data.</p>
              <Button variant="outline" className="mt-2" onClick={() => queryClient.refetchQueries({ queryKey: ['customers', page, searchTerm] })}>Retry</Button>
            </div>
          }>
          <CustomerTable customers={optimisticCustomers} isLoading={isLoading} sortConfig={sortConfig} requestSort={requestSort}
            deletingId={deletingId} isDeleting={isDeleting} isUpdating={isUpdating} editingId={editingId}
            onEdit={onEdit} onDelete={onDelete} onAddClick={() => setIsCreateOpen(true)}
            totalPages={totalPages} currentPage={page} onPageChange={setPage} />
        </LoadingState>

        <CustomerFormModal mode="create" open={isCreateOpen} onOpenChange={(o) => { setIsCreateOpen(o); if (!o) { setFormData(emptyForm); setEditingId(null) } }}
          formData={formData} onFormDataChange={setFormData}
          onSubmit={(e) => { e.preventDefault(); if (apiCreate(formData)) setIsCreateOpen(false) }}
          isSubmitting={isCreating} />

        <CustomerFormModal mode="edit" open={isEditOpen} onOpenChange={(o) => { setIsEditOpen(o); if (!o) { setFormData(emptyForm); setEditingId(null) } }}
          formData={formData} onFormDataChange={setFormData}
          onSubmit={(e) => { e.preventDefault(); apiUpdate(formData); setIsEditOpen(false); setEditingId(null) }}
          isSubmitting={isUpdating} />

        <DeleteConfirmDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen} onConfirm={onConfirmDelete} isDeleting={isDeleting} />
      </div>
    </>
  )
}
