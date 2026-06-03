import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { logger } from '@/lib/logger'

// Simple in-memory cache to reduce database queries (expires after 30 seconds)
const userCache = new Map<string, { data: unknown; expiry: number }>()
const CACHE_DURATION = 30000 // 30 seconds

function getCachedUser(userId: string) {
  const cached = userCache.get(userId)
  if (cached && cached.expiry > Date.now()) {
    return cached.data
  }
  return null
}

function setCachedUser(userId: string, data: unknown) {
  // If cache exceeds limit, clear it completely to avoid unbounded growth / memory leak
  if (userCache.size >= 100) {
    userCache.clear()
  }
  
  userCache.set(userId, {
    data,
    expiry: Date.now() + CACHE_DURATION,
  })
}

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({
    request: req,
  })

  // Skip middleware for static files, API routes, and dev-only test harness
  const pathname = req.nextUrl.pathname
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/__test') ||
    pathname.includes('.') // Skip files with extensions
  ) {
    return res
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options: _options }) => req.cookies.set(name, value))
          res = NextResponse.next({
            request: req,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Get authenticated user - more secure than getSession()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Define protected routes (add /technician)
  const protectedRoutes = ['/dashboard', '/technician', '/konfigurasi', '/manajemen', '/operasional', '/profile']
  const isProtectedRoute = protectedRoutes.some((route) => pathname.startsWith(route))

  // Define auth routes
  const authRoutes = ['/login']
  const isAuthRoute = authRoutes.some((route) => pathname === route)

  // Redirect root path based on auth status
  if (pathname === '/') {
    if (user) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    } else {
      return NextResponse.redirect(new URL('/login', req.url))
    }
  }

  // Redirect unauthenticated users to login if accessing protected routes
  if (isProtectedRoute && !user) {
    const redirectUrl = new URL('/login', req.url)
    redirectUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // Check if user is active in user_management table
  if (isProtectedRoute && user) {
    // Check cache first
    let userData = getCachedUser(user.id) as { is_active?: boolean; role?: string } | null

    if (!userData) {
      // If not in cache, fetch from database
      const { data, error } = await supabase
        .from('user_management')
        .select('is_active, role')
        .eq('auth_user_id', user.id)
        .maybeSingle()

      // If user is not found or not active, sign out and redirect to login
      if (error || !data || !data.is_active) {
        logger.debug('Middleware check failed:', { error, data, userId: user.id })
        await supabase.auth.signOut()
        const redirectUrl = new URL('/login', req.url)
        redirectUrl.searchParams.set('error', 'Account is inactive or not found')
        return NextResponse.redirect(redirectUrl)
      }

      userData = data
      // Cache the result
      setCachedUser(user.id, userData)
    }

    const userRole = userData?.role

    // --- Role-based routing for TECHNICIAN ---
    // TECHNICIAN accessing /dashboard → redirect to /technician
    if (userRole === 'TECHNICIAN' && pathname.startsWith('/dashboard')) {
      return NextResponse.redirect(new URL('/technician', req.url))
    }

    // Non-TECHNICIAN accessing /technician → redirect to /dashboard
    if (userRole !== 'TECHNICIAN' && pathname.startsWith('/technician')) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }

    // Role-based access control for specific routes
    if (pathname.startsWith('/dashboard/manajemen/user')) {
      // Only SUPERADMIN can access user management
      if (userRole !== 'SUPERADMIN') {
        return NextResponse.redirect(new URL('/dashboard', req.url))
      }
    }
  }

  // Redirect authenticated users based on role when accessing auth routes
  if (isAuthRoute && user) {
    // Check role to determine redirect target
    let userData = getCachedUser(user.id) as { role?: string } | null
    if (!userData) {
      const { data } = await supabase
        .from('user_management')
        .select('is_active, role')
        .eq('auth_user_id', user.id)
        .maybeSingle()
      userData = data
      if (data) setCachedUser(user.id, data)
    }

    if (userData?.role === 'TECHNICIAN') {
      return NextResponse.redirect(new URL('/technician', req.url))
    }
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  return res
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
