import { fireEvent, render, screen, act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom'

import { WizardPhaseB } from './wizard-phase-b'
import * as timer from '../../lib/offline/timer'

const jobSummary = {
  customerName: 'Budi Santoso',
  address: 'Jl. Melati No. 10',
  serviceType: 'Service AC Split',
}

function renderPhaseB(onComplete = vi.fn()) {
  render(<WizardPhaseB orderId="WO-PHASE-B-001" jobSummary={jobSummary} onComplete={onComplete} />)
  return onComplete
}

describe('WizardPhaseB', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-12T08:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('auto-starts the order timer on mount and displays elapsed time in HH:MM:SS format', () => {
    renderPhaseB()

    expect(timer.getActiveTimer()).toEqual({
      orderId: 'WO-PHASE-B-001',
      work_started_at: '2026-06-12T08:00:00.000Z',
    })
    expect(screen.getByLabelText('Waktu kerja berjalan')).toHaveTextContent('00:00:00')

    act(() => {
      vi.setSystemTime(new Date('2026-06-12T08:01:04.000Z'))
      vi.advanceTimersByTime(1000)
    })

    expect(screen.getByLabelText('Waktu kerja berjalan')).toHaveTextContent('00:01:05')
  })

  it('uses getElapsedSeconds from the timer module for the displayed duration', () => {
    timer.startTimer('WO-PHASE-B-001')
    const elapsedSpy = vi.spyOn(timer, 'getElapsedSeconds').mockReturnValue(3661)

    renderPhaseB()

    expect(elapsedSpy).toHaveBeenCalledWith('WO-PHASE-B-001')
    expect(screen.getByLabelText('Waktu kerja berjalan')).toHaveTextContent('01:01:01')
  })

  it('survives page refresh by reusing the persisted timer timestamp', () => {
    timer.startTimer('WO-PHASE-B-001')
    vi.setSystemTime(new Date('2026-06-12T08:02:30.000Z'))

    const { unmount } = render(<WizardPhaseB orderId="WO-PHASE-B-001" jobSummary={jobSummary} onComplete={vi.fn()} />)
    expect(screen.getByLabelText('Waktu kerja berjalan')).toHaveTextContent('00:02:30')
    unmount()

    vi.setSystemTime(new Date('2026-06-12T08:02:35.000Z'))
    render(<WizardPhaseB orderId="WO-PHASE-B-001" jobSummary={jobSummary} onComplete={vi.fn()} />)

    expect(screen.getByLabelText('Waktu kerja berjalan')).toHaveTextContent('00:02:35')
    expect(timer.getActiveTimer()?.work_started_at).toBe('2026-06-12T08:00:00.000Z')
  })

  it('shows the active work label and job summary', () => {
    renderPhaseB()

    expect(screen.getByText('Sedang Bekerja')).toBeInTheDocument()
    expect(screen.getByText('Langkah 2 dari 3')).toBeInTheDocument()
    expect(screen.getByText('Budi Santoso')).toBeInTheDocument()
    expect(screen.getByText('Jl. Melati No. 10')).toBeInTheDocument()
    expect(screen.getByText('Service AC Split')).toBeInTheDocument()
  })

  it('blocks page navigation affordances by rendering no back button and no bottom navigation links', () => {
    const pushStateSpy = vi.spyOn(window.history, 'pushState')

    renderPhaseB()
    window.dispatchEvent(new PopStateEvent('popstate'))

    expect(screen.queryByRole('button', { name: /kembali|back/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: /navigasi utama/i })).not.toBeInTheDocument()
    expect(pushStateSpy).toHaveBeenCalledWith({ phaseBLocked: true }, '', window.location.href)
  })

  it('moves to Phase C when Isi Detail Pekerjaan is pressed', () => {
    const onComplete = renderPhaseB()

    fireEvent.click(screen.getByRole('button', { name: 'Isi Detail Pekerjaan' }))

    expect(onComplete).toHaveBeenCalledTimes(1)
  })
})
