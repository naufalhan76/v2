'use server'

import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { requireSuperAdmin } from '@/lib/auth-guards'
import { revalidatePath } from 'next/cache'
import { logger } from '@/lib/logger'
import { auditLog } from '@/lib/audit'
import type { InviteUserInput, CreateUserInput, UpdateUserInput } from './users-queries'

const ACTIVE_EMAIL_ERROR = 'Email sudah terdaftar sebagai pengguna aktif'
function normalizeEmail(email: string) { return email.trim().toLowerCase() }
async function getCurrentSuperAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, error: 'Unauthorized' }
  const { data: profile, error } = await supabase.from('user_management').select('auth_user_id, role, is_active').eq('auth_user_id', user.id).single()
  if (error || !profile || profile.role !== 'SUPERADMIN' || !profile.is_active) return { user: null, error: 'Hanya SUPERADMIN yang dapat mengundang user' }
  return { user, error: null }
}

export async function inviteUser(input: InviteUserInput): Promise<{ success: boolean; error: string | null }> {
  try {
    const { user, error: authError } = await getCurrentSuperAdmin()
    if (authError || !user) return { success: false, error: authError }
    const email = normalizeEmail(input.email)
    if (!email) return { success: false, error: 'Email wajib diisi' }
    const supabaseAdmin = createAdminClient()
    const { data: activeUser } = await supabaseAdmin.from('user_management').select('email').eq('email', email).eq('is_active', true).maybeSingle()
    if (activeUser) return { success: false, error: ACTIVE_EMAIL_ERROR }
    const { data: pendingInvite } = await supabaseAdmin.from('user_invites').select('invite_id').eq('email', email).eq('status', 'PENDING').maybeSingle()
    const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, { data: { role: input.role }, redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/confirm` })
    if (inviteError) return { success: false, error: inviteError.message }
    const now = new Date().toISOString()
    if (pendingInvite?.invite_id) {
      const { error: updateError } = await supabaseAdmin.from('user_invites').update({ last_sent_at: now, updated_at: now }).eq('invite_id', pendingInvite.invite_id)
      if (updateError) return { success: false, error: updateError.message }
      revalidatePath('/dashboard/manajemen/user')
      return { success: true, error: null }
    }
    const { error: insertError } = await supabaseAdmin.from('user_invites').insert({ email, role: input.role, status: 'PENDING', invited_by: user.id, invited_at: now, last_sent_at: now })
    if (insertError) return { success: false, error: insertError.message }
    revalidatePath('/dashboard/manajemen/user')
    return { success: true, error: null }
  } catch (error) {
    logger.error('Unexpected error in inviteUser:', error)
    return { success: false, error: 'Failed to invite user' }
  }
}

export async function resendInvite(inviteId: string): Promise<{ success: boolean; error: string | null }> {
  try {
    const { error: authError } = await getCurrentSuperAdmin()
    if (authError) return { success: false, error: authError }
    const supabaseAdmin = createAdminClient()
    const { data: invite, error } = await supabaseAdmin.from('user_invites').select('invite_id, email, role, status').eq('invite_id', inviteId).single()
    if (error || !invite) return { success: false, error: error?.message ?? 'Invite tidak ditemukan' }
    if (invite.status !== 'PENDING') return { success: false, error: 'Invite tidak aktif' }
    const { data: activeUser } = await supabaseAdmin.from('user_management').select('email').eq('email', normalizeEmail(invite.email)).eq('is_active', true).maybeSingle()
    if (activeUser) return { success: false, error: ACTIVE_EMAIL_ERROR }
    const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(invite.email, { data: { role: invite.role }, redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/confirm` })
    if (inviteError) return { success: false, error: inviteError.message }
    const now = new Date().toISOString()
    const { error: updateError } = await supabaseAdmin.from('user_invites').update({ last_sent_at: now, updated_at: now }).eq('invite_id', inviteId)
    if (updateError) return { success: false, error: updateError.message }
    revalidatePath('/dashboard/manajemen/user')
    return { success: true, error: null }
  } catch (error) {
    logger.error('Unexpected error in resendInvite:', error)
    return { success: false, error: 'Failed to resend invite' }
  }
}

export async function acceptInvite(inviteId: string, authUserId: string): Promise<{ success: boolean; error: string | null }> {
  try {
    const supabaseAdmin = createAdminClient()
    const supabase = await createClient()
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    if (!currentUser) return { success: false, error: 'Tidak ada sesi pengguna aktif' }
    if (currentUser.id !== authUserId) {
      return { success: false, error: 'Tidak diizinkan: authUserId tidak cocok dengan sesi pengguna' }
    }
    const { data: invite, error } = await supabaseAdmin.from('user_invites').select('invite_id, email, role, status').eq('invite_id', inviteId).single()
    if (error || !invite) return { success: false, error: error?.message ?? 'Invite tidak ditemukan' }
    if (invite.status !== 'PENDING') return { success: false, error: 'Invite tidak aktif' }
    const email = normalizeEmail(invite.email)
    const { data: activeUser } = await supabaseAdmin.from('user_management').select('email').eq('email', email).eq('is_active', true).maybeSingle()
    if (activeUser) return { success: false, error: ACTIVE_EMAIL_ERROR }
    const now = new Date().toISOString()
    const { error: upsertError } = await supabaseAdmin.from('user_management').upsert({ auth_user_id: authUserId, email, full_name: email.split('@')[0], role: invite.role, is_active: true, updated_at: now }, { onConflict: 'auth_user_id' })
    if (upsertError) return { success: false, error: upsertError.message }
    const { error: updateError } = await supabaseAdmin.from('user_invites').update({ status: 'ACCEPTED', accepted_at: now, updated_at: now }).eq('invite_id', inviteId)
    if (updateError) return { success: false, error: updateError.message }
    revalidatePath('/dashboard/manajemen/user')
    return { success: true, error: null }
  } catch (error) {
    logger.error('Unexpected error in acceptInvite:', error)
    return { success: false, error: 'Failed to accept invite' }
  }
}

