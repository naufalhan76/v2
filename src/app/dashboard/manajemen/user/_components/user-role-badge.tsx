import { Badge } from '@/components/ui/badge'
import type { User } from '@/lib/actions/users'

export function getUserStatusLabel(user: User): string {
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
  return <span className="text-sm">{getUserStatusLabel(user)}</span>
}
