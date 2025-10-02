'use server'

import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { revalidatePath } from 'next/cache'

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
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return { success: false, error: 'User not authenticated' }
    }

    // Get user details from user_management
    const { data, error } = await supabase
      .from('user_management')
      .select('*')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (error) {
      console.error('Error fetching user profile:', error)
      return { success: false, error: error.message }
    }

    // If user not found in user_management, create from auth.users
    if (!data) {
      console.log('User not found in user_management, creating...')
      
      // Insert user into user_management
      const { data: newUser, error: insertError } = await supabase
        .from('user_management')
        .insert({
          auth_user_id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
          role: user.user_metadata?.role || 'ADMIN',
          photo_url: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (insertError) {
        console.error('Error creating user in user_management:', insertError)
        // Return data from auth.users as fallback
        return {
          success: true,
          data: {
            user_id: user.id,
            email: user.email || '',
            full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
            photo_url: null,
            role: user.user_metadata?.role || 'ADMIN',
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
  } catch (error: any) {
    console.error('Error in getUserProfile:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Update user profile (name, email, phone)
 * Syncs with auth.users and user_management table
 */
export async function updateUserProfile(data: UpdateProfileData) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return { success: false, error: 'User not authenticated' }
    }

    const currentEmail = user.email

    // Update user_management table
    const { error: updateError } = await supabase
      .from('user_management')
      .update({
        full_name: data.full_name,
        email: data.email,
        updated_at: new Date().toISOString(),
      })
      .eq('auth_user_id', user.id)

    if (updateError) {
      console.error('Error updating user_management:', updateError)
      return { success: false, error: updateError.message }
    }

    // If email changed, update auth.users
    if (data.email !== currentEmail) {
      const { error: emailError } = await adminClient.auth.admin.updateUserById(
        user.id,
        { 
          email: data.email,
          email_confirm: false // Require email verification
        }
      )

      if (emailError) {
        console.error('Error updating auth email:', emailError)
        return { 
          success: false, 
          error: 'Failed to update email. Please try again.' 
        }
      }

      // Send verification email
      const { error: verifyError } = await supabase.auth.resetPasswordForEmail(
        data.email,
        {
          redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/profile`,
        }
      )

      if (verifyError) {
        console.log('Verification email error:', verifyError)
      }

      revalidatePath('/dashboard/profile')
      
      return { 
        success: true, 
        message: 'Profile updated! Please check your new email for verification link.',
        emailChanged: true
      }
    }

    revalidatePath('/dashboard/profile')
    return { success: true, message: 'Profile updated successfully' }
  } catch (error: any) {
    console.error('Error in updateUserProfile:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Update user password
 */
export async function updateUserPassword(currentPassword: string, newPassword: string) {
  try {
    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return { success: false, error: 'User not authenticated' }
    }

    // Verify current password by attempting to sign in
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password: currentPassword,
    })

    if (signInError) {
      return { success: false, error: 'Current password is incorrect' }
    }

    // Update password
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    })

    if (updateError) {
      console.error('Error updating password:', updateError)
      return { success: false, error: updateError.message }
    }

    return { success: true, message: 'Password updated successfully' }
  } catch (error: any) {
    console.error('Error in updateUserPassword:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Upload profile photo to Supabase Storage
 */
export async function updateProfilePhoto(formData: FormData) {
  try {
    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return { success: false, error: 'User not authenticated' }
    }

    // Get file from FormData
    const file = formData.get('file') as File
    if (!file) {
      return { success: false, error: 'No file provided' }
    }

    // Create unique filename
    const fileExt = file.name.split('.').pop()
    const fileName = `${user.id}-${Date.now()}.${fileExt}`
    const filePath = `profiles/${fileName}`

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
      })

    if (uploadError) {
      console.error('Error uploading file:', uploadError)
      return { success: false, error: uploadError.message }
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath)

    const photoUrl = urlData.publicUrl

    // Update user_management with photo URL
    const { error: updateError } = await supabase
      .from('user_management')
      .update({
        photo_url: photoUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('auth_user_id', user.id)

    if (updateError) {
      console.error('Error updating photo_url:', updateError)
      return { success: false, error: updateError.message }
    }

    revalidatePath('/dashboard/profile')
    return { success: true, data: { photo_url: photoUrl } }
  } catch (error: any) {
    console.error('Error in updateProfilePhoto:', error)
    return { success: false, error: error.message }
  }
}
