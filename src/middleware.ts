import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Simple in-memory cache to reduce database queries (expires after 30 seconds)
const userCache = new Map<string, { data: any; expiry: number }>()
const CACHE_DURATION = 30000 // 30 seconds

function getCachedUser(userId: string) {
  const cached = userCache.get(userId)
  if (cached && cached.expiry > Date.now()) {
    return cached.data
  }
  return null
}

function setCachedUser(userId: string, data: any) {
  userCache.set(userId, {
    data,
    expiry: Date.now() + CACHE_DURATION
  })
  
  // Clean up old entries
  if (userCache.size > 100) {
    const now = Date.now()
    userCache.forEach((value, key) => {
      if (value.expiry < now) {
        userCache.delete(key)
      }
    })
  }
}

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({
    request: req,
  })
  
  // Skip middleware for static files and API routes to reduce rate limit usage
  const pathname = req.nextUrl.pathname
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
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
          cookiesToSet.forEach(({ name, value, options }) => req.cookies.set(name, value))
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

  // Define protected routes
  const protectedRoutes = ['/dashboard', '/konfigurasi', '/manajemen', '/operasional', '/profile']
  const isProtectedRoute = protectedRoutes.some(route => 
    pathname.startsWith(route)
  )

  // Define auth routes
  const authRoutes = ['/login']
  const isAuthRoute = authRoutes.some(route => 
    pathname === route
  )

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
    let userData = getCachedUser(user.id)
    
    if (!userData) {
      // If not in cache, fetch from database
      const { data, error } = await supabase
        .from('user_management')
        .select('is_active, role')
        .eq('auth_user_id', user.id)
        .maybeSingle() // Use maybeSingle() instead of single() to avoid throwing error

      // If user is not found or not active, sign out and redirect to login
      if (error || !data || !data.is_active) {
        console.log('Middleware check failed:', { error, data, userId: user.id })
        await supabase.auth.signOut()
        const redirectUrl = new URL('/login', req.url)
        redirectUrl.searchParams.set('error', 'Account is inactive or not found')
        return NextResponse.redirect(redirectUrl)
      }
      
      userData = data
      // Cache the result
      setCachedUser(user.id, userData)
    }

    // Role-based access control for specific routes
    if (pathname.startsWith('/dashboard/manajemen/user')) {
      // Only SUPERADMIN can access user management
      if (userData.role !== 'SUPERADMIN') {
        return NextResponse.redirect(new URL('/dashboard', req.url))
      }
    }
  }

  // Redirect authenticated users to dashboard if accessing auth routes
  if (isAuthRoute && user) {
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