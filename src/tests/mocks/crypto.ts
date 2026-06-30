/**
 * crypto.randomUUID mock.
 *
 * Usage with vi.hoisted():
 *
 *   const { randomUUIDMock } = vi.hoisted(() =>
 *     import('@/tests/mocks/crypto').then(m => m.createCryptoMock())
 *   )
 *   // In beforeEach or per-test: randomUUIDMock.mockReturnValue('fixed-uuid')
 *
 * ponytail: Replaces globalThis.crypto.randomUUID. No setupFiles needed.
 */
import { vi } from 'vitest'

export function createCryptoMock() {
  const randomUUIDMock = vi.fn().mockReturnValue('mock-uuid-0000')

  // Preserve original for restoration if needed
  const original = globalThis.crypto?.randomUUID

  return {
    randomUUIDMock,
    /** Install the mock on globalThis.crypto. Call in beforeEach. */
    install: () => {
      Object.defineProperty(globalThis, 'crypto', {
        value: { ...globalThis.crypto, randomUUID: randomUUIDMock },
        configurable: true,
      })
    },
    /** Restore original. Call in afterEach if needed. */
    restore: () => {
      if (original) {
        Object.defineProperty(globalThis, 'crypto', {
          value: { ...globalThis.crypto, randomUUID: original },
          configurable: true,
        })
      }
    },
  }
}
