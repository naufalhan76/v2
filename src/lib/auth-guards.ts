import 'server-only'

import { createClient } from '@/lib/supabase-server'
import type { UserProfile, UserRole } from '@/lib/auth-roles'

export class AuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthError'
  }
}

export async function getCurrentUserProfile(): Promise<UserProfile | null> {
  const client = await createClient()
  const {
    data: { user },
  } = await client.auth.getUser()

  if (!user) return null

  const { data, error } = await client
    .from('user_management')
    .select('auth_user_id,email,full_name,role,is_active')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (error || !data || data.is_active !== true) return null

  return data as UserProfile
}

export async function requireUserProfile(): Promise<UserProfile> {
  const profile = await getCurrentUserProfile()

  if (!profile) {
    throw new AuthError('Unauthorized: active user profile required')
  }

  return profile
}

export async function requireRole(role: UserRole): Promise<UserProfile> {
  const profile = await requireUserProfile()

  if (profile.role !== role) {
    throw new AuthError(`Unauthorized: ${role} role required`)
  }

  return profile
}

export async function requireAnyRole(roles: readonly UserRole[]): Promise<UserProfile> {
  const profile = await requireUserProfile()

  if (!roles.includes(profile.role)) {
    throw new AuthError(`Unauthorized: one of ${roles.join(', ')} roles required`)
  }

  return profile
}

export function requireSuperAdmin(): Promise<UserProfile> {
  return requireAnyRole(['SUPERADMIN'])
}

export function requireFinanceAccess(): Promise<UserProfile> {
  return requireAnyRole(['SUPERADMIN', 'ADMIN', 'FINANCE'])
}
