'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { User, Plus, Search, Pencil, Trash2, Loader2, Mail } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { SortableTableHead } from '@/components/ui/sortable-table-head'
import { useSortableTable } from '@/hooks/use-sortable-table'
import { EmptyState } from '@/components/ui/empty-state'
import { TableSkeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
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
import { SearchableSelect } from '@/components/ui/searchable-select'
import { useToast } from '@/hooks/use-toast'
import { createClient } from '@/lib/supabase-browser'
import { 
  getUsers, 
  createUser, 
  updateUser, 
  toggleUserStatus, 
  deleteUser,
  inviteUser,
  resendInvite,
  type User as UserType 
} from '@/lib/actions/users'
import type { UserRole } from '@/lib/auth-roles'

export default function ManajemenUserPage() {
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
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)

  // Apply sorting
  const { sortedData: usersSorted, sortConfig, requestSort } = useSortableTable(usersBase as unknown as Record<string, unknown>[], {
    key: 'full_name',
    direction: 'asc'
  })
  const users = usersSorted as unknown as UserType[]
  
  // Form state
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    role: 'ADMIN',
  })
  const [inviteFormData, setInviteFormData] = useState({
    email: '',
    role: 'ADMIN' as UserRole,
  })

  const { toast } = useToast()

  // Load users
  const loadUsers = async () => {
    setIsLoading(true)
    const { users: data, error } = await getUsers()
    if (error) {
      toast({
        title: 'Error',
        description: error,
        variant: 'destructive',
      })
    } else {
      setUsers(data)
    }
    setIsLoading(false)
  }

  useEffect(() => {
    loadUsers()
    const loadCurrentRole = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('user_management')
        .select('role, is_active')
        .eq('auth_user_id', user.id)
        .single()

      setIsSuperAdmin(profile?.role === 'SUPERADMIN' && profile?.is_active === true)
    }
    loadCurrentRole()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Filter users based on search
  const filteredUsers = users.filter(user => 
    user.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.role.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Reset form
  const resetForm = () => {
    setFormData({
      full_name: '',
      email: '',
      password: '',
      role: 'ADMIN',
    })
    setEditingUser(null)
  }

  const resetInviteForm = () => {
    setInviteFormData({
      email: '',
      role: 'ADMIN' as UserRole,
    })
  }

  const getUserStatusLabel = (user: UserType) => {
    if (user.row_type === 'invite') return 'Menunggu Konfirmasi'
    return user.is_active ? 'Aktif' : 'Nonaktif'
  }

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsInviteSubmitting(true)

    const result = await inviteUser(inviteFormData)

    if (result.success) {
      toast({
        title: 'Berhasil',
        description: 'Undangan user berhasil dikirim',
      })
      setIsInviteDialogOpen(false)
      resetInviteForm()
      loadUsers()
    } else {
      toast({
        title: 'Error',
        description: result.error || 'Gagal mengirim undangan',
        variant: 'destructive',
      })
    }

    setIsInviteSubmitting(false)
  }

  const handleResendInvite = async (inviteId: string) => {
    const result = await resendInvite(inviteId)

    if (result.success) {
      toast({
        title: 'Berhasil',
        description: 'Undangan berhasil dikirim ulang',
      })
      loadUsers()
    } else {
      toast({
        title: 'Error',
        description: result.error || 'Gagal mengirim ulang undangan',
        variant: 'destructive',
      })
    }
  }

  // Handle create/update user
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    if (editingUser) {
      // Update existing user
      const result = await updateUser({
        user_id: editingUser.user_id,
        full_name: formData.full_name,
        role: formData.role,
      })

      if (result.success) {
        toast({
          title: 'Berhasil',
          description: 'User berhasil diupdate',
        })
        setIsDialogOpen(false)
        resetForm()
        loadUsers()
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Gagal mengupdate user',
          variant: 'destructive',
        })
      }
    } else {
      // Create new user
      if (!formData.password) {
        toast({
          title: 'Error',
          description: 'Password harus diisi',
          variant: 'destructive',
        })
        setIsSubmitting(false)
        return
      }

      const result = await createUser(formData)

      if (result.success) {
        toast({
          title: 'Berhasil',
          description: 'User berhasil ditambahkan',
        })
        setIsDialogOpen(false)
        resetForm()
        loadUsers()
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Gagal menambahkan user',
          variant: 'destructive',
        })
      }
    }

    setIsSubmitting(false)
  }

  // Handle edit user
  const handleEdit = (user: UserType) => {
    setEditingUser(user)
    setFormData({
      full_name: user.full_name,
      email: user.email,
      password: '',
      role: user.role,
    })
    setIsDialogOpen(true)
  }

  // Handle toggle status
  const handleToggleStatus = async (userId: string, currentStatus: boolean) => {
    const result = await toggleUserStatus(userId, !currentStatus)
    
    if (result.success) {
      toast({
        title: 'Berhasil',
        description: `User berhasil ${!currentStatus ? 'diaktifkan' : 'dinonaktifkan'}`,
      })
      loadUsers()
    } else {
      toast({
        title: 'Error',
        description: result.error || 'Gagal mengubah status user',
        variant: 'destructive',
      })
    }
  }

  // Handle delete user
  const handleDelete = async (userId: string) => {
    setUserToDelete(userId)
    setIsDeleteDialogOpen(true)
  }

  // Confirm delete
  const confirmDelete = async () => {
    if (!userToDelete) return
    
    setIsDeleting(true)
    const result = await deleteUser(userToDelete)
    
    if (result.success) {
      toast({
        title: 'Berhasil',
        description: 'User berhasil dihapus dari sistem',
      })
      loadUsers()
    } else {
      toast({
        title: 'Error',
        description: result.error || 'Gagal menghapus user',
        variant: 'destructive',
      })
    }
    
    setIsDeleting(false)
    setIsDeleteDialogOpen(false)
    setUserToDelete(null)
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2">
          <User className="h-6 w-6" />
          <h1 className="text-2xl sm:text-3xl font-bold">Manajemen User</h1>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          {isSuperAdmin && (
            <Dialog open={isInviteDialogOpen} onOpenChange={(open) => {
              setIsInviteDialogOpen(open)
              if (!open) resetInviteForm()
            }}>
              <DialogTrigger asChild>
                <Button className="w-full sm:w-auto">
                  <Mail className="mr-2 h-4 w-4" />
                  Undang Pengguna
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[calc(100vw-2rem)] max-w-lg sm:w-full">
                <form onSubmit={handleInviteSubmit}>
                  <DialogHeader>
                    <DialogTitle>Undang Pengguna</DialogTitle>
                    <DialogDescription>
                      Kirim undangan email untuk membuat akses user baru.
                    </DialogDescription>
                  </DialogHeader>

                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="invite_email">Email</Label>
                    <Input
                      id="invite_email"
                      type="email"
                      value={inviteFormData.email}
                      onChange={(e) => setInviteFormData({ ...inviteFormData, email: e.target.value })}
                      required
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="invite_role">Role</Label>
                    <SearchableSelect
                      options={[
                        { id: 'SUPERADMIN', label: 'Super Admin' },
                        { id: 'ADMIN', label: 'Admin' },
                        { id: 'FINANCE', label: 'Finance' },
                        { id: 'TECHNICIAN', label: 'Technician' },
                      ]}
                      value={inviteFormData.role}
                      onValueChange={(value) => setInviteFormData({ ...inviteFormData, role: value as UserRole })}
                      placeholder="Pilih role"
                      searchPlaceholder="Cari role..."
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsInviteDialogOpen(false)} disabled={isInviteSubmitting}>
                    Batal
                  </Button>
                  <Button type="submit" disabled={isInviteSubmitting}>
                    {isInviteSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Kirim Undangan
                  </Button>
                </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open)
            if (!open) resetForm()
          }}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full sm:w-auto">
                <Plus className="mr-2 h-4 w-4" />
                Tambah User
              </Button>
            </DialogTrigger>
          <DialogContent className="w-[calc(100vw-2rem)] max-w-lg sm:w-full">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>
                  {editingUser ? 'Edit User' : 'Tambah User Baru'}
                </DialogTitle>
                <DialogDescription>
                  {editingUser 
                    ? 'Update informasi user yang sudah ada' 
                    : 'Tambahkan user baru ke sistem'}
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="full_name">Nama Lengkap</Label>
                  <Input
                    id="full_name"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    disabled={!!editingUser}
                    required
                  />
                </div>

                {!editingUser && (
                  <div className="grid gap-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required
                    />
                  </div>
                )}

                <div className="grid gap-2">
                  <Label htmlFor="role">Role</Label>
                  <SearchableSelect
                    options={[
                      { id: 'SUPERADMIN', label: 'Super Admin' },
                      { id: 'ADMIN', label: 'Admin' },
                      { id: 'FINANCE', label: 'Finance' },
                    ]}
                    value={formData.role}
                    onValueChange={(value) => setFormData({ ...formData, role: value })}
                    placeholder="Pilih role"
                    searchPlaceholder="Cari role..."
                  />
                  {!editingUser && (
                    <p className="text-sm text-muted-foreground">
                      Untuk menambah teknisi, gunakan halaman Technicians.
                    </p>
                  )}
                </div>
              </div>

              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsDialogOpen(false)}
                  disabled={isSubmitting}
                >
                  Batal
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingUser ? 'Update' : 'Tambah'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
          </Dialog>
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
          <div className="mb-4 flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <Input 
              placeholder="Cari user..." 
              className="max-w-full sm:max-w-sm" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          {/* Desktop Table View */}
            <div className="hidden md:block data-table-container overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead sortKey="user_id" currentSort={sortConfig} onSort={requestSort} className="min-w-[100px]">
                    User ID
                  </SortableTableHead>
                  <SortableTableHead sortKey="full_name" currentSort={sortConfig} onSort={requestSort} className="min-w-[150px]">
                    Nama Lengkap
                  </SortableTableHead>
                  <SortableTableHead sortKey="email" currentSort={sortConfig} onSort={requestSort} className="min-w-[200px]">
                    Email
                  </SortableTableHead>
                  <SortableTableHead sortKey="role" currentSort={sortConfig} onSort={requestSort} className="min-w-[100px]">
                    Role
                  </SortableTableHead>
                  <SortableTableHead sortKey="is_active" currentSort={sortConfig} onSort={requestSort} className="min-w-[120px]">
                    Status
                  </SortableTableHead>
                  <TableHead className="text-right min-w-[120px]">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="p-0">
                      <TableSkeleton rows={6} columns={6} />
                    </TableCell>
                  </TableRow>
                ) : filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="p-0">
                      <EmptyState
                        icon={User}
                        title={searchQuery ? 'Tidak ditemukan' : 'Belum ada user'}
                        description={
                          searchQuery
                            ? 'Coba ubah kata kunci pencarian.'
                            : 'Tambahkan user pertama untuk mulai mengelola akses sistem.'
                        }
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.user_id}>
                      <TableCell className="font-mono text-sm font-medium">
                        {user.user_id}
                      </TableCell>
                      <TableCell className="font-medium">{user.full_name}</TableCell>
                      <TableCell className="text-muted-foreground">{user.email}</TableCell>
                      <TableCell>
                        <Badge variant={
                          user.role === 'SUPERADMIN' ? 'destructive' :
                          user.role === 'ADMIN' ? 'default' :
                          'secondary'
                        }>
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {user.row_type === 'invite' ? (
                            <Badge variant="secondary">{getUserStatusLabel(user)}</Badge>
                          ) : (
                            <>
                              <Switch
                                checked={user.is_active}
                                onCheckedChange={() => handleToggleStatus(user.user_id, user.is_active)}
                              />
                              <span className="text-sm">{getUserStatusLabel(user)}</span>
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right w-[180px]">
                        <div className="flex justify-end gap-2">
                          {user.row_type === 'invite' ? (
                            <Button variant="outline" size="sm" onClick={() => user.invite_id && handleResendInvite(user.invite_id)}>
                              Kirim Ulang
                            </Button>
                          ) : (
                            <>
                              <Button
                                variant="outline"
                                className="group relative overflow-hidden transition-all duration-300 ease-in-out w-10 hover:w-24 flex items-center justify-start px-2"
                                onClick={() => handleEdit(user)}
                              >
                                <Pencil className="h-4 w-4 flex-shrink-0" />
                                <span className="ml-2 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                  Ubah
                                </span>
                              </Button>
                              <Button
                                variant="destructive"
                                className="group relative overflow-hidden transition-all duration-300 ease-in-out w-10 hover:w-28 flex items-center justify-start px-2"
                                onClick={() => handleDelete(user.user_id)}
                              >
                                <Trash2 className="h-4 w-4 flex-shrink-0" />
                                <span className="ml-2 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                  Hapus
                                </span>
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-4">
            {isLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Card key={i} className="p-4">
                    <div className="space-y-3">
                      <div className="h-4 w-32 rounded bg-muted animate-pulse" />
                      <div className="h-3 w-48 rounded bg-muted animate-pulse" />
                      <div className="h-8 w-full rounded bg-muted animate-pulse" />
                    </div>
                  </Card>
                ))}
              </div>
            ) : filteredUsers.length === 0 ? (
              <EmptyState
                icon={User}
                title={searchQuery ? 'Tidak ditemukan' : 'Belum ada user'}
                description={
                  searchQuery
                    ? 'Coba ubah kata kunci pencarian.'
                    : 'Tambahkan user pertama untuk mulai mengelola akses sistem.'
                }
              />
            ) : (
              filteredUsers.map((user) => (
                <Card key={user.user_id} className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-mono text-muted-foreground">{user.user_id}</p>
                        <h3 className="font-semibold">{user.full_name}</h3>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      </div>
                      <Badge variant={
                        user.role === 'SUPERADMIN' ? 'destructive' :
                        user.role === 'ADMIN' ? 'default' :
                        'secondary'
                      }>
                        {user.role}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="flex items-center gap-2">
                        {user.row_type === 'invite' ? (
                          <Badge variant="secondary">{getUserStatusLabel(user)}</Badge>
                        ) : (
                          <>
                            <Switch
                              checked={user.is_active}
                              onCheckedChange={() => handleToggleStatus(user.user_id, user.is_active)}
                            />
                            <span className="text-sm font-medium">{getUserStatusLabel(user)}</span>
                          </>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {user.row_type === 'invite' ? (
                          <Button variant="outline" size="sm" onClick={() => user.invite_id && handleResendInvite(user.invite_id)}>
                            Kirim Ulang
                          </Button>
                        ) : (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(user)}
                            >
                              <Pencil className="h-3 w-3 mr-1" />
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(user.user_id)}
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              Hapus
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus User Permanen</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus user ini secara permanen? 
              <br /><br />
              <strong>Peringatan:</strong> User akan dihapus dari database dan tidak bisa login lagi. 
              Data user dan riwayat aktivitas akan hilang permanen.
              <br /><br />
              Jika Anda hanya ingin menonaktifkan user sementara, gunakan <strong>Toggle Status</strong> sebagai gantinya.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isDeleting ? 'Menghapus...' : 'Ya, Hapus Permanen'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
