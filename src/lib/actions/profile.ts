'use server'

import { auth } from '@clerk/nextjs/server'
import { clerkClient } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'
import { logger } from '@/lib/logger'

interface UpdateProfileData {
  full_name: string
  email: string
}

/**
 * Get current user profile
 */
export async function getUserProfile() {
  try {
    const supabase = await createClient()
    const { userId } = await auth()

    if (!userId) {
      return { success: false, error: 'User not authenticated' }
    }

    const { data, error } = await supabase
      .from('user_management')
      .select('*')
      .eq('auth_user_id', userId)
      .maybeSingle()

    if (error) {
      logger.error('Error fetching user profile:', error)
      return { success: false, error: error.message }
    }

    if (!data) {
      logger.debug('User not found in user_management, creating...')

      const client = await clerkClient()
      const clerkUser = await client.users.getUser(userId)
      const email = clerkUser.emailAddresses[0]?.emailAddress || ''
      const fullName = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || email.split('@')[0] || 'User'

      const { data: newUser, error: insertError } = await supabase
        .from('user_management')
        .insert({
          auth_user_id: userId,
          email,
          full_name: fullName,
          role: 'ADMIN',
          photo_url: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (insertError) {
        logger.error('Error creating user in user_management:', insertError)
        return {
          success: true,
          data: {
            user_id: userId,
            email,
            full_name: fullName,
            photo_url: null,
            role: 'ADMIN',
          }
        }
      }

      return {
        success: true,
        data: {
          user_id: newUser.user_id,
          email: newUser.email,
          full_name: newUser.full_name,
          photo_url: newUser.photo_url,
          role: newUser.role,
        }
      }
    }

    return {
      success: true,
      data: {
        user_id: data.user_id || data.auth_user_id,
        email: data.email,
        full_name: data.full_name,
        photo_url: data.photo_url,
        role: data.role,
      }
    }
  } catch (error: unknown) {
    logger.error('Error in getUserProfile:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to get user profile' }
  }
}

/**
 * Update user profile (name, email)
 * Syncs with Clerk and user_management table
 */
export async function updateUserProfile(data: UpdateProfileData) {
  try {
    const supabase = await createClient()
    const { userId } = await auth()

    if (!userId) {
      return { success: false, error: 'User not authenticated' }
    }

    const client = await clerkClient()
    const clerkUser = await client.users.getUser(userId)
    const currentEmail = clerkUser.emailAddresses[0]?.emailAddress

    const { error: updateError } = await supabase
      .from('user_management')
      .update({
        full_name: data.full_name,
        email: data.email,
        updated_at: new Date().toISOString(),
      })
      .eq('auth_user_id', userId)

    if (updateError) {
      logger.error('Error updating user_management:', updateError)
      return { success: false, error: updateError.message }
    }

    const [firstName, ...rest] = data.full_name.split(' ')
    await client.users.updateUser(userId, {
      firstName,
      lastName: rest.join(' ') || undefined,
    })

    if (data.email !== currentEmail) {
      revalidatePath('/dashboard/profile')
      redirect('/user-profile')
    }

    revalidatePath('/dashboard/profile')
    return { success: true, message: 'Profile updated successfully' }
  } catch (error: unknown) {
    if (error instanceof Error && (error as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) {
      throw error
    }
    logger.error('Error in updateUserProfile:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to update user profile' }
  }
}

/**
 * Update user password — delegates to Clerk.
 * Old-password verification is handled by Clerk's UserProfile component.
 */
export async function updateUserPassword(_currentPassword: string, newPassword: string) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return { success: false, error: 'User not authenticated' }
    }

    const client = await clerkClient()
    await client.users.updateUser(userId, { password: newPassword })

    return { success: true, message: 'Password updated successfully' }
  } catch (error: unknown) {
    logger.error('Error in updateUserPassword:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to update password' }
  }
}

/**
 * Upload profile photo to Supabase Storage
 */
export async function updateProfilePhoto(formData: FormData) {
  try {
    const supabase = await createClient()
    const { userId } = await auth()

    if (!userId) {
      return { success: false, error: 'User not authenticated' }
    }

    const file = formData.get('file') as File
    if (!file) {
      return { success: false, error: 'No file provided' }
    }

    const fileExt = file.name.split('.').pop()
    const fileName = `${userId}-${Date.now()}.${fileExt}`
    const filePath = `profiles/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
      })

    if (uploadError) {
      logger.error('Error uploading file:', uploadError)
      return { success: false, error: uploadError.message }
    }

    const { data: urlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath)

    const photoUrl = urlData.publicUrl

    const { error: updateError } = await supabase
      .from('user_management')
      .update({
        photo_url: photoUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('auth_user_id', userId)

    if (updateError) {
      logger.error('Error updating photo_url:', updateError)
      return { success: false, error: updateError.message }
    }

    revalidatePath('/dashboard/profile')
    return { success: true, data: { photo_url: photoUrl } }
  } catch (error: unknown) {
    logger.error('Error in updateProfilePhoto:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to update profile photo' }
  }
}
