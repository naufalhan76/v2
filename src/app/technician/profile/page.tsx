import { UserCircle2 } from 'lucide-react'
import { ProfileContent } from '@/components/technician/profile-content'
import { SyncStatus } from '@/components/technician/sync-status'

export default function TechnicianProfilePage() {
  return (
    <div className="min-h-full bg-bg-gray-faded pb-20" data-testid="technician-profile">
      {/* Header */}
      <div className="bg-navy-deep text-white px-6 pt-12 pb-20 rounded-b-[40px]">
        <div className="flex items-start gap-3">
          <div className="hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20 text-white">
            <UserCircle2 className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold tracking-tight">Profil</h1>
            <p className="text-sm text-gray-300 leading-tight mt-1">Kelola akun dan preferensi kamu</p>
          </div>
          <SyncStatus variant="compact" className="shrink-0 mt-0.5" />
        </div>
      </div>

      <div className="px-6 -mt-10 relative z-10">
        <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-sm">
          <ProfileContent />
        </div>
      </div>
    </div>
  )
}
