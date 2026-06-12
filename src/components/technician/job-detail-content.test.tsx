import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom'

import { JobDetailContent } from './job-detail-content'

const routerStore = vi.hoisted(() => ({
  push: vi.fn(),
  back: vi.fn(),
}))

const gpsStore = vi.hoisted(() => ({
  captureGps: vi.fn(async () => ({
    lat: -6.2,
    lng: 106.8,
    accuracy_m: 12,
    captured_at: '2026-06-11T10:00:00.000Z',
  })),
}))

const snapshotStore = vi.hoisted(() => ({
  lockJobSnapshot: vi.fn(async () => undefined),
  saveJobSnapshot: vi.fn(async () => undefined),
  jobToSnapshot: vi.fn((job: ReturnType<typeof makeJob>) => ({
    orderId: job.order_id,
    status: job.canonical_status,
    customer: { name: job.customers?.customer_name ?? null, address: job.order_items?.[0]?.locations?.full_address ?? null },
    scheduledDate: job.scheduled_visit_date,
    orderItems: [],
    technicianId: null,
    syncedAt: Date.now(),
    locked: false,
  })),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => routerStore,
}))

vi.mock('@/lib/utils/geolocation', () => ({
  captureGps: gpsStore.captureGps,
}))

vi.mock('@/lib/offline/snapshot', () => ({
  lockJobSnapshot: snapshotStore.lockJobSnapshot,
  saveJobSnapshot: snapshotStore.saveJobSnapshot,
  jobToSnapshot: snapshotStore.jobToSnapshot,
}))

vi.mock('@/components/orders/status-badge', () => ({
  StatusBadge: ({ status }: { status: string }) => <span data-testid="status-badge">{status}</span>,
}))

vi.mock('@/components/technician/photo-upload', () => ({
  PhotoUpload: ({ value, onChange, disabled }: { value: string[]; onChange: (urls: string[]) => void; disabled?: boolean }) => (
    <div data-testid="arrival-photo-upload">
      <p>arrival count {value.length}</p>
      <button type="button" disabled={disabled} onClick={() => onChange([...value, 'https://photos.test/arrival-1.jpg'])}>
        Add arrival photo
      </button>
    </div>
  ),
}))

function makeJob(canonicalStatus: 'ASSIGNED' | 'EN_ROUTE' | 'IN_PROGRESS' | 'COMPLETED') {
  return {
    order_id: 'WO-DETAIL-001',
    status: canonicalStatus,
    canonical_status: canonicalStatus,
    has_report: canonicalStatus === 'COMPLETED',
    scheduled_visit_date: '2026-06-11T10:00:00.000Z',
    notes: 'Customer minta cek outdoor',
    customers: {
      customer_name: 'Budi Detail',
      primary_contact_person: 'Budi',
      phone_number: '08123456789',
    },
    order_items: [
      {
        service_type: 'Service AC',
        description: 'Cuci AC kamar',
        locations: { full_address: 'Jl. Detail No. 1', city: 'Jakarta' },
        ac_units: { brand: 'Daikin', model_number: 'FTKQ', serial_number: 'SN-1' },
      },
    ],
  }
}

function renderJobDetail(status: 'ASSIGNED' | 'EN_ROUTE' | 'IN_PROGRESS' | 'COMPLETED') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.endsWith('/transition')) {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    return new Response(JSON.stringify({ success: true, data: makeJob(status) }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }))
  return render(
    <QueryClientProvider client={queryClient}>
      <JobDetailContent orderId="WO-DETAIL-001" />
    </QueryClientProvider>
  )
}

describe('JobDetailContent current transition behavior', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
    routerStore.push.mockClear()
    routerStore.back.mockClear()
    gpsStore.captureGps.mockClear()
    snapshotStore.lockJobSnapshot.mockClear()
    snapshotStore.saveJobSnapshot.mockClear()
    snapshotStore.jobToSnapshot.mockClear()
    vi.stubGlobal('crypto', { randomUUID: vi.fn(() => '55555555-5555-4555-8555-555555555555') })
  })

  it('renders ASSIGNED job and posts EN_ROUTE transition when technician taps Berangkat', async () => {
    renderJobDetail('ASSIGNED')

    expect(await screen.findByText('Budi Detail')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Berangkat/i })).toBeEnabled()

    fireEvent.click(screen.getByRole('button', { name: /Berangkat/i }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/technician/jobs/WO-DETAIL-001/transition', expect.objectContaining({ method: 'POST' }))
    })
    expect(snapshotStore.lockJobSnapshot).toHaveBeenCalledWith('WO-DETAIL-001')
    expect(gpsStore.captureGps).toHaveBeenCalledWith({ timeoutMs: 5000 })
    const transitionCall = vi.mocked(fetch).mock.calls.find((call) => String(call[0]).endsWith('/transition'))
    expect(JSON.parse(String(transitionCall?.[1]?.body))).toEqual({
      to_status: 'EN_ROUTE',
      idempotency_key: '55555555-5555-4555-8555-555555555555',
      gps: {
        lat: -6.2,
        lng: 106.8,
        accuracy_m: 12,
        captured_at: '2026-06-11T10:00:00.000Z',
      },
    })
  })

  it('requires arrival photo before posting EN_ROUTE to IN_PROGRESS transition', async () => {
    renderJobDetail('EN_ROUTE')

    fireEvent.click(await screen.findByRole('button', { name: /Mulai Kerja/i }))

    expect(await screen.findByText('Foto Kedatangan')).toBeInTheDocument()
    expect(screen.getByText('Minimal 1 foto wajib diupload')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Konfirmasi & Mulai Kerja/i })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: /Add arrival photo/i }))
    expect(screen.getByRole('button', { name: /Konfirmasi & Mulai Kerja/i })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: /Konfirmasi & Mulai Kerja/i }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/technician/jobs/WO-DETAIL-001/transition', expect.objectContaining({ method: 'POST' }))
    })
    const transitionCall = vi.mocked(fetch).mock.calls.find((call) => String(call[0]).endsWith('/transition'))
    expect(JSON.parse(String(transitionCall?.[1]?.body))).toEqual({
      to_status: 'IN_PROGRESS',
      idempotency_key: '55555555-5555-4555-8555-555555555555',
      gps: {
        lat: -6.2,
        lng: 106.8,
        accuracy_m: 12,
        captured_at: '2026-06-11T10:00:00.000Z',
      },
      arrival_photos: ['https://photos.test/arrival-1.jpg'],
    })
  })

  it('routes IN_PROGRESS job to completion wizard after locking snapshot', async () => {
    renderJobDetail('IN_PROGRESS')

    expect(await screen.findByText('Waktu Kerja')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Selesai Kerja/i }))

    await waitFor(() => expect(snapshotStore.lockJobSnapshot).toHaveBeenCalledWith('WO-DETAIL-001'))
    expect(routerStore.push).toHaveBeenCalledWith('/technician/job/WO-DETAIL-001/complete')
  })
})
