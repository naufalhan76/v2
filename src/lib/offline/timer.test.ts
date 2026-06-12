import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  TIMER_STORAGE_KEY,
  clearTimer,
  getActiveTimer,
  getElapsedSeconds,
  hasAnyActiveTimer,
  isTimerActive,
  startTimer,
  stopTimer,
} from './timer'

const STARTED_AT = '2026-06-12T08:00:00.000Z'

describe('offline technician timer', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
    vi.setSystemTime(new Date(STARTED_AT))
  })

  afterEach(() => {
    vi.useRealTimers()
    localStorage.clear()
  })

  it('stores work_started_at in localStorage when starting a timer', () => {
    const timer = startTimer('order-1')

    expect(timer).toEqual({ orderId: 'order-1', work_started_at: STARTED_AT })
    expect(JSON.parse(localStorage.getItem(TIMER_STORAGE_KEY) ?? '{}')).toEqual(timer)
  })

  it('returns the active timer from storage', () => {
    startTimer('order-1')

    expect(getActiveTimer()).toEqual({ orderId: 'order-1', work_started_at: STARTED_AT })
  })

  it('returns null when no timer is active', () => {
    expect(getActiveTimer()).toBeNull()
  })

  it('reports whether a specific order timer is active', () => {
    startTimer('order-1')

    expect(isTimerActive('order-1')).toBe(true)
    expect(isTimerActive('order-2')).toBe(false)
  })

  it('computes elapsed seconds from stored timestamp and Date.now', () => {
    startTimer('order-1')
    vi.setSystemTime(new Date('2026-06-12T08:02:05.000Z'))

    expect(getElapsedSeconds('order-1')).toBe(125)
  })

  it('returns zero elapsed seconds for a different order', () => {
    startTimer('order-1')
    vi.setSystemTime(new Date('2026-06-12T08:02:05.000Z'))

    expect(getElapsedSeconds('order-2')).toBe(0)
  })

  it('reports whether any timer is active', () => {
    expect(hasAnyActiveTimer()).toBe(false)

    startTimer('order-1')

    expect(hasAnyActiveTimer()).toBe(true)
  })

  it('prevents starting a second order while one is active', () => {
    startTimer('order-1')

    expect(() => startTimer('order-2')).toThrow('Timer already active for order order-1')
    expect(getActiveTimer()).toEqual({ orderId: 'order-1', work_started_at: STARTED_AT })
  })

  it('keeps starting the same active order idempotent', () => {
    const firstTimer = startTimer('order-1')
    vi.setSystemTime(new Date('2026-06-12T08:05:00.000Z'))

    expect(startTimer('order-1')).toEqual(firstTimer)
    expect(getActiveTimer()).toEqual(firstTimer)
  })

  it('stops an active timer, stores work_completed_at, and returns duration in minutes', () => {
    startTimer('order-1')
    vi.setSystemTime(new Date('2026-06-12T08:12:31.000Z'))

    expect(stopTimer('order-1')).toEqual({
      orderId: 'order-1',
      work_started_at: STARTED_AT,
      work_completed_at: '2026-06-12T08:12:31.000Z',
      durationMinutes: 13,
    })
    expect(getActiveTimer()).toBeNull()
  })

  it('returns null when stopping a timer for an inactive order', () => {
    startTimer('order-1')

    expect(stopTimer('order-2')).toBeNull()
    expect(isTimerActive('order-1')).toBe(true)
  })

  it('survives page refresh by reading existing localStorage data', async () => {
    startTimer('order-1')
    vi.resetModules()

    const refreshedModule = await import('./timer')

    expect(refreshedModule.getActiveTimer()).toEqual({ orderId: 'order-1', work_started_at: STARTED_AT })
  })

  it('clears the active timer for matching order after successful report submit', () => {
    startTimer('order-1')

    clearTimer('order-1')

    expect(getActiveTimer()).toBeNull()
  })

  it('does not clear another order timer', () => {
    startTimer('order-1')

    clearTimer('order-2')

    expect(isTimerActive('order-1')).toBe(true)
  })
})
