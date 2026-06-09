import { beforeEach, describe, expect, it, vi } from 'vitest'

const createClientMock = vi.fn()
const createAdminClientMock = vi.fn()
const revalidatePathMock = vi.fn()
const inviteUserByEmailMock = vi.fn()

vi.mock('server-only', () => ({}))

vi.mock('@/lib/supabase-server', () => ({
  createClient: () => createClientMock(),
}))

vi.mock('@/lib/supabase-admin', () => ({
  createAdminClient: () => createAdminClientMock(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => revalidatePathMock(...args),
}))

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

vi.mock('@/lib/auth-guards', () => ({
  requireSuperAdmin: vi.fn(),
}))

import { acceptInvite, inviteUser, resendInvite } from './users'

type Result = { data: unknown; error: { message: string } | null }

function chain(result: Result) {
  const builder: Record<string, unknown> = {}
  for (const method of ['select', 'eq', 'insert', 'update', 'upsert', 'single', 'maybeSingle', 'order']) {
    builder[method] = vi.fn(() => builder)
  }
  ;(builder as { then: unknown }).then = (onFulfilled: (value: Result) => unknown) => Promise.resolve(result).then(onFulfilled)
  return builder
}

function makeClient(results: Record<string, Result[]>) {
  const calls: Record<string, number> = {}
  const builders: Record<string, Record<string, unknown>[]> = {}
  return {
    builders,
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'super-1' } }, error: null }),
      admin: {
        inviteUserByEmail: inviteUserByEmailMock,
      },
    },
    from: vi.fn((table: string) => {
      calls[table] = calls[table] ?? 0
      const result = results[table]?.[calls[table]++] ?? { data: null, error: null }
      const builder = chain(result)
      builders[table] = builders[table] ?? []
      builders[table].push(builder)
      return builder
    }),
  }
}

function sessionClient(role = 'SUPERADMIN') {
  return makeClient({
    user_management: [{ data: { auth_user_id: 'super-1', role, is_active: true }, error: null }],
  })
}

describe('user invite actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    inviteUserByEmailMock.mockResolvedValue({ data: { user: { id: 'auth-1' } }, error: null })
  })

  it('creates PENDING user_invites row when inviting', async () => {
    createClientMock.mockResolvedValue(sessionClient())
    const admin = makeClient({
      user_management: [{ data: null, error: null }],
      user_invites: [
        { data: null, error: null },
        { data: null, error: null },
      ],
    })
    createAdminClientMock.mockReturnValue(admin)

    const result = await inviteUser({ email: ' New.User@Example.com ', role: 'ADMIN' })

    expect(result).toEqual({ success: true, error: null })
    expect(inviteUserByEmailMock).toHaveBeenCalledWith('new.user@example.com', { data: { role: 'ADMIN' } })
    const inviteInsert = admin.builders.user_invites[1].insert as ReturnType<typeof vi.fn>
    expect(inviteInsert).toHaveBeenCalledWith(expect.objectContaining({
      email: 'new.user@example.com',
      role: 'ADMIN',
      status: 'PENDING',
      invited_by: 'super-1',
    }))
    expect(revalidatePathMock).toHaveBeenCalledWith('/dashboard/manajemen/user')
  })

  it('rejects non-SUPERADMIN invite before Supabase admin call', async () => {
    createClientMock.mockResolvedValue(sessionClient('ADMIN'))

    const result = await inviteUser({ email: 'admin@example.com', role: 'ADMIN' })

    expect(result.success).toBe(false)
    expect(result.error).toBe('Hanya SUPERADMIN yang dapat mengundang user')
    expect(createAdminClientMock).not.toHaveBeenCalled()
    expect(inviteUserByEmailMock).not.toHaveBeenCalled()
  })

  it('rejects duplicate active email', async () => {
    createClientMock.mockResolvedValue(sessionClient())
    createAdminClientMock.mockReturnValue(makeClient({
      user_management: [{ data: { email: 'active@example.com' }, error: null }],
    }))

    const result = await inviteUser({ email: 'active@example.com', role: 'ADMIN' })

    expect(result).toEqual({ success: false, error: 'Email sudah terdaftar sebagai pengguna aktif' })
    expect(inviteUserByEmailMock).not.toHaveBeenCalled()
  })

  it('resends pending invite and updates last_sent_at', async () => {
    createClientMock.mockResolvedValue(sessionClient())
    const admin = makeClient({
      user_invites: [
        { data: { invite_id: 'invite-1', email: 'pending@example.com', role: 'TECHNICIAN', status: 'PENDING' }, error: null },
        { data: null, error: null },
      ],
      user_management: [{ data: null, error: null }],
    })
    createAdminClientMock.mockReturnValue(admin)

    const result = await resendInvite('invite-1')

    expect(result).toEqual({ success: true, error: null })
    expect(inviteUserByEmailMock).toHaveBeenCalledWith('pending@example.com', { data: { role: 'TECHNICIAN' } })
    const update = admin.builders.user_invites[1].update as ReturnType<typeof vi.fn>
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ last_sent_at: expect.any(String) }))
  })

  it('accepts invite and creates active user_management profile', async () => {
    const admin = makeClient({
      user_invites: [
        { data: { invite_id: 'invite-1', email: 'tech@example.com', role: 'TECHNICIAN', status: 'PENDING' }, error: null },
        { data: null, error: null },
      ],
      user_management: [
        { data: null, error: null },
        { data: null, error: null },
      ],
    })
    createAdminClientMock.mockReturnValue(admin)

    const result = await acceptInvite('invite-1', 'auth-tech-1')

    expect(result).toEqual({ success: true, error: null })
    const upsert = admin.builders.user_management[1].upsert as ReturnType<typeof vi.fn>
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      auth_user_id: 'auth-tech-1',
      email: 'tech@example.com',
      role: 'TECHNICIAN',
      is_active: true,
    }), { onConflict: 'auth_user_id' })
    const update = admin.builders.user_invites[1].update as ReturnType<typeof vi.fn>
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: 'ACCEPTED', accepted_at: expect.any(String) }))
  })
})
