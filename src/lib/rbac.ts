import { getUserRole } from './auth'

export type UserRole = 'SUPERADMIN' | 'ADMIN' | 'TECHNICIAN' | 'FINANCE'

export async function isSuperAdmin(): Promise<boolean> {
  const role = await getUserRole()
  return role === 'SUPERADMIN'
}

export async function isAdmin(): Promise<boolean> {
  const role = await getUserRole()
  return role === 'ADMIN' || role === 'SUPERADMIN'
}

export async function isTechnician(): Promise<boolean> {
  const role = await getUserRole()
  return role === 'TECHNICIAN'
}

export async function isFinance(): Promise<boolean> {
  const role = await getUserRole()
  return role === 'FINANCE'
}

export function hasAccess(userRole: UserRole | null, requiredRole: UserRole): boolean {
  if (!userRole) return false
  
  const roleHierarchy = {
    SUPERADMIN: 4,
    ADMIN: 3,
    TECHNICIAN: 2,
    FINANCE: 2
  }
  
  return roleHierarchy[userRole] >= roleHierarchy[requiredRole]
}

export function canManageUsers(userRole: UserRole | null): boolean {
  if (!userRole) return false
  return userRole === 'SUPERADMIN' || userRole === 'ADMIN'
}

export function canViewAllUsers(userRole: UserRole | null): boolean {
  if (!userRole) return false
  return userRole === 'SUPERADMIN'
}

export function getVisibleRoles(userRole: UserRole | null): UserRole[] {
  if (!userRole) return []
  
  if (userRole === 'SUPERADMIN') {
    return ['SUPERADMIN', 'ADMIN', 'TECHNICIAN', 'FINANCE']
  }
  
  if (userRole === 'ADMIN') {
    return ['TECHNICIAN', 'FINANCE']
  }
  
  return []
}