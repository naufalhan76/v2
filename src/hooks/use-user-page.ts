'use client'

import { useEffect, useState } from 'react'
import { useToast } from '@/hooks/use-toast'
import { useSortableTable } from '@/hooks/use-sortable-table'
import { getUsers, type User as UserType } from '@/lib/actions/users'
import { toggleUserStatus, deleteUser, inviteUser, updateUser, createUser } from '@/lib/actions/users/users-mutations'

export interface UserFormData {
  full_name: string
  email: string
  role: string
}

export interface InviteFormData {
  email: string
  role: string
}

export function useUserPage() {
  const [usersBase, setUsers] = useState<UserType[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingUser, setEditingUser] = useState<UserType | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [userToDelete, setUserToDelete] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false)
  const [isInviteSubmitting, setIsInviteSubmitting] = useState(false)
  const [formData, setFormData] = useState<UserFormData>({
    full_name: '', email: '', role: 'ADMIN',
  })
  const [inviteFormData, setInviteFormData] = useState<InviteFormData>({
    email: '', role: 'ADMIN',
  })

  const { toast } = useToast()

  const { sortedData: usersSorted, sortConfig, requestSort } = useSortableTable(
    usersBase as unknown as Record<string, unknown>[],
    { key: 'full_name', direction: 'asc' }
  )
  const users = usersSorted as unknown as UserType[]

  const loadUsers = async () => {
    setIsLoading(true)
    const { users: data, error } = await getUsers()
    if (error) {
      toast({ title: 'Error', description: error, variant: 'destructive' })
    } else {
      setUsers(data)
    }
    setIsLoading(false)
  }

  useEffect(() => { loadUsers() }, [])

  const resetForm = () => {
    setFormData({ full_name: '', email: '', role: 'ADMIN' })
    setEditingUser(null)
  }

  const resetInviteForm = () => {
    setInviteFormData({ email: '', role: 'ADMIN' })
  }

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsInviteSubmitting(true)
    const result = await inviteUser(inviteFormData)
    if (result.success) {
      toast({ title: 'Berhasil', description: 'Undangan user berhasil dikirim (email set-password telah terkirim)' })
      setIsInviteDialogOpen(false)
      resetInviteForm()
      loadUsers()
    } else {
      toast({ title: 'Error', description: result.error || 'Gagal mengirim undangan', variant: 'destructive' })
    }
    setIsInviteSubmitting(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    if (editingUser) {
      const result = await updateUser({
        user_id: editingUser.user_id,
        full_name: formData.full_name,
        role: formData.role,
      })
      if (result.success) {
        toast({ title: 'Berhasil', description: 'User berhasil diupdate' })
        setIsDialogOpen(false)
        resetForm()
        loadUsers()
      } else {
        toast({ title: 'Error', description: result.error || 'Gagal mengupdate user', variant: 'destructive' })
      }
    } else {
      const result = await createUser(formData)
      if (result.success) {
        toast({ title: 'Berhasil', description: 'User berhasil ditambahkan (email set-password telah terkirim)' })
        setIsDialogOpen(false)
        resetForm()
        loadUsers()
      } else {
        toast({ title: 'Error', description: result.error || 'Gagal menambahkan user', variant: 'destructive' })
      }
    }
    setIsSubmitting(false)
  }

  const handleEdit = (user: UserType) => {
    setEditingUser(user)
    setFormData({
      full_name: user.full_name,
      email: user.email,
      role: user.role,
    })
    setIsDialogOpen(true)
  }

  const handleToggleStatus = async (userId: string, currentStatus: boolean) => {
    const result = await toggleUserStatus(userId, !currentStatus)
    if (result.success) {
      toast({ title: 'Berhasil', description: `User berhasil ${!currentStatus ? 'diaktifkan' : 'dinonaktifkan'}` })
      loadUsers()
    } else {
      toast({ title: 'Error', description: result.error || 'Gagal mengubah status user', variant: 'destructive' })
    }
  }

  const handleDelete = (userId: string) => {
    setUserToDelete(userId)
    setIsDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!userToDelete) return
    setIsDeleting(true)
    const result = await deleteUser(userToDelete)
    if (result.success) {
      toast({ title: 'Berhasil', description: 'User berhasil dihapus dari sistem' })
      loadUsers()
    } else {
      toast({ title: 'Error', description: result.error || 'Gagal menghapus user', variant: 'destructive' })
    }
    setIsDeleting(false)
    setIsDeleteDialogOpen(false)
    setUserToDelete(null)
  }

  return {
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
  }
}
