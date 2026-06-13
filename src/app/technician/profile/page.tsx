import { UserCircle2 } from 'lucide-react'
import { ProfileContent } from '@/components/technician/profile-content'
import { SyncStatus } from '@/components/technician/sync-status'

export default function TechnicianProfilePage() {
  return (
    <div className="min-h-full bg-bg-gray-faded dark:bg-[#0f0e1a] pb-20" data-testid="technician-profile">
      {/* Header */}
      <div className="bg-[#211c59] text-white px-6 pt-12 pb-24 rounded-b-[80px]">
        <div className="flex items-start gap-3">
          <div className="hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#2d2a75] text-white">
            <UserCircle2 className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold tracking-tight">Profil</h1>
            <p className="text-sm text-gray-300 leading-tight mt-1">Kelola akun dan preferensi kamu</p>
          </div>
        </div>
      </div>

      <div className="px-6 -mt-10 relative z-10">
        <ProfileContent />
      </div>
    </div>
  )
}
