import { Mail, Phone } from 'lucide-react'
import type { TechnicianProfileData } from './profile-types'
import { getInitials } from './profile-types'

export function ProfileInfoSection({ technician }: { technician: TechnicianProfileData }) {
  const initials = getInitials(technician?.technician_name ?? '')

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-border dark:bg-surface-muted dark:border-border space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary text-white text-xl font-semibold dark:bg-brand-500">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-bold text-xl truncate dark:text-foreground">{technician?.technician_name ?? 'Teknisi'}</h2>
          {technician?.company && (
            <p className="text-sm text-muted-foreground truncate dark:text-muted-foreground">{technician.company}</p>
          )}
        </div>
      </div>

      <div className="space-y-3 pt-4 border-t border-border dark:border-border">
        {technician?.contact_number && (
          <div className="flex items-center gap-3 text-sm dark:text-muted-foreground">
            <Phone className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
            <span className="truncate font-medium">{technician.contact_number}</span>
          </div>
        )}
        {technician?.email && (
          <div className="flex items-center gap-3 text-sm dark:text-muted-foreground">
            <Mail className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
            <span className="truncate font-medium">{technician.email}</span>
          </div>
        )}
      </div>
    </div>
  )
}
