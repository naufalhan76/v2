/**
 * Supabase chain builder mock.
 *
 * Usage with vi.hoisted():
 *
 *   const { from, createChain } = vi.hoisted(() => {
 *     const m = await import('@/tests/mocks/supabase-chain')
 *     return m.createSupabaseMock()
 *   })
 *   vi.mock('@/lib/supabase-server', () => ({
 *     createClient: () => Promise.resolve({ from }),
 *   }))
 *
 * Or simpler — import createSupabaseMock and call in beforeEach.
 */
import { vi } from 'vitest'

export interface ChainResult {
  data: unknown
  error: { message: string } | null
}

/** vi.fn() return type — callable + has .mock, .toHaveBeenCalledWith, etc. */
type ChainFn = ReturnType<typeof vi.fn<(...args: unknown[]) => ChainBuilder>>
export interface ChainBuilder {
  select: ChainFn
  eq: ChainFn
  insert: ChainFn
  update: ChainFn
  delete: ChainFn
  order: ChainFn
  in: ChainFn
  neq: ChainFn
  is: ChainFn
  not: ChainFn
  gte: ChainFn
  lte: ChainFn
  lt: ChainFn
  rpc: ChainFn
  limit: ChainFn
  range: ChainFn
  single: ChainFn
  maybeSingle: ChainFn
  then: (onFulfilled: (v: ChainResult) => unknown) => Promise<unknown>
}

export function createChain(defaultResult: ChainResult): ChainBuilder {
  const b = {} as Record<string, unknown>
  let mode: 'many' | 'single' | 'maybeSingle' = 'many'

  const methods = [
    'select', 'eq', 'insert', 'update', 'delete', 'order',
    'in', 'neq', 'is', 'not', 'gte', 'lte', 'lt',
    'rpc', 'limit', 'range',
  ]
  for (const m of methods) {
    b[m] = vi.fn(() => builder)
  }

  b.single = vi.fn(() => { mode = 'single'; return builder })
  b.maybeSingle = vi.fn(() => { mode = 'maybeSingle'; return builder })

  b.then = (onFulfilled: (v: ChainResult) => unknown) => {
    let result = defaultResult
    if (defaultResult.data == null && !defaultResult.error) {
      if (mode === 'single') {
        result = { data: null, error: { message: 'Row not found' } }
      } else if (mode === 'maybeSingle') {
        result = { data: null, error: null }
      }
    }
    return Promise.resolve(result).then(onFulfilled)
  }

  const builder = b as unknown as ChainBuilder
  return builder
}

/**
 * Returns a mock `from` function and helpers.
 * Each `from(table)` call returns whatever chain you pre-configured.
 */
export function createSupabaseMock() {
  const fromMock = vi.fn()
  const rpcMock = vi.fn()

  return {
    from: fromMock,
    rpc: rpcMock,
    /** Convenience: make from() always return a chain with given result. */
    fromReturns: (result: ChainResult) => {
      fromMock.mockReturnValue(createChain(result))
    },
    /** Mock client shape (for createClient / createAdminClient). */
    client: { from: fromMock, rpc: rpcMock },
  }
}
