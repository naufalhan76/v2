'use server'

import { auth } from '@clerk/nextjs/server'
import { createClient } from '@/lib/supabase-server'
import { ThemeId } from '@/lib/themes'

export async function getUserTheme(): Promise<ThemeId> {
  const { userId } = await auth()
  if (!userId) return 'navy'

  const supabase = await createClient()
  const { data } = await supabase
    .from('user_management')
    .select('theme_id')
    .eq('auth_user_id', userId)
    .maybeSingle()

  return (data?.theme_id as ThemeId) || 'navy'
}

export async function saveUserTheme(themeId: ThemeId): Promise<boolean> {
  const { userId } = await auth()
  if (!userId) return false

  const supabase = await createClient()
  const { error } = await supabase
    .from('user_management')
    .update({ theme_id: themeId })
    .eq('auth_user_id', userId)

  return !error
}