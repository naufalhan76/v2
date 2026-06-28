'use client'

import { Loader2, Mail, Plus } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SearchableSelect } from '@/components/ui/searchable-select'
import type { User } from '@/lib/actions/users'

export interface UserFormData {
  full_name: string
  email: string
  role: string
}

interface UserFormModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  isSubmitting: boolean
  editingUser: User | null
  formData: UserFormData
  onFormDataChange: (data: UserFormData) => void
  onSubmit: (e: React.FormEvent) => void
}

export function UserFormModal({
  open,
  onOpenChange,
  isSubmitting,
  editingUser,
  formData,
  onFormDataChange,
  onSubmit,
}: UserFormModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          Tambah User
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-lg sm:w-full">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>
              {editingUser ? 'Edit User' : 'Tambah User Baru'}
            </DialogTitle>
            <DialogDescription>
              {editingUser
                ? 'Update informasi user yang sudah ada'
                : 'User akan menerima email set-password dari Clerk.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="full_name">Nama Lengkap</Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) => onFormDataChange({ ...formData, full_name: e.target.value })}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => onFormDataChange({ ...formData, email: e.target.value })}
                disabled={!!editingUser}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="role">Role</Label>
              <SearchableSelect
                options={[
                  { id: 'SUPERADMIN', label: 'Super Admin' },
                  { id: 'ADMIN', label: 'Admin' },
                  { id: 'FINANCE', label: 'Finance' },
                ]}
                value={formData.role}
                onValueChange={(value) => onFormDataChange({ ...formData, role: value })}
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
              onClick={() => onOpenChange(false)}
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
  )
}

export interface InviteFormData {
  email: string
  role: string
}

interface InviteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  isSubmitting: boolean
  formData: InviteFormData
  onFormDataChange: (data: InviteFormData) => void
  onSubmit: (e: React.FormEvent) => void
}

export function InviteDialog({
  open,
  onOpenChange,
  isSubmitting,
  formData,
  onFormDataChange,
  onSubmit,
}: InviteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button className="w-full sm:w-auto">
          <Mail className="mr-2 h-4 w-4" />
          Undang Pengguna
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-lg sm:w-full">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Undang Pengguna</DialogTitle>
            <DialogDescription>
              User akan menerima email untuk mengatur password mereka.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="invite_email">Email</Label>
              <Input
                id="invite_email"
                type="email"
                value={formData.email}
                onChange={(e) => onFormDataChange({ ...formData, email: e.target.value })}
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
                value={formData.role}
                onValueChange={(value) => onFormDataChange({ ...formData, role: value })}
                placeholder="Pilih role"
                searchPlaceholder="Cari role..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Batal
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Kirim Undangan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
