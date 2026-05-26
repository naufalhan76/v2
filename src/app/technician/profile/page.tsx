import { ProfileContent } from '@/components/technician/profile-content'

export default function TechnicianProfilePage() {
  return (
    <div className="space-y-4">
      <div className="pt-2">
        <h1 className="text-xl font-semibold">Profil</h1>
      </div>

      <ProfileContent />
    </div>
  )
}
