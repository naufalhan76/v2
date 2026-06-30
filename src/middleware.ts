// ponytail: redirect-based auth guard — auth.protect() does a rewrite to /clerk_*
// which shows 404 if Clerk JS SDK hasn't loaded yet. Redirect is more reliable.
// Upgrade path: revert to auth.protect() if Clerk JS SDK loading issue is resolved.
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isPublicRoute = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)'])

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    const { userId } = await auth()
    if (!userId) {
      const url = new URL('/sign-in', request.url)
      url.searchParams.set('redirect_url', request.url)
      return NextResponse.redirect(url)
    }
  }
})

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
