import { createServerActionClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = cookies()

  return createServerActionClient({
    cookies: () => cookieStore,
  })
}