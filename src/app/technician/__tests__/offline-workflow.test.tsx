import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'

import { JobCompletionWizard } from '@/components/technician/job-completion-wizard'

// 1. Snapshot definition inline (since it doesn't exist yet)
export type LocalJobSnapshot = {
  orderId: string
  status: string
  orderItems: Array<{
    id: string
    serviceType: string
  }>
  syncedAt: number
}

// 2. Pure function duration calc test definition inline (since it doesn't exist)
// TODO: move to src/lib/offline/time.ts
export const computeWorkDurationMinutes = (startedAt: string, completedAt: string): number => {
  return 0 // dummy to make test fail (RED baseline)
}

// Mocking Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ toast: vi.fn() })
}))

describe('Offline-First PWA Workflow (Red Baseline)', () => {

  describe('1. Wizard Offline Snapshot Mount', () => {
    it.fails('[RED BASELINE] renders wizard from snapshot prop when network fails', () => {
      const mockSnapshot: LocalJobSnapshot = {
        orderId: 'WO-OFFLINE-001',
        status: 'Diproses',
        orderItems: [
          { id: 'item-1', serviceType: 'Service AC' }
        ],
        syncedAt: Date.now() - 60000 // 1 minute ago
      }

      // We expect the wizard to accept a `snapshot` prop and display its data
      render(<JobCompletionWizard orderId="WO-OFFLINE-001" snapshot={mockSnapshot as any} />)
      
      // Should show the order ID from the snapshot
      expect(screen.getByText(/WO-OFFLINE-001/i)).toBeInTheDocument()
      
      // Should display offline indicator
      expect(screen.getByText(/Offline Mode/i)).toBeInTheDocument()
      
      // Data from snapshot
      expect(screen.getByText(/Service AC/i)).toBeInTheDocument()
    })
  })

  describe('2. Timer Precheck Gate', () => {
    it.fails('[RED BASELINE] timer Start button is disabled until before photos and AC fields pass', () => {
      render(<JobCompletionWizard orderId="WO-OFFLINE-002" />)
      
      // The timer start button should be present
      const startTimerBtn = screen.getByRole('button', { name: /Mulai Waktu/i })
      
      // Initially disabled
      expect(startTimerBtn).toBeDisabled()
      
      // Should have some visual indicator of why it's disabled
      expect(screen.getByText(/Harus upload foto sebelum/i)).toBeInTheDocument()
      expect(screen.getByText(/Lengkapi data AC/i)).toBeInTheDocument()
    })
  })

  describe('3. Duration Calculation', () => {
    it.fails('[RED BASELINE] rounds duration to the nearest minute', () => {
      const baseTime = new Date('2026-06-11T10:00:00.000Z')
      
      // 89 seconds -> 1 minute (1.48 mins -> Math.round -> 1)
      const end89s = new Date(baseTime.getTime() + 89 * 1000)
      expect(computeWorkDurationMinutes(baseTime.toISOString(), end89s.toISOString())).toBe(1)
      
      // 90 seconds -> 2 minutes (1.5 mins -> Math.round -> 2)
      const end90s = new Date(baseTime.getTime() + 90 * 1000)
      expect(computeWorkDurationMinutes(baseTime.toISOString(), end90s.toISOString())).toBe(2)
      
      // 0 seconds -> 0 minutes
      expect(computeWorkDurationMinutes(baseTime.toISOString(), baseTime.toISOString())).toBe(0)
      
      // 3661 seconds (61 mins, 1s) -> 61 minutes
      const end3661s = new Date(baseTime.getTime() + 3661 * 1000)
      expect(computeWorkDurationMinutes(baseTime.toISOString(), end3661s.toISOString())).toBe(61)
    })
  })
})