export async function acceptInviteByEmail(authUserId: string, email: string): Promise<{ success: boolean; error: string | null }> {
  try {
    const supabaseAdmin = createAdminClient()
    const supabase = await createClient()
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    if (!currentUser) return { success: false, error: 'Tidak ada sesi pengguna aktif' }
    if (currentUser.id !== authUserId) {
      return { success: false, error: 'Tidak diizinkan: authUserId tidak cocok dengan sesi pengguna' }
    }
    const normalizedEmail = normalizeEmail(email)
    const { data: invite, error } = await supabaseAdmin
      .from('user_invites')
      .select('invite_id, email, role, status')
      .eq('email', normalizedEmail)
      .eq('status', 'PENDING')
      .maybeSingle()
    if (error) return { success: false, error: error.message }
    if (!invite) {
      // No pending invite — check if user_management already exists (idempotent)
      const { data: existing } = await supabaseAdmin
        .from('user_management')
        .select('auth_user_id')
        .eq('auth_user_id', authUserId)
        .maybeSingle()
      if (existing) return { success: true, error: null }
      return { success: false, error: 'Tidak ada invite yang menunggu untuk email ini' }
    }
    const now = new Date().toISOString()
    const { error: upsertError } = await supabaseAdmin
      .from('user_management')
      .upsert(
        { auth_user_id: authUserId, email: normalizedEmail, full_name: normalizedEmail.split('@')[0], role: invite.role, is_active: true, updated_at: now },
        { onConflict: 'auth_user_id' }
      )
    if (upsertError) return { success: false, error: upsertError.message }
    const { error: updateError } = await supabaseAdmin
      .from('user_invites')
      .update({ status: 'ACCEPTED', accepted_at: now, updated_at: now })
      .eq('invite_id', invite.invite_id)
    if (updateError) return { success: false, error: updateError.message }
    revalidatePath('/dashboard/manajemen/user')
    return { success: true, error: null }
  } catch (error) {
    logger.error('Unexpected error in acceptInviteByEmail:', error)
    return { success: false, error: 'Failed to accept invite' }
  }
}

/** Cancel a pending invite (soft — keeps row as CANCELLED for audit) */
export async function cancelInvite(inviteId: string) {
  try {
    await requireSuperAdmin()
    const supabase = await createClient()
    const now = new Date().toISOString()
    const { error } = await supabase
      .from('user_invites')
      .update({ status: 'CANCELLED', updated_at: now })
      .eq('invite_id', inviteId)
      .eq('status', 'PENDING')
    if (error) return { success: false, error: error.message }
    revalidatePath('/dashboard/manajemen/user')
    return { success: true, error: null }
  } catch (error) {
    logger.error('Unexpected error in cancelInvite:', error)
    return { success: false, error: 'Failed to cancel invite' }
  }
}

/** Delete an invite row (hard delete) */
export async function deleteInvite(inviteId: string) {
  try {
    await requireSuperAdmin()
    const supabase = await createClient()
    const { error } = await supabase
      .from('user_invites')
      .delete()
      .eq('invite_id', inviteId)
    if (error) return { success: false, error: error.message }
    revalidatePath('/dashboard/manajemen/user')
    return { success: true, error: null }
  } catch (error) {
    logger.error('Unexpected error in deleteInvite:', error)
    return { success: false, error: 'Failed to delete invite' }
  }
}

/** Create a new user (auth + user_management) */
export async function createUser(input: CreateUserInput) {
  try {
    await requireSuperAdmin()
    const supabaseAdmin = createAdminClient()
    const { data: existingUser } = await supabaseAdmin.from('user_management').select('email').eq('email', input.email).single()
    if (existingUser) return { success: false, error: 'Email sudah terdaftar' }
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({ email: input.email, password: input.password, email_confirm: true, user_metadata: { full_name: input.full_name, role: input.role } })
    if (authError) { logger.error('Error creating auth user:', authError); return { success: false, error: authError.message } }
    if (!authData.user) return { success: false, error: 'Failed to create user' }
    const { error: insertError } = await supabaseAdmin.from('user_management').insert({ auth_user_id: authData.user.id, email: input.email, full_name: input.full_name, role: input.role, is_active: true })
    if (insertError) {
      logger.error('Error inserting user_management record, rolling back auth user:', insertError)
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      if (deleteError) logger.error('CRITICAL: Failed to delete orphaned auth user:', deleteError)
      return { success: false, error: insertError.message }
    }
    revalidatePath('/dashboard/manajemen/user')
    void auditLog('CREATE', 'user_management', input.email)
    return { success: true, error: null }
  } catch (error) {
    logger.error('Unexpected error in createUser:', error)
    return { success: false, error: 'Failed to create user' }
  }
}

