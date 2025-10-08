import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  // Ensure we're in the browser and env vars are available
  if (typeof window === 'undefined') {
    throw new Error('createClient should only be called in the browser')
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables')
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}