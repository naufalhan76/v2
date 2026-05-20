import type { User } from '@supabase/supabase-js'
import { createClient } from './supabase-server'
import { getUserRole } from './auth'

export type UserRole = 'SUPERADMIN' | 'ADMIN' | 'TECHNICIAN' | 'FINANCE'

type AccessUser = {
  role?: UserRole | null
}

type AccessInvoice = {
  created_by?: string | null
  customer_id?: string | null
}

type AccessCustomer = {
  customer_id?: string | null
  created_by?: string | null
}

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

export async function requireFinanceRole(user: User | null): Promise<void> {
  if (!user) {
    throw new Error('Unauthorized: Finance role required')
  }

  const client = await createClient()
  const { data, error } = await client
    .from('user_management')
    .select('role')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (error || !data?.role || !['SUPERADMIN', 'ADMIN', 'FINANCE'].includes(data.role)) {
    throw new Error('Unauthorized: Finance role required')
  }
}

export function canAccessInvoice(user: AccessUser | null, invoice: AccessInvoice | null): boolean {
  // TODO: extend with ownership check when multi-tenant
  void invoice

  if (!user?.role) return false

  return user.role === 'SUPERADMIN' || user.role === 'ADMIN' || user.role === 'FINANCE'
}

export function canAccessCustomer(user: AccessUser | null, customer: AccessCustomer | null): boolean {
  // TODO: extend with ownership check when multi-tenant
  void customer

  if (!user?.role) return false

  return user.role === 'SUPERADMIN' || user.role === 'ADMIN' || user.role === 'FINANCE'
}
