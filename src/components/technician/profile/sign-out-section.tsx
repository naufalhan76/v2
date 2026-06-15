import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
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

interface SignOutSectionProps {
  loggingOut: boolean
  confirmOpen: boolean
  onConfirmOpenChange: (open: boolean) => void
  onLogout: () => void
}

export function SignOutSection({ loggingOut, confirmOpen, onConfirmOpenChange, onLogout }: SignOutSectionProps) {
  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => onConfirmOpenChange(true)}
        disabled={loggingOut}
        className="w-full bg-status-cancelled-bg text-status-cancelled font-semibold py-4 rounded-xl border-2 border-status-cancelled/30 hover:bg-status-cancelled-bg hover:text-status-cancelled transition-colors h-auto dark:bg-status-cancelled-bg dark:border-status-cancelled dark:text-status-cancelled dark:hover:bg-status-cancelled-bg"
      >
        <LogOut className="mr-2 h-5 w-5" aria-hidden="true" />
        Keluar Akun
      </Button>

      <p className="text-center text-xs text-muted-foreground dark:text-muted-foreground pt-2 font-medium">
        MSN Tech v2.0.0-beta
      </p>

      <AlertDialog open={confirmOpen} onOpenChange={onConfirmOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-destructive text-destructive-foreground">
                <LogOut className="h-4 w-4" aria-hidden="true" />
              </span>
              Keluar dari akun?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Kamu perlu masuk lagi untuk mengakses pekerjaan dan notifikasi. Sinkronisasi
              offline tetap aman di perangkat ini.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loggingOut} className="cursor-pointer">
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={onLogout}
              disabled={loggingOut}
              className="bg-destructive text-destructive-foreground hover:bg-destructive cursor-pointer"
            >
              {loggingOut ? 'Memproses...' : 'Ya, keluar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