/** Update user information */
export async function updateUser(input: UpdateUserInput) {
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

/** Toggle user active status */
export async function toggleUserStatus(userId: string, isActive: boolean) {
  try {
    await requireSuperAdmin()
    const supabase = await createClient()
    const { data: userData } = await supabase.from('user_management').select('auth_user_id').eq('user_id', userId).single()
    const authUserId = userData?.auth_user_id ?? null
    const { error } = await supabase.from('user_management').update({ is_active: isActive, updated_at: new Date().toISOString() }).eq('user_id', userId)
    if (error) { logger.error('Error toggling user status:', error); return { success: false, error: error.message } }
    if (!isActive && authUserId) {
      const adminClient = createAdminClient()
      const { error: signOutError } = await adminClient.auth.admin.signOut(authUserId)
      if (signOutError) logger.warn('User deactivated but session invalidation failed:', signOutError)
    }
    revalidatePath('/dashboard/manajemen/user')
    void auditLog('TOGGLE_STATUS', 'user_management', userId, undefined, { is_active: isActive })
    return { success: true, error: null }
  } catch (error) {
    logger.error('Unexpected error in toggleUserStatus:', error)
    return { success: false, error: 'Failed to toggle user status' }
  }
}

export async function deleteUser(userId: string) {
  try {
    await requireSuperAdmin()
    const supabaseAdmin = createAdminClient()
    const supabase = await createClient()
    const { data: userData } = await supabase.from('user_management').select('auth_user_id').eq('user_id', userId).single()
    if (!userData) return { success: false, error: 'User not found' }
    if (!userData.auth_user_id) return { success: false, error: 'User has no auth account linked' }
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userData.auth_user_id)
    if (authError) { logger.error('Error deleting auth user:', authError); return { success: false, error: `Failed to delete auth user: ${authError.message}` } }
    const { error: dbError } = await supabase.from('user_management').delete().eq('user_id', userId)
    if (dbError) logger.error('Auth user deleted but DB record remains:', dbError)
    revalidatePath('/dashboard/manajemen/user')
    void auditLog('DELETE', 'user_management', userId)
    return { success: true, error: null }
  } catch (error) {
    logger.error('Unexpected error in deleteUser:', error)
    return { success: false, error: 'Failed to delete user' }
  }
}

/** DEPRECATED: Use deleteUser() instead */
export async function permanentDeleteUser(userId: string) {
  try {
    await requireSuperAdmin()
    const supabaseAdmin = createAdminClient()
    const supabase = await createClient()
    const { data: userData } = await supabase.from('user_management').select('auth_user_id').eq('user_id', userId).single()
    if (!userData?.auth_user_id) return { success: false, error: 'User not found' }
    const { error: dbError } = await supabase.from('user_management').delete().eq('user_id', userId)
    if (dbError) { logger.error('Error deleting user from database:', dbError); return { success: false, error: dbError.message } }
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userData.auth_user_id)
    if (authError) { logger.error('Error deleting auth user:', authError); return { success: false, error: authError.message } }
    revalidatePath('/dashboard/manajemen/user')
    return { success: true, error: null }
  } catch (error) {
    logger.error('Unexpected error in permanentDeleteUser:', error)
    return { success: false, error: 'Failed to permanently delete user' }
  }
}

/** Cleanup orphaned auth users */
export async function cleanupOrphanedAuthUsers() {
  try {
    await requireSuperAdmin()
    const supabaseAdmin = createAdminClient()
    const supabase = await createClient()
    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers()
    if (authError) { logger.error('Error listing auth users:', authError); return { success: false, error: authError.message, cleaned: 0 } }
    const { data: dbUsers, error: dbError } = await supabase.from('user_management').select('auth_user_id')
    if (dbError) { logger.error('Error fetching user_management:', dbError); return { success: false, error: dbError.message, cleaned: 0 } }
    const dbAuthIds = new Set(dbUsers?.map(u => u.auth_user_id) || [])
    const orphanedUsers = authUsers.users.filter(u => !dbAuthIds.has(u.id))
    let cleanedCount = 0
    for (const orphan of orphanedUsers) {
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(orphan.id)
      if (!deleteError) { cleanedCount++; logger.debug(`Deleted orphaned auth user: ${orphan.email}`) }
    }
    return { success: true, error: null, cleaned: cleanedCount, message: `Cleaned up ${cleanedCount} orphaned auth user(s)` }
  } catch (error) {
    logger.error('Unexpected error in cleanupOrphanedAuthUsers:', error)
    return { success: false, error: 'Failed to cleanup orphaned users', cleaned: 0 }
  }
}
