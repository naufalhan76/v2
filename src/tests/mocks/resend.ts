/**
 * Resend email mocks.
 *
 * Usage with vi.hoisted():
 *
 *   const { ResendMock, emailsSendMock } = vi.hoisted(() =>
 *     import('@/tests/mocks/resend').then(m => m.createResendMock())
 *   )
 *   vi.mock('resend', () => ({ Resend: ResendMock }))
 *
 * The Resend class is constructed with `new Resend(apiKey)`, so the mock
 * is a class that stores emails.send as a vi.fn().
 */
import { vi } from 'vitest'

export function createResendMock() {
  const emailsSendMock = vi.fn().mockResolvedValue({
    data: { id: 'email_123' },
    error: null,
  })

  const ResendMock = vi.fn().mockImplementation(() => ({
    emails: { send: emailsSendMock },
  }))

  return { ResendMock, emailsSendMock }
}
