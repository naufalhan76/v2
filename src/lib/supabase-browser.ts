import { createBrowserClient } from '@supabase/ssr'

/**
 * Singleton browser Supabase client.
 *
 * `createBrowserClient` from `@supabase/ssr` caches the GoTrueClient instance
 * internally, but explicit module-level caching guarantees a single instance
 * across the browser context. This avoids the "Multiple GoTrueClient instances
 * detected" warning, which causes session-storage fragmentation and
 * inconsistent auth state between components.
 */
let _client: ReturnType<typeof createBrowserClient> | null = null

export function createClient() {
  if (typeof window === 'undefined') {
    throw new Error('createClient should only be called in the browser')
  }

  if (_client) return _client

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables')
  }

  _client = createBrowserClient(supabaseUrl, supabaseAnonKey)
  return _client
}
