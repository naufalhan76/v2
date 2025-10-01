import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })
  
  // Refresh session if expired - required for Server Components
  const {
    data: { session },
  } = await supabase.auth.getSession()

  // Define protected routes
  const protectedRoutes = ['/dashboard', '/konfigurasi', '/manajemen', '/operasional', '/profile']
  const isProtectedRoute = protectedRoutes.some(route => 
    req.nextUrl.pathname.startsWith(route)
  )

  // Define auth routes
  const authRoutes = ['/login']
  const isAuthRoute = authRoutes.some(route => 
    req.nextUrl.pathname === route
  )

  // Redirect root path based on auth status
  if (req.nextUrl.pathname === '/') {
    if (session) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    } else {
      return NextResponse.redirect(new URL('/login', req.url))
    }
  }

  // Redirect unauthenticated users to login if accessing protected routes
  if (isProtectedRoute && !session) {
    const redirectUrl = new URL('/login', req.url)
    redirectUrl.searchParams.set('redirectTo', req.nextUrl.pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // Check if user is active in user_management table
  if (isProtectedRoute && session) {
    const { data: userData, error } = await supabase
      .from('user_management')
      .select('is_active, role')
      .eq('auth_user_id', session.user.id)
      .single()

    // If user is not found or not active, sign out and redirect to login
    if (error || !userData || !userData.is_active) {
      console.log('Middleware check failed:', { error, userData, userId: session.user.id })
      await supabase.auth.signOut()
      const redirectUrl = new URL('/login', req.url)
      redirectUrl.searchParams.set('error', 'Account is inactive or not found')
      return NextResponse.redirect(redirectUrl)
    }

    // Role-based access control for specific routes
    if (req.nextUrl.pathname.startsWith('/dashboard/manajemen/user')) {
      // Only SUPERADMIN can access user management
      if (userData.role !== 'SUPERADMIN') {
        return NextResponse.redirect(new URL('/dashboard', req.url))
      }
    }
  }

  // Redirect authenticated users to dashboard if accessing auth routes
  if (isAuthRoute && session) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  return res
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}