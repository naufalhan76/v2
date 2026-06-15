'use client'

import { Pencil, Trash2, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SortableTableHead } from '@/components/ui/sortable-table-head'
import { EmptyState } from '@/components/ui/empty-state'
import { TableSkeleton } from '@/components/ui/skeleton'
import type { User as UserType } from '@/lib/actions/users'
import type { SortConfig } from '@/hooks/use-sortable-table'
import { UserRoleBadge, UserStatusBadge } from './user-role-badge'

interface UsersTableProps {
  users: UserType[]
  isLoading: boolean
  searchQuery: string
  sortConfig: SortConfig
  onSort: (key: string) => void
  onToggleStatus: (userId: string, currentStatus: boolean) => void
  onEdit: (user: UserType) => void
  onDelete: (userId: string) => void
  onResendInvite: (inviteId: string) => void
}

export function UsersTable({
  users,
  isLoading,
  searchQuery,
  sortConfig,
  onSort,
  onToggleStatus,
  onEdit,
  onDelete,
  onResendInvite,
}: UsersTableProps) {
  const filteredUsers = users.filter(user =>
    user.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.role.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <>
      {/* Desktop Table View */}
      <div className="hidden md:block data-table-container overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableTableHead sortKey="user_id" currentSort={sortConfig} onSort={onSort} className="min-w-[100px]">
                User ID
              </SortableTableHead>
              <SortableTableHead sortKey="full_name" currentSort={sortConfig} onSort={onSort} className="min-w-[150px]">
                Nama Lengkap
              </SortableTableHead>
              <SortableTableHead sortKey="email" currentSort={sortConfig} onSort={onSort} className="min-w-[200px]">
                Email
              </SortableTableHead>
              <SortableTableHead sortKey="role" currentSort={sortConfig} onSort={onSort} className="min-w-[100px]">
                Role
              </SortableTableHead>
              <SortableTableHead sortKey="is_active" currentSort={sortConfig} onSort={onSort} className="min-w-[120px]">
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
                    <UserRoleBadge role={user.role} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {user.row_type === 'invite' ? (
                        <Badge variant="secondary">
                          {user.row_type === 'invite' ? 'Menunggu Konfirmasi' : (user.is_active ? 'Aktif' : 'Nonaktif')}
                        </Badge>
                      ) : (
                        <>
                          <Switch
                            checked={user.is_active}
                            onCheckedChange={() => onToggleStatus(user.user_id, user.is_active)}
                          />
                          <UserStatusBadge user={user} />
                        </>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right w-[180px]">
                    <div className="flex justify-end gap-2">
                      {user.row_type === 'invite' ? (
                        <Button variant="outline" size="sm" onClick={() => user.invite_id && onResendInvite(user.invite_id)}>
                          Kirim Ulang
                        </Button>
                      ) : (
                        <>
                          <Button
                            variant="outline"
                            className="group relative overflow-hidden transition-all duration-300 ease-in-out w-10 hover:w-24 flex items-center justify-start px-2"
                            onClick={() => onEdit(user)}
                          >
                            <Pencil className="h-4 w-4 flex-shrink-0" />
                            <span className="ml-2 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                              Ubah
                            </span>
                          </Button>
                          <Button
                            variant="destructive"
                            className="group relative overflow-hidden transition-all duration-300 ease-in-out w-10 hover:w-28 flex items-center justify-start px-2"
                            onClick={() => onDelete(user.user_id)}
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
                  <UserRoleBadge role={user.role} />
                </div>

                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="flex items-center gap-2">
                    {user.row_type === 'invite' ? (
                      <Badge variant="secondary">
                        {user.row_type === 'invite' ? 'Menunggu Konfirmasi' : (user.is_active ? 'Aktif' : 'Nonaktif')}
                      </Badge>
                    ) : (
                      <>
                        <Switch
                          checked={user.is_active}
                          onCheckedChange={() => onToggleStatus(user.user_id, user.is_active)}
                        />
                        <span className="text-sm font-medium">
                          {user.is_active ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {user.row_type === 'invite' ? (
                      <Button variant="outline" size="sm" onClick={() => user.invite_id && onResendInvite(user.invite_id)}>
                        Kirim Ulang
                      </Button>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onEdit(user)}
                        >
                          <Pencil className="h-3 w-3 mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onDelete(user.user_id)}
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
    </>
  )
}
