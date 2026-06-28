'use server'

import { clerkClient } from '@clerk/nextjs/server'
import { createClient } from '@/lib/supabase-server'
import { requireSuperAdmin } from '@/lib/auth-guards'
import { revalidatePath } from 'next/cache'
import { logger } from '@/lib/logger'
import { auditLog } from '@/lib/audit'
import type { InviteUserInput, CreateUserInput, UpdateUserInput } from './users-queries'

function normalizeEmail(email: string) { return email.trim().toLowerCase() }

/**
 * Shared Clerk user creation: creates user in Clerk (set-password email sent) then inserts user_management row.
 */
async function clerkCreateUser(email: string, fullName: string, role: string): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createClient()
  const { data: existing } = await supabase.from('user_management').select('email').eq('email', email).maybeSingle()
  if (existing) return { success: false, error: 'Email sudah terdaftar' }

  const client = await clerkClient()
  const clerkUser = await client.users.createUser({
    emailAddress: [email],
    skipPasswordRequirement: true,
    firstName: fullName,
  })

  const { error: insertError } = await supabase.from('user_management').insert({
    auth_user_id: clerkUser.id,
    email,
    full_name: fullName,
    role,
    is_active: true,
  })
  if (insertError) {
    logger.error('user_management insert failed, rolling back Clerk user:', insertError)
    await client.users.deleteUser(clerkUser.id).catch((err: unknown) => logger.error('CRITICAL: Clerk rollback failed:', err))
    return { success: false, error: insertError.message }
  }
  revalidatePath('/dashboard/manajemen/user')
  void auditLog('CREATE', 'user_management', email)
  return { success: true, error: null }
}

/** Invite a user — Clerk sends set-password email. Same flow as createUser. */
export async function inviteUser(input: InviteUserInput): Promise<{ success: boolean; error: string | null }> {
  try {
    await requireSuperAdmin()
    const email = normalizeEmail(input.email)
    if (!email) return { success: false, error: 'Email wajib diisi' }
    return clerkCreateUser(email, email.split('@')[0], input.role)
  } catch (error) {
    logger.error('Unexpected error in inviteUser:', error)
    return { success: false, error: 'Failed to invite user' }
  }
}

/** Create a user (Clerk + user_management). Clerk sends set-password email; password field is ignored. */
export async function createUser(input: CreateUserInput): Promise<{ success: boolean; error: string | null }> {
  try {
    await requireSuperAdmin()
    return clerkCreateUser(normalizeEmail(input.email), input.full_name, input.role)
  } catch (error) {
    logger.error('Unexpected error in createUser:', error)
    return { success: false, error: 'Failed to create user' }
  }
}

/** Update user_management row (no Clerk API call needed). */
export async function updateUser(input: UpdateUserInput): Promise<{ success: boolean; error: string | null }> {
  try {
    await requireSuperAdmin()
    const supabase = await createClient()
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (input.full_name) updateData.full_name = input.full_name
    if (input.role) updateData.role = input.role
    const { error } = await supabase.from('user_management').update(updateData).eq('user_id', input.user_id)
    if (error) { logger.error('Error updating user:', error); return { success: false, error: error.message } }
    revalidatePath('/dashboard/manajemen/user')
    return { success: true, error: null }
  } catch (error) {
    logger.error('Unexpected error in updateUser:', error)
    return { success: false, error: 'Failed to update user' }
  }
}

/** Toggle user active status. Deactivation handled by auth-guards (redirect), not Clerk session revoke. */
export async function toggleUserStatus(userId: string, isActive: boolean): Promise<{ success: boolean; error: string | null }> {
  try {
    await requireSuperAdmin()
    const supabase = await createClient()
    const { error } = await supabase
      .from('user_management')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
    if (error) { logger.error('Error toggling user status:', error); return { success: false, error: error.message } }
    revalidatePath('/dashboard/manajemen/user')
    void auditLog('TOGGLE_STATUS', 'user_management', userId, undefined, { is_active: isActive })
    return { success: true, error: null }
  } catch (error) {
    logger.error('Unexpected error in toggleUserStatus:', error)
    return { success: false, error: 'Failed to toggle user status' }
  }
}

/** Delete user from Clerk and user_management. */
export async function deleteUser(userId: string): Promise<{ success: boolean; error: string | null }> {
  try {
    await requireSuperAdmin()
    const supabase = await createClient()
    const { data: userData } = await supabase.from('user_management').select('auth_user_id').eq('user_id', userId).single()
    if (!userData) return { success: false, error: 'User not found' }
    if (!userData.auth_user_id) return { success: false, error: 'User has no Clerk account linked' }
    const client = await clerkClient()
    await client.users.deleteUser(userData.auth_user_id)
    const { error: dbError } = await supabase.from('user_management').delete().eq('user_id', userId)
    if (dbError) logger.error('Clerk user deleted but DB record remains:', dbError)
    revalidatePath('/dashboard/manajemen/user')
    void auditLog('DELETE', 'user_management', userId)
    return { success: true, error: null }
  } catch (error) {
    logger.error('Unexpected error in deleteUser:', error)
    return { success: false, error: 'Failed to delete user' }
  }
}

/** Alias for deleteUser (backward compat with permanentDeleteUser export). */
export async function permanentDeleteUser(userId: string): Promise<{ success: boolean; error: string | null }> {
  return deleteUser(userId)
}
