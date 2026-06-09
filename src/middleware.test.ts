import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const createServerClientMock = vi.fn()

vi.mock('@supabase/ssr', () => ({
  createServerClient: (...args: unknown[]) => createServerClientMock(...args),
}))

vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

import { middleware } from './middleware'

type Role = 'SUPERADMIN' | 'ADMIN' | 'FINANCE' | 'TECHNICIAN'

function makeRequest(pathname: string) {
  return new NextRequest(new URL(pathname, 'https://example.test'))
}

function makeClient(role: Role | null, userId: string) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: role ? { id: userId } : null },
      }),
      signOut: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({
            data: role ? { is_active: true, role } : null,
            error: null,
          }),
        })),
      })),
    })),
  }
}

async function run(pathname: string, role: Role | null, userId = `${role ?? 'anon'}-${pathname}`) {
  createServerClientMock.mockReturnValue(makeClient(role, userId))
  return middleware(makeRequest(pathname))
}

function expectRedirect(response: Response, url: string) {
  expect(response.status).toBe(307)
  expect(response.headers.get('location')).toBe(url)
}

describe('middleware route role matrix', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://supabase.test'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
  })

  it('redirects unauthenticated /dashboard to login with redirectTo', async () => {
    const response = await run('/dashboard', null)

    expectRedirect(response, 'https://example.test/login?redirectTo=%2Fdashboard')
  })

  it('redirects unauthenticated /technician to login with redirectTo', async () => {
    const response = await run('/technician', null)

    expectRedirect(response, 'https://example.test/login?redirectTo=%2Ftechnician')
  })

  it('redirects TECHNICIAN on /dashboard to /technician', async () => {
    const response = await run('/dashboard', 'TECHNICIAN')

    expectRedirect(response, 'https://example.test/technician')
  })

  it('redirects ADMIN on /technician to /dashboard', async () => {
    const response = await run('/technician', 'ADMIN')

    expectRedirect(response, 'https://example.test/dashboard')
  })

  it('redirects ADMIN on /dashboard/manajemen/user to /dashboard', async () => {
    const response = await run('/dashboard/manajemen/user', 'ADMIN')

    expectRedirect(response, 'https://example.test/dashboard')
  })

  it('allows SUPERADMIN on /dashboard/manajemen/user', async () => {
    const response = await run('/dashboard/manajemen/user', 'SUPERADMIN')

    expect(response.status).toBe(200)
    expect(response.headers.get('location')).toBeNull()
  })

  it('redirects authenticated ADMIN on /login to /dashboard', async () => {
    const response = await run('/login', 'ADMIN')

    expectRedirect(response, 'https://example.test/dashboard')
  })

  it('redirects authenticated TECHNICIAN on /login to /technician', async () => {
    const response = await run('/login', 'TECHNICIAN')

    expectRedirect(response, 'https://example.test/technician')
  })

  it('skips static and API paths before creating Supabase client', async () => {
    const staticResponse = await middleware(makeRequest('/_next/static/app.js'))
    const apiResponse = await middleware(makeRequest('/api/orders'))

    expect(staticResponse.status).toBe(200)
    expect(apiResponse.status).toBe(200)
    expect(createServerClientMock).not.toHaveBeenCalled()
  })
})
