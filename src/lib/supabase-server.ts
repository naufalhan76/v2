import { createClient as supabaseCreateClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'
import { logger } from '@/lib/logger'

// ponytail: admin client with service role key — RLS removed, all access via server code
export async function createClient() {
  return supabaseCreateClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

export async function getUser() {
  const { userId } = await auth()
  if (!userId) return null

  const client = await createClient()
  const { data, error } = await client
    .from('user_management')
    .select('auth_user_id,email,full_name,role,is_active')
    .eq('auth_user_id', userId)
    .maybeSingle()

  if (error || !data) return null
  return { id: userId, email: data.email }
}

export async function getUserRole() {
  const { userId } = await auth()
  if (!userId) return null

  const client = await createClient()
  const { data, error } = await client
    .from('user_management')
    .select('role')
    .eq('auth_user_id', userId)
    .maybeSingle()

  if (error) {
    logger.error('Error fetching user role:', error)
    return null
  }

  return data?.role
}
