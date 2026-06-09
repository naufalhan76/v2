import type { UserRole } from './rbac'

export type { UserRole }

export type AuthRoute = '/' | '/login' | '/dashboard' | '/technician' | '/dashboard/manajemen/user'

export type RouteAccess = {
  allowUnauthenticated: boolean
  allowedRoles: readonly UserRole[]
  unauthenticatedRedirect?: AuthRoute
  authenticatedRedirects?: Partial<Record<UserRole, AuthRoute>>
}

export type UserProfile = {
  auth_user_id: string
  email: string | null
  full_name?: string | null
  role: UserRole
  is_active: boolean
}

export const ALL_ROLES = ['SUPERADMIN', 'ADMIN', 'FINANCE', 'TECHNICIAN'] as const satisfies readonly UserRole[]
export const ADMIN_ROLES = ['SUPERADMIN', 'ADMIN'] as const satisfies readonly UserRole[]
export const FINANCE_ROLES = ['SUPERADMIN', 'ADMIN', 'FINANCE'] as const satisfies readonly UserRole[]

export const ROUTE_ROLE_MATRIX = {
  '/': {
    allowUnauthenticated: false,
    allowedRoles: ALL_ROLES,
    unauthenticatedRedirect: '/login',
    authenticatedRedirects: {
      SUPERADMIN: '/dashboard',
      ADMIN: '/dashboard',
      FINANCE: '/dashboard',
      TECHNICIAN: '/technician',
    },
  },
  '/login': {
    allowUnauthenticated: true,
    allowedRoles: [],
    authenticatedRedirects: {
      SUPERADMIN: '/dashboard',
      ADMIN: '/dashboard',
      FINANCE: '/dashboard',
      TECHNICIAN: '/technician',
    },
  },
  '/dashboard': {
    allowUnauthenticated: false,
    allowedRoles: FINANCE_ROLES,
    unauthenticatedRedirect: '/login',
    authenticatedRedirects: {
      TECHNICIAN: '/technician',
    },
  },
  '/technician': {
    allowUnauthenticated: false,
    allowedRoles: ['TECHNICIAN'],
    unauthenticatedRedirect: '/login',
    authenticatedRedirects: {
      SUPERADMIN: '/dashboard',
      ADMIN: '/dashboard',
      FINANCE: '/dashboard',
    },
  },
  '/dashboard/manajemen/user': {
    allowUnauthenticated: false,
    allowedRoles: ['SUPERADMIN'],
    unauthenticatedRedirect: '/login',
    authenticatedRedirects: {
      ADMIN: '/dashboard',
      FINANCE: '/dashboard',
      TECHNICIAN: '/technician',
    },
  },
} as const satisfies Record<AuthRoute, RouteAccess>

// Invite state uses user_invites table (Option B). See migration.
// Schema decision: user_invites(invite_id UUID PK, email TEXT, role UserRole,
// status ENUM('PENDING','ACCEPTED','EXPIRED','CANCELLED'), invited_by UUID,
// invited_at TIMESTAMPTZ, last_sent_at TIMESTAMPTZ, accepted_at TIMESTAMPTZ,
// created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ), with a unique partial index
// enforcing one PENDING invite per email.

export function isUserRole(role: unknown): role is UserRole {
  return typeof role === 'string' && (ALL_ROLES as readonly string[]).includes(role)
}

export function isRoleAllowed(role: UserRole | null | undefined, route: AuthRoute): boolean {
  if (!role || !isUserRole(role)) return false

  return (ROUTE_ROLE_MATRIX[route]?.allowedRoles as readonly UserRole[] | undefined)?.includes(role) ?? false
}

function authGuardsNotImplemented(): never {
  throw new Error('Auth guard implementation belongs in src/lib/auth-guards.ts')
}

export function getCurrentUserProfile(): Promise<UserProfile | null> {
  return authGuardsNotImplemented()
}

export function requireUserProfile(): Promise<UserProfile> {
  return authGuardsNotImplemented()
}

export function requireRole(role: UserRole): Promise<UserProfile> {
  void role
  return authGuardsNotImplemented()
}

export function requireAnyRole(roles: readonly UserRole[]): Promise<UserProfile> {
  void roles
  return authGuardsNotImplemented()
}

export function requireSuperAdmin(): Promise<UserProfile> {
  return authGuardsNotImplemented()
}

export function requireFinanceAccess(): Promise<UserProfile> {
  return authGuardsNotImplemented()
}
