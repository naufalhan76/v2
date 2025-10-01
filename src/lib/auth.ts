import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = cookies()

  return createServerComponentClient({
    cookies: () => cookieStore,
  })
}

export async function getUser() {
  const client = await createClient()
  const {
    data: { user },
  } = await client.auth.getUser()

  return user
}

export async function getUserRole() {
  const user = await getUser()
  if (!user) return null

  const client = await createClient()
  const { data, error } = await client
    .from('user_management')
    .select('role')
    .eq('auth_user_id', user.id)
    .single()

  if (error) {
    console.error('Error fetching user role:', error)
    return null
  }

  return data?.role
}