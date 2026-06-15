import { Badge } from '@/components/ui/badge'
import type { User } from '@/lib/actions/users'

export function getUserStatusLabel(user: User): string {
  if (user.row_type === 'invite') return 'Menunggu Konfirmasi'
  return user.is_active ? 'Aktif' : 'Nonaktif'
}

interface UserRoleBadgeProps {
  role: string
}

export function UserRoleBadge({ role }: UserRoleBadgeProps) {
  const variant =
    role === 'SUPERADMIN' ? 'destructive' :
    role === 'ADMIN' ? 'default' :
    'secondary'

  return <Badge variant={variant}>{role}</Badge>
}

interface UserStatusBadgeProps {
  user: User
}

export function UserStatusBadge({ user }: UserStatusBadgeProps) {
  if (user.row_type === 'invite') {
    return <Badge variant="secondary">{getUserStatusLabel(user)}</Badge>
  }
  return <span className="text-sm">{getUserStatusLabel(user)}</span>
}
