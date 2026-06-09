import { describe, expect, it } from 'vitest'

import { ALL_ROLES, ROUTE_ROLE_MATRIX, type AuthRoute, type UserRole, isRoleAllowed } from '@/lib/auth-roles'

const routes = Object.keys(ROUTE_ROLE_MATRIX) as AuthRoute[]
const rolesAndNull = [...ALL_ROLES, null] as const

const expectedAccess: Record<AuthRoute, Record<UserRole, boolean>> = {
  '/': {
    SUPERADMIN: true,
    ADMIN: true,
    FINANCE: true,
    TECHNICIAN: true,
  },
  '/login': {
    SUPERADMIN: false,
    ADMIN: false,
    FINANCE: false,
    TECHNICIAN: false,
  },
  '/dashboard': {
    SUPERADMIN: true,
    ADMIN: true,
    FINANCE: true,
    TECHNICIAN: false,
  },
  '/technician': {
    SUPERADMIN: false,
    ADMIN: false,
    FINANCE: false,
    TECHNICIAN: true,
  },
  '/dashboard/manajemen/user': {
    SUPERADMIN: true,
    ADMIN: false,
    FINANCE: false,
    TECHNICIAN: false,
  },
}

describe('auth route role matrix', () => {
  it('checks every matrix route for each role and null', () => {
    for (const route of routes) {
      for (const role of rolesAndNull) {
        const expected = role ? expectedAccess[route][role] : false

        expect(isRoleAllowed(role, route), `${String(role)} on ${route}`).toBe(expected)
      }
    }
  })

  it('/dashboard/manajemen/user requires SUPERADMIN only', () => {
    expect(isRoleAllowed('SUPERADMIN', '/dashboard/manajemen/user')).toBe(true)
    expect(isRoleAllowed('ADMIN', '/dashboard/manajemen/user')).toBe(false)
    expect(isRoleAllowed('FINANCE', '/dashboard/manajemen/user')).toBe(false)
    expect(isRoleAllowed('TECHNICIAN', '/dashboard/manajemen/user')).toBe(false)
  })

  it('blocks TECHNICIAN from /dashboard and ADMIN from /technician', () => {
    expect(isRoleAllowed('TECHNICIAN', '/dashboard')).toBe(false)
    expect(isRoleAllowed('ADMIN', '/technician')).toBe(false)
  })

  it('safe-denies unknown and null roles', () => {
    expect(isRoleAllowed(null, '/dashboard')).toBe(false)
    expect(isRoleAllowed(undefined, '/dashboard')).toBe(false)
    expect(isRoleAllowed('OWNER' as UserRole, '/dashboard')).toBe(false)
  })
})
