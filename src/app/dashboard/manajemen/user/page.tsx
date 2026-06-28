'use client'

import { User } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useUserPage } from '@/hooks/use-user-page'
import { UsersTable } from './_components/users-table'
import { UsersFilters } from './_components/users-filters'
import { UserFormModal, InviteDialog } from './_components/user-form-modal'
import { DeactivateDialog } from './_components/deactivate-dialog'

export default function ManajemenUserPage() {
  const {
    users, isLoading, searchQuery, setSearchQuery,
    sortConfig, requestSort,
    isDialogOpen, setIsDialogOpen, isSubmitting,
    editingUser, formData, setFormData,
    handleSubmit, handleEdit, handleToggleStatus,
    handleDelete, confirmDelete, isDeleteDialogOpen, setIsDeleteDialogOpen,
    isDeleting,
    isInviteDialogOpen, setIsInviteDialogOpen, isInviteSubmitting,
    inviteFormData, setInviteFormData,
    handleInviteSubmit, resetInviteForm,
    resetForm,
  } = useUserPage()

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2">
          <User className="h-6 w-6" />
          <h1 className="text-2xl sm:text-3xl font-bold">Manajemen User</h1>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <InviteDialog
            open={isInviteDialogOpen}
            onOpenChange={(open) => {
              setIsInviteDialogOpen(open)
              if (!open) resetInviteForm()
            }}
            isSubmitting={isInviteSubmitting}
            formData={inviteFormData}
            onFormDataChange={setInviteFormData}
            onSubmit={handleInviteSubmit}
          />
          <UserFormModal
            open={isDialogOpen}
            onOpenChange={(open) => {
              setIsDialogOpen(open)
              if (!open) resetForm()
            }}
            isSubmitting={isSubmitting}
            editingUser={editingUser}
            formData={formData}
            onFormDataChange={setFormData}
            onSubmit={handleSubmit}
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daftar User</CardTitle>
          <CardDescription>
            Kelola user yang memiliki akses ke sistem. Toggle switch untuk mengaktifkan/menonaktifkan akses user.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UsersFilters searchQuery={searchQuery} onSearchChange={setSearchQuery} />
          <UsersTable
            users={users}
            isLoading={isLoading}
            searchQuery={searchQuery}
            sortConfig={sortConfig}
            onSort={requestSort}
            onToggleStatus={handleToggleStatus}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </CardContent>
      </Card>

      <DeactivateDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={confirmDelete}
        isDeleting={isDeleting}
      />
    </div>
  )
}
