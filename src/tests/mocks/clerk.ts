/**
 * Clerk auth mocks.
 *
 * Usage with vi.hoisted():
 *
 *   const { authMock, clerkClientMock } = vi.hoisted(() =>
 *     import('@/tests/mocks/clerk').then(m => m.createClerkMock())
 *   )
 *   vi.mock('@clerk/nextjs/server', () => ({
 *     auth: authMock,
 *     clerkClient: clerkClientMock,
 *   }))
 */
import { vi } from 'vitest'

export function createClerkMock() {
  const authMock = vi.fn().mockResolvedValue({ userId: 'user-1' })

  const createUser = vi.fn().mockResolvedValue({ id: 'user_clerk_1' })
  const deleteUser = vi.fn().mockResolvedValue({ id: 'user_clerk_1' })
  const updateUser = vi.fn().mockResolvedValue({ id: 'user_clerk_1' })

  const clerkClientMock = vi.fn().mockResolvedValue({
    users: { createUser, deleteUser, updateUser },
  })

  return { authMock, clerkClientMock, createUser, deleteUser, updateUser }
}
