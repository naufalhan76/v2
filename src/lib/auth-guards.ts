import 'server-only'

/**
 * Server-only module for verifying user roles and profiles.
 * This MUST NOT be imported into client components to prevent leaking 
 * service-role privileges or breaking the edge/server boundary.
 */

import { createClient } from '@/lib/supabase-server'
import type { UserProfile, UserRole } from '@/lib/auth-roles'

export class AuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthError'
  }
}

/**
 * Gets the current user profile safely using RLS or explicit matching.
 * Returns null if user is not logged in or inactive.
 */
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

/**
 * Enforces that an active user profile exists.
 * Throws AuthError if unauthorized, otherwise returns the profile.
 */
export async function requireUserProfile(): Promise<UserProfile> {
  const profile = await getCurrentUserProfile()

  if (!profile) {
    throw new AuthError('Unauthorized: active user profile required')
  }

  return profile
}

/**
 * Enforces that the user has an exact role match.
 * Use requireAnyRole for hierarchy checks instead.
 */
export async function requireRole(role: UserRole): Promise<UserProfile> {
  const profile = await requireUserProfile()

  if (profile.role !== role) {
    throw new AuthError(`Unauthorized: ${role} role required`)
  }

  return profile
}

/**
 * Enforces that the user has at least one of the specified roles.
 */
export async function requireAnyRole(roles: readonly UserRole[]): Promise<UserProfile> {
  const profile = await requireUserProfile()

  if (!roles.includes(profile.role)) {
    throw new AuthError(`Unauthorized: one of ${roles.join(', ')} roles required`)
  }

  return profile
}

/** Helper: Require SUPERADMIN access */
export function requireSuperAdmin(): Promise<UserProfile> {
  return requireAnyRole(['SUPERADMIN'])
}

/** Helper: Require any finance-capable role (SUPERADMIN, ADMIN, FINANCE) */
export function requireFinanceAccess(): Promise<UserProfile> {
  return requireAnyRole(['SUPERADMIN', 'ADMIN', 'FINANCE'])
}
