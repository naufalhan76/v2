'use server'

import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { revalidatePath } from 'next/cache'

export interface User {
  user_id: string
  full_name: string
  email: string
  role: string
  is_active: boolean
  created_at?: string
  updated_at?: string
}

export interface CreateUserInput {
  email: string
  password: string
  full_name: string
  role: string
}

export interface UpdateUserInput {
  user_id: string
  full_name?: string
  role?: string
}

/**
 * Get all users from user_management table
 */
export async function getUsers() {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('user_management')
      .select('user_id, full_name, email, role, is_active, created_at, updated_at')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching users:', error)
      return { users: [], error: error.message }
    }

    return { users: data as User[], error: null }
  } catch (error) {
    console.error('Unexpected error in getUsers:', error)
    return { users: [], error: 'Failed to fetch users' }
  }
}

/**
 * Create a new user (auth + user_management)
 * Uses database trigger to auto-populate user_management table
 */
export async function createUser(input: CreateUserInput) {
  try {
    const supabaseAdmin = createAdminClient()
    const supabase = await createClient()

    // 1. Check if email already exists in user_management
    const { data: existingUser } = await supabase
      .from('user_management')
      .select('email')
      .eq('email', input.email)
      .single()

    if (existingUser) {
      return { success: false, error: 'Email sudah terdaftar' }
    }

    // 2. Create auth user using admin client
    // The database trigger will automatically create the user_management record
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: {
        full_name: input.full_name,
        role: input.role,
      }
    })

    if (authError) {
      console.error('Error creating auth user:', authError)
      return { success: false, error: authError.message }
    }

    if (!authData.user) {
      return { success: false, error: 'Failed to create user' }
    }

    // 3. The database trigger automatically creates the user_management record
    // with user_id (MSN format), full_name, and role from metadata
    // Just wait a moment for the trigger to complete
    await new Promise(resolve => setTimeout(resolve, 100))

    revalidatePath('/dashboard/manajemen/user')
    return { success: true, error: null }
  } catch (error) {
    console.error('Unexpected error in createUser:', error)
    return { success: false, error: 'Failed to create user' }
  }
}

/**
 * Update user information
 */
export async function updateUser(input: UpdateUserInput) {
  try {
    const supabase = await createClient()

    const updateData: any = {
      updated_at: new Date().toISOString(),
    }

    if (input.full_name) updateData.full_name = input.full_name
    if (input.role) updateData.role = input.role

    const { error } = await supabase
      .from('user_management')
      .update(updateData)
      .eq('user_id', input.user_id)

    if (error) {
      console.error('Error updating user:', error)
      return { success: false, error: error.message }
    }

    revalidatePath('/dashboard/manajemen/user')
    return { success: true, error: null }
  } catch (error) {
    console.error('Unexpected error in updateUser:', error)
    return { success: false, error: 'Failed to update user' }
  }
}

/**
 * Toggle user active status
 */
export async function toggleUserStatus(userId: string, isActive: boolean) {
  try {
    const supabase = await createClient()

    const { error } = await supabase
      .from('user_management')
      .update({ 
        is_active: isActive,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)

    if (error) {
      console.error('Error toggling user status:', error)
      return { success: false, error: error.message }
    }

    revalidatePath('/dashboard/manajemen/user')
    return { success: true, error: null }
  } catch (error) {
    console.error('Unexpected error in toggleUserStatus:', error)
    return { success: false, error: 'Failed to toggle user status' }
  }
}

/**
 * Delete user permanently (hard delete from database and auth)
 * This will completely remove the user from the system
 */
export async function deleteUser(userId: string) {
  try {
    const supabaseAdmin = createAdminClient()
    const supabase = await createClient()

    // Get auth_user_id first
    const { data: userData } = await supabase
      .from('user_management')
      .select('auth_user_id')
      .eq('user_id', userId)
      .single()

    if (!userData) {
      return { success: false, error: 'User not found' }
    }

    // Delete from user_management first
    const { error: dbError } = await supabase
      .from('user_management')
      .delete()
      .eq('user_id', userId)

    if (dbError) {
      console.error('Error deleting user from database:', dbError)
      return { success: false, error: dbError.message }
    }

    // Delete from auth using admin client
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userData.auth_user_id)

    if (authError) {
      console.error('Error deleting auth user:', authError)
      // User already deleted from DB, log but don't fail
      console.warn('Database record deleted but auth user deletion failed')
    }

    revalidatePath('/dashboard/manajemen/user')
    return { success: true, error: null }
  } catch (error) {
    console.error('Unexpected error in deleteUser:', error)
    return { success: false, error: 'Failed to delete user' }
  }
}

/**
 * Permanently delete user (hard delete - use with caution)
 * DEPRECATED: Use deleteUser() instead
 */
export async function permanentDeleteUser(userId: string) {
  try {
    const supabaseAdmin = createAdminClient()
    const supabase = await createClient()

    // Get auth_user_id first
    const { data: userData } = await supabase
      .from('user_management')
      .select('auth_user_id')
      .eq('user_id', userId)
      .single()

    if (!userData?.auth_user_id) {
      return { success: false, error: 'User not found' }
    }

    // Delete from user_management
    const { error: dbError } = await supabase
      .from('user_management')
      .delete()
      .eq('user_id', userId)

    if (dbError) {
      console.error('Error deleting user from database:', dbError)
      return { success: false, error: dbError.message }
    }

    // Delete from auth using admin client
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userData.auth_user_id)

    if (authError) {
      console.error('Error deleting auth user:', authError)
      return { success: false, error: authError.message }
    }

    revalidatePath('/dashboard/manajemen/user')
    return { success: true, error: null }
  } catch (error) {
    console.error('Unexpected error in permanentDeleteUser:', error)
    return { success: false, error: 'Failed to permanently delete user' }
  }
}

/**
 * Cleanup orphaned auth users (users in auth.users but not in user_management)
 * This helps fix duplicate auth_user_id issues
 */
export async function cleanupOrphanedAuthUsers() {
  try {
    const supabaseAdmin = createAdminClient()
    const supabase = await createClient()

    // Get all auth users
    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers()
    
    if (authError) {
      console.error('Error listing auth users:', authError)
      return { success: false, error: authError.message, cleaned: 0 }
    }

    // Get all user_management records
    const { data: dbUsers, error: dbError } = await supabase
      .from('user_management')
      .select('auth_user_id')
    
    if (dbError) {
      console.error('Error fetching user_management:', dbError)
      return { success: false, error: dbError.message, cleaned: 0 }
    }

    const dbAuthIds = new Set(dbUsers?.map(u => u.auth_user_id) || [])
    const orphanedUsers = authUsers.users.filter(u => !dbAuthIds.has(u.id))

    // Delete orphaned auth users
    let cleanedCount = 0
    for (const orphan of orphanedUsers) {
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(orphan.id)
      if (!deleteError) {
        cleanedCount++
        console.log(`Deleted orphaned auth user: ${orphan.email}`)
      }
    }

    return { 
      success: true, 
      error: null, 
      cleaned: cleanedCount,
      message: `Cleaned up ${cleanedCount} orphaned auth user(s)`
    }
  } catch (error) {
    console.error('Unexpected error in cleanupOrphanedAuthUsers:', error)
    return { success: false, error: 'Failed to cleanup orphaned users', cleaned: 0 }
  }
}
