import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
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