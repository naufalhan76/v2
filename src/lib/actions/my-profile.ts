'use server'

import { auth } from '@clerk/nextjs/server'
import { createClient } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'

interface MyUserProfile {
  auth_user_id: string
  email: string
  full_name: string
  role: string
  photo_url: string | null
}

export async function getMyUserProfile(): Promise<MyUserProfile | null> {
  const { userId } = await auth()
  if (!userId) return null

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('user_management')
    .select('auth_user_id, email, full_name, role, photo_url')
    .eq('auth_user_id', userId)
    .maybeSingle()

  if (error) {
    logger.error('getMyUserProfile: failed to fetch user_management', error)
    return null
  }

  if (!data) {
    return {
      auth_user_id: userId,
      email: '',
      full_name: '',
      role: 'USER',
      photo_url: null,
    }
  }

  return data as MyUserProfile
}
