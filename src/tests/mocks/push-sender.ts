/**
 * Push notification sender mocks.
 *
 * Usage with vi.hoisted():
 *
 *   const pushMocks = vi.hoisted(() =>
 *     import('@/tests/mocks/push-sender').then(m => m.createPushSenderMock())
 *   )
 *   vi.mock('@/lib/server/push-sender', () => pushMocks.mockModule)
 */
import { vi } from 'vitest'

export function createPushSenderMock() {
  const sendPushToUser = vi.fn().mockResolvedValue({ sent: 1, pruned: 0, failed: 0 })
  const sendJobAssignedNotification = vi.fn().mockResolvedValue(undefined)
  const sendJobRescheduledNotification = vi.fn().mockResolvedValue(undefined)
  const sendJobReassignedAwayNotification = vi.fn().mockResolvedValue(undefined)
  const sendJobCancelledByAdminNotification = vi.fn().mockResolvedValue(undefined)
  const sendJobAutoRevertedNotification = vi.fn().mockResolvedValue(undefined)

  return {
    sendPushToUser,
    sendJobAssignedNotification,
    sendJobRescheduledNotification,
    sendJobReassignedAwayNotification,
    sendJobCancelledByAdminNotification,
    sendJobAutoRevertedNotification,
    /** Pass this as the vi.mock factory return value. */
    mockModule: {
      sendPushToUser,
      sendJobAssignedNotification,
      sendJobRescheduledNotification,
      sendJobReassignedAwayNotification,
      sendJobCancelledByAdminNotification,
      sendJobAutoRevertedNotification,
    },
  }
}
