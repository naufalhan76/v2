import { beforeEach, describe, expect, it, vi } from 'vitest'

const createClientMock = vi.fn()

vi.mock('@/lib/supabase-server', () => ({
  createClient: () => createClientMock(),
}))

import type { UserProfile } from './auth-roles'
import { requireAnyRole, requireSuperAdmin, requireUserProfile } from './auth-guards'

const superAdminProfile: UserProfile = {
  auth_user_id: 'user-superadmin',
  email: 'superadmin@example.com',
  full_name: 'Super Admin',
  role: 'SUPERADMIN',
  is_active: true,
}

const adminProfile: UserProfile = {
  auth_user_id: 'user-admin',
  email: 'admin@example.com',
  full_name: 'Admin',
  role: 'ADMIN',
  is_active: true,
}

function buildClient(user: { id: string } | null, profile: UserProfile | null) {
  const builder: Record<string, unknown> = {}
  builder.select = vi.fn(() => builder)
  builder.eq = vi.fn(() => builder)
  builder.maybeSingle = vi.fn(() => Promise.resolve({ data: profile, error: null }))

  return {
    auth: {
      getUser: vi.fn(() => Promise.resolve({ data: { user } })),
    },
    from: vi.fn(() => builder),
  }
}

describe('auth guards', () => {
  beforeEach(() => {
    createClientMock.mockReset()
  })

  it('requireUserProfile returns profile for valid session and active user', async () => {
    createClientMock.mockResolvedValue(buildClient({ id: superAdminProfile.auth_user_id }, superAdminProfile))

    await expect(requireUserProfile()).resolves.toEqual(superAdminProfile)
  })

  it('requireUserProfile throws on null user', async () => {
    createClientMock.mockResolvedValue(buildClient(null, null))

    await expect(requireUserProfile()).rejects.toThrow('Unauthorized: active user profile required')
  })

  it('requireUserProfile throws on inactive user', async () => {
    createClientMock.mockResolvedValue(
      buildClient({ id: adminProfile.auth_user_id }, { ...adminProfile, is_active: false })
    )

    await expect(requireUserProfile()).rejects.toThrow('Unauthorized: active user profile required')
  })

  it("requireAnyRole(['SUPERADMIN']) throws for ADMIN role", async () => {
    createClientMock.mockResolvedValue(buildClient({ id: adminProfile.auth_user_id }, adminProfile))

    await expect(requireAnyRole(['SUPERADMIN'])).rejects.toThrow(
      'Unauthorized: one of SUPERADMIN roles required'
    )
  })

  it('requireSuperAdmin passes for SUPERADMIN', async () => {
    createClientMock.mockResolvedValue(buildClient({ id: superAdminProfile.auth_user_id }, superAdminProfile))

    await expect(requireSuperAdmin()).resolves.toEqual(superAdminProfile)
  })

  it('requireSuperAdmin throws for ADMIN', async () => {
    createClientMock.mockResolvedValue(buildClient({ id: adminProfile.auth_user_id }, adminProfile))

    await expect(requireSuperAdmin()).rejects.toThrow('Unauthorized: one of SUPERADMIN roles required')
  })
})
