'use client'

import { Loader2 } from 'lucide-react'
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

interface DeactivateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  isDeleting: boolean
}

export function DeactivateDialog({
  open,
  onOpenChange,
  onConfirm,
  isDeleting,
}: DeactivateDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
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
            onClick={onConfirm}
            disabled={isDeleting}
            className="bg-destructive hover:bg-destructive/90"
          >
            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isDeleting ? 'Menghapus...' : 'Ya, Hapus Permanen'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
