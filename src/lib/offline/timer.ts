import { computeWorkDurationMinutes } from './time'

export const TIMER_STORAGE_KEY = 'msn-tech-active-timer'
export const WIZARD_PHASE_KEY = 'msn-tech-wizard-phase'

import type { Phase } from '@/components/technician/wizard/wizard-types'

export type ActiveTimer = {
  orderId: string
  work_started_at: string
}

export type CompletedTimer = ActiveTimer & {
  work_completed_at: string
  durationMinutes: number
}

/** Starts a persistent timer for one order, preserving an existing same-order timer. */
export function startTimer(orderId: string): ActiveTimer {
  const activeTimer = getActiveTimer()

  if (activeTimer) {
    if (activeTimer.orderId === orderId) {
      return activeTimer
    }
    throw new Error(`Timer already active for order ${activeTimer.orderId}`)
  }

  const timer = {
    orderId,
    work_started_at: new Date(Date.now()).toISOString(),
  }

  localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(timer))

  return timer
}

/** Reads the persisted active timer, or null when no valid timer exists. */
export function getActiveTimer(): ActiveTimer | null {
  const rawTimer = localStorage.getItem(TIMER_STORAGE_KEY)

  if (!rawTimer) {
    return null
  }

  try {
    const parsedTimer = JSON.parse(rawTimer) as Partial<ActiveTimer>

    if (typeof parsedTimer.orderId !== 'string' || typeof parsedTimer.work_started_at !== 'string') {
      return null
    }

    return {
      orderId: parsedTimer.orderId,
      work_started_at: parsedTimer.work_started_at,
    }
  } catch {
    return null
  }
}

/** Stops a matching active timer and returns completed timestamp plus duration. */
export function stopTimer(orderId: string): CompletedTimer | null {
  const activeTimer = getActiveTimer()

  if (!activeTimer || activeTimer.orderId !== orderId) {
    return null
  }

  const workCompletedAt = new Date(Date.now()).toISOString()
  const completedTimer = {
    ...activeTimer,
    work_completed_at: workCompletedAt,
    durationMinutes: computeWorkDurationMinutes(activeTimer.work_started_at, workCompletedAt),
  }

  localStorage.removeItem(TIMER_STORAGE_KEY)

  return completedTimer
}

/** Returns true when the given order owns the active timer. */
export function isTimerActive(orderId: string): boolean {
  return getActiveTimer()?.orderId === orderId
}

/** Computes elapsed seconds from the stored start timestamp without storing counters. */
export function getElapsedSeconds(orderId: string): number {
  const activeTimer = getActiveTimer()

  if (!activeTimer || activeTimer.orderId !== orderId) {
    return 0
  }

  const elapsedMs = Date.now() - new Date(activeTimer.work_started_at).getTime()

  return Math.max(0, Math.floor(elapsedMs / 1000))
}

/** Returns true when any order has an active timer, for blocking second job start. */
export function hasAnyActiveTimer(): boolean {
  return getActiveTimer() !== null
}

/** Clears a matching active timer after successful report submission. */
export function clearTimer(orderId: string): void {
  if (isTimerActive(orderId)) {
    localStorage.removeItem(TIMER_STORAGE_KEY)
  }
}

/** Reads the persisted wizard phase for an order, or null when invalid/absent. */
export function getWizardPhase(orderId: string): Phase | null {
  const rawPhase = localStorage.getItem(`${WIZARD_PHASE_KEY}-${orderId}`)

  if (!rawPhase) {
    return null
  }

  try {
    const parsedPhase = JSON.parse(rawPhase)

    if (parsedPhase === 'A' || parsedPhase === 'B' || parsedPhase === 'C') {
      return parsedPhase as Phase
    }

    return null
  } catch {
    return null
  }
}

/** Persists the current wizard phase for an order. Only stores 'A', 'B', or 'C'. */
export function setWizardPhase(orderId: string, phase: Phase): void {
  if (phase === 'A' || phase === 'B' || phase === 'C') {
    localStorage.setItem(`${WIZARD_PHASE_KEY}-${orderId}`, JSON.stringify(phase))
  }
}

/** Removes the persisted wizard phase for an order. */
export function clearWizardPhase(orderId: string): void {
  localStorage.removeItem(`${WIZARD_PHASE_KEY}-${orderId}`)
}
