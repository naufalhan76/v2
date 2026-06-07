import { UserCircle2 } from 'lucide-react'
import { ProfileContent } from '@/components/technician/profile-content'
import { SyncStatus } from '@/components/technician/sync-status'

export default function TechnicianProfilePage() {
  return (
    <div className="min-h-full bg-background -mx-4 -my-4" data-testid="technician-profile">
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-start gap-3 pt-2">
          <div className="hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <UserCircle2 className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight">Profil</h1>
            <p className="text-xs text-muted-foreground">Kelola akun dan preferensi kamu</p>
          </div>
          <SyncStatus variant="compact" className="shrink-0 mt-0.5" />
        </div>
      </div>

      <div className="px-4 pb-4">
        <ProfileContent />
      </div>
    </div>
  )
}
