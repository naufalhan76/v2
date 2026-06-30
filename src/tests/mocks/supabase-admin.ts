/**
 * Admin Supabase client mock (same chain interface as supabase-chain).
 *
 * Usage with vi.hoisted():
 *
 *   const { adminFrom, adminRpc } = vi.hoisted(() => {
 *     const m = await import('@/tests/mocks/supabase-admin')
 *     return m.createAdminClientMock()
 *   })
 *   vi.mock('@/lib/supabase-admin', () => ({
 *     createAdminClient: () => ({ from: adminFrom, rpc: adminRpc }),
 *   }))
 */
import { vi } from 'vitest'
import { createChain, type ChainResult } from './supabase-chain'

export function createAdminClientMock() {
  const fromMock = vi.fn()
  const rpcMock = vi.fn()

  return {
    from: fromMock,
    rpc: rpcMock,
    fromReturns: (result: ChainResult) => {
      fromMock.mockReturnValue(createChain(result))
    },
    adminClient: { from: fromMock, rpc: rpcMock },
  }
}
