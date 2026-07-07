// ponytail: redirect-based auth guard — auth.protect() does a rewrite to /clerk_*
// which shows 404 if Clerk JS SDK hasn't loaded yet. Redirect is more reliable.
// Upgrade path: revert to auth.protect() if Clerk JS SDK loading issue is resolved.
//
// Auth guard: Clerk auth + user_management DB check.
// Users not in user_management (self-signup without invite) are redirected to /unauthorized.
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase-server'

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/unauthorized(.*)',
  '/api/webhooks/(.*)',
])

/**
 * Reconstruct the public URL from a request, respecting x-forwarded-* headers.
 * Docker container HOSTNAME=0.0.0.0 leaks into request.url — this fixes it
 * so redirects use the real domain (e.g. v2.nufnh.my.id) instead of 0.0.0.0:3000.
 */
function getPublicUrl(request: NextRequest, path: string): URL {
  const url = new URL(path, request.url)
  const fwdHost = request.headers.get('x-forwarded-host')
  const fwdProto = request.headers.get('x-forwarded-proto') || 'https'
  if (fwdHost) {
    url.host = fwdHost
    url.protocol = fwdProto
    url.port = ''
  }
  return url
}

export default clerkMiddleware(async (auth, request) => {
  if (isPublicRoute(request)) return

  const { userId } = await auth()
  if (!userId) {
    const url = getPublicUrl(request, '/sign-in')
    const redirectUrl = getPublicUrl(request, request.nextUrl.pathname + request.nextUrl.search)
    url.searchParams.set('redirect_url', redirectUrl.toString())
    return NextResponse.redirect(url)
  }

  // Allowlist guard: user must exist in user_management table
  // Self-signups that pass Clerk but aren't invited will be blocked here
  // (webhook should have already deleted them, but this is defense-in-depth)
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('user_management')
      .select('auth_user_id')
      .eq('auth_user_id', userId)
      .maybeSingle()

    if (!data) {
      // User exists in Clerk but NOT in user_management — either self-signup
      // without invite, or user was deleted from DB. Redirect to sign-in with
      // a flag that tells the sign-in page to clear the orphaned Clerk session.
      const url = getPublicUrl(request, '/sign-in')
      url.searchParams.set('unauthorized', '1')
      return NextResponse.redirect(url)
    }
  } catch {
    // If DB check fails, fail open (don't lock out legit users during outage)
    // The webhook + Clerk auth still provide protection
  }
})

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
