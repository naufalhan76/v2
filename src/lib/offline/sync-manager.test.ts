import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { TechnicianReportPayload, TechnicianTransitionPayload } from '../../app/api/schemas/technician'
import type { PendingPhotoRecord, PendingReportRecord, PendingTransitionRecord } from './db'

const dbState = vi.hoisted(() => ({
  reports: [] as PendingReportRecord[],
  transitions: [] as PendingTransitionRecord[],
  photos: [] as PendingPhotoRecord[],
  conflicts: [] as unknown[],
  quotaCritical: false,
}))

const authState = vi.hoisted(() => ({
  result: { ok: true as const },
}))

const swState = vi.hoisted(() => ({
  postMessage: vi.fn(),
}))

const storageState = vi.hoisted(() => ({
  upload: vi.fn(async (path: string) => ({ data: { path }, error: null })),
  bucketCalls: [] as string[],
}))

vi.mock('@/lib/offline/db', () => ({
  isQuotaCritical: vi.fn(async () => dbState.quotaCritical),
  putPhoto: vi.fn(async (record: PendingPhotoRecord) => {
    dbState.photos = [...dbState.photos.filter((photo) => photo.id !== record.id), record]
  }),
  getPhoto: vi.fn(async (id: string) => dbState.photos.find((photo) => photo.id === id)),
  getPhotosForOrder: vi.fn(async (orderId: string) => dbState.photos.filter((photo) => photo.orderId === orderId)),
  markPhotoUploaded: vi.fn(async (id: string, uploadedPath: string) => {
    dbState.photos = dbState.photos.map((photo) => photo.id === id ? { ...photo, uploadedPath } : photo)
  }),
  deletePhoto: vi.fn(async (id: string) => {
    dbState.photos = dbState.photos.filter((photo) => photo.id !== id)
  }),
  putReport: vi.fn(async (record: PendingReportRecord) => {
    dbState.reports = [...dbState.reports.filter((report) => report.idempotencyKey !== record.idempotencyKey), record]
  }),
  getAllReports: vi.fn(async () => dbState.reports),
  deleteReport: vi.fn(async (idempotencyKey: string) => {
    dbState.reports = dbState.reports.filter((report) => report.idempotencyKey !== idempotencyKey)
  }),
  putTransition: vi.fn(async (record: PendingTransitionRecord) => {
    dbState.transitions = [...dbState.transitions.filter((transition) => transition.idempotencyKey !== record.idempotencyKey), record]
  }),
  getAllTransitions: vi.fn(async () => dbState.transitions),
  deleteTransition: vi.fn(async (idempotencyKey: string) => {
    dbState.transitions = dbState.transitions.filter((transition) => transition.idempotencyKey !== idempotencyKey)
  }),
  putConflict: vi.fn(async (record: unknown) => {
    dbState.conflicts.push(record)
  }),
  getDb: vi.fn(async () => ({
    count: vi.fn(async (store: string) => {
      if (store === 'pendingReports') return dbState.reports.length
      if (store === 'pendingTransitions') return dbState.transitions.length
      if (store === 'pendingPhotos') return dbState.photos.length
      return 0
    }),
  })),
}))

vi.mock('@/lib/offline/auth-refresh', () => ({
  refreshSession: vi.fn(async () => authState.result),
}))

vi.mock('@/lib/offline/logger', () => ({
  offlineLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('@clerk/nextjs', () => ({
  useUser: () => ({
    user: { id: 'test-user-id', primaryEmailAddress: { emailAddress: 'test@test.com' }, fullName: 'Test User' },
    isLoaded: true,
  }),
  useAuth: () => ({ signOut: vi.fn(), userId: 'test-user-id' }),
}))

import { drainQueue, enqueuePhoto, enqueueReport, type DrainResult } from './sync-manager'

function reportPayload(overrides: Partial<TechnicianReportPayload> = {}): TechnicianReportPayload {
  return {
    idempotency_key: '11111111-1111-4111-8111-111111111111',
    photos_before: [],
    photos_after: [],
    materials: [],
    actual_total_price: 0,
    customer_signature_url: '',
    customer_name_signed: 'Budi',
    notes: 'Done',
    work_started_at: null,
    work_completed_at: null,
    next_service_recommendation_date: null,
    next_service_recommendation_notes: null,
    ac_units: [
      {
        ac_unit_id: 'ac-1',
        brand: 'Daikin',
        brand_id: '11111111-1111-4111-8111-111111111111',
        unit_type_id: '22222222-2222-4222-8222-222222222222',
        capacity_id: '33333333-3333-4333-8333-333333333333',
        capacity_label: '1 PK',
        room_location: 'Kamar',
        skipped: false,
        photos_before: [],
        photos_after: [],
        materials_used: [],
      },
    ],
    ...overrides,
  }
}

function pendingReport(overrides: Partial<PendingReportRecord> = {}): PendingReportRecord {
  const payload = reportPayload({ idempotency_key: overrides.idempotencyKey ?? '11111111-1111-4111-8111-111111111111' })
  return {
    idempotencyKey: payload.idempotency_key,
    orderId: 'WO-SYNC-001',
    technicianId: 'tech-1',
    photoIds: [],
    payload,
    attempts: 0,
    lastAttemptAt: null,
    lastError: null,
    status: 'pending',
    createdAt: Date.now(),
    ...overrides,
  }
}

function transitionPayload(overrides: Partial<TechnicianTransitionPayload> = {}): TechnicianTransitionPayload {
  return {
    to_status: 'EN_ROUTE',
    idempotency_key: '44444444-4444-4444-8444-444444444444',
    gps: { lat: null, lng: null, gps_error: 'unsupported' },
    ...overrides,
  }
}

function pendingTransition(overrides: Partial<PendingTransitionRecord> = {}): PendingTransitionRecord {
  const payload = transitionPayload({ idempotency_key: overrides.idempotencyKey ?? '44444444-4444-4444-8444-444444444444' })
  return {
    idempotencyKey: payload.idempotency_key ?? '44444444-4444-4444-8444-444444444444',
    orderId: 'WO-SYNC-001',
    payload,
    attempts: 0,
    lastAttemptAt: null,
    lastError: null,
    createdAt: Date.now(),
    ...overrides,
  }
}

function pendingPhoto(id: string, kind: PendingPhotoRecord['kind'], acUnitIdx: number): PendingPhotoRecord {
  return {
    id,
    orderId: 'WO-SYNC-001',
    acUnitIdx,
    kind,
    blob: new Blob([id], { type: 'image/jpeg' }),
    bytes: 3,
    width: 10,
    height: 10,
    mimeType: kind === 'signature' ? 'image/png' : 'image/jpeg',
    uploadedPath: null,
    capturedAt: '2026-06-11T10:00:00.000Z',
    createdAt: Date.now(),
  }
}

function jsonResponse(status: number, body: Record<string, unknown> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('sync-manager current queue behavior', () => {
  beforeEach(() => {
    dbState.reports = []
    dbState.transitions = []
    dbState.photos = []
    dbState.conflicts = []
    dbState.quotaCritical = false
    authState.result = { ok: true }
    swState.postMessage.mockClear()
    storageState.upload.mockClear()
    storageState.bucketCalls = []
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.stubGlobal('navigator', {
      onLine: false,
      serviceWorker: {
        ready: Promise.resolve({ active: { postMessage: swState.postMessage } }),
      },
      storage: { estimate: vi.fn(async () => ({ usage: 0, quota: 100 })) },
    })
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn(() => '99999999-9999-4999-8999-999999999999'),
      getRandomValues: (bytes: Uint8Array) => bytes.fill(7),
    })
    // ponytail: stub Clerk session for drainQueue auth check
    vi.stubGlobal('Clerk', {
      session: {
        getToken: vi.fn(async () => 'mock-clerk-token'),
      },
    })
  })

  it('enqueueReport normalizes payload, stores pending report, and requests report background sync', async () => {
    const record = await enqueueReport({
      orderId: 'WO-SYNC-001',
      technicianId: 'tech-1',
      payload: reportPayload({ photos_before: undefined as unknown as string[], ac_units: undefined as unknown as TechnicianReportPayload['ac_units'] }),
      photoIds: ['photo-1'],
    })

    expect(record).toMatchObject({
      idempotencyKey: '11111111-1111-4111-8111-111111111111',
      orderId: 'WO-SYNC-001',
      technicianId: 'tech-1',
      photoIds: ['photo-1'],
      attempts: 0,
      lastAttemptAt: null,
      lastError: null,
      payload: { photos_before: [], photos_after: [], ac_units: [] },
    })
    expect(dbState.reports).toHaveLength(1)
    await waitForMicrotasks()
    expect(swState.postMessage).toHaveBeenCalledWith({ type: 'REGISTER_SYNC', tag: 'msn-tech-sync-reports' })
  })

  it('enqueuePhoto stores pending photo metadata unless quota is critical', async () => {
    const photo = await enqueuePhoto({
      orderId: 'WO-SYNC-001',
      acUnitIdx: 0,
      kind: 'before',
      blob: new Blob(['x'], { type: 'image/jpeg' }),
      bytes: 1,
      width: 10,
      height: 10,
      mimeType: 'image/jpeg',
      capturedAt: '2026-06-11T10:00:00.000Z',
    })

    expect(photo).toMatchObject({
      id: '99999999-9999-4999-8999-999999999999',
      uploadedPath: null,
      capturedAt: '2026-06-11T10:00:00.000Z',
    })
    expect(dbState.photos).toHaveLength(1)

    dbState.quotaCritical = true
    await expect(enqueuePhoto({
      orderId: 'WO-SYNC-001',
      acUnitIdx: 0,
      kind: 'after',
      blob: new Blob(['x']),
      bytes: 1,
      width: 10,
      height: 10,
      mimeType: 'image/jpeg',
    })).rejects.toThrow('STORAGE_QUOTA_CRITICAL')
  })

  it('drainQueue deletes reports and transitions after 200 responses', async () => {
    dbState.reports = [pendingReport()]
    dbState.transitions = [pendingTransition()]
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => jsonResponse(200, { success: true }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await drainQueue()

    expect(result).toMatchObject({
      reportsAttempted: 1,
      transitionsAttempted: 1,
      reportsSynced: 1,
      transitionsSynced: 1,
      errors: [],
    })
    expect(dbState.reports).toEqual([])
    expect(dbState.transitions).toEqual([])
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/technician/jobs/WO-SYNC-001/transition', expect.objectContaining({ method: 'POST' }))
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/technician/jobs/WO-SYNC-001/report', expect.objectContaining({ method: 'POST' }))
  })

  it('drainQueue preserves 422 report responses as needs-attention with server error details', async () => {
    dbState.reports = [pendingReport()]
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(422, { error: 'material quantity is invalid' })))

    const result = await drainQueue()

    expect(result.reportsAttempted).toBe(1)
    expect(result.reportsSynced).toBe(0)
    expect(result.errors).toEqual([
      {
        kind: 'report',
        key: '11111111-1111-4111-8111-111111111111',
        message: 'NEEDS_ATTENTION: material quantity is invalid',
        status: 'needs-attention',
      },
    ])
    expect(dbState.reports).toHaveLength(1)
    expect(dbState.reports[0]).toMatchObject({
      status: 'needs-attention',
      attempts: 1,
      lastAttemptAt: expect.any(Number),
      lastError: 'material quantity is invalid',
    })
  })

  it('drainQueue preserves 403 report responses as auth-error with re-login guidance', async () => {
    dbState.reports = [pendingReport()]
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(403, { message: 'technician session is not allowed' })))

    const result = await drainQueue()

    expect(result.reportsAttempted).toBe(1)
    expect(result.reportsSynced).toBe(0)
    expect(result.errors).toEqual([
      {
        kind: 'report',
        key: '11111111-1111-4111-8111-111111111111',
        message: 'AUTH_ERROR: technician session is not allowed',
        status: 'auth-error',
      },
    ])
    expect(dbState.reports).toHaveLength(1)
    expect(dbState.reports[0]).toMatchObject({
      status: 'auth-error',
      attempts: 1,
      lastAttemptAt: expect.any(Number),
      lastError: 'technician session is not allowed',
    })
  })

  it('drainQueue retries 5xx report responses without deleting and records exponential backoff state', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-11T10:00:00.000Z'))
    dbState.reports = [pendingReport()]
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => jsonResponse(500, { error: 'server down' }))
    vi.stubGlobal('fetch', fetchMock)

    const first = await drainQueue()

    expect(first).toMatchObject({ reportsAttempted: 1, reportsSynced: 0 })
    expect(dbState.reports[0]).toMatchObject({ attempts: 1, lastAttemptAt: Date.now(), lastError: 'HTTP 500' })

    fetchMock.mockClear()
    const skipped = await drainQueue()

    expect(skipped.reportsAttempted).toBe(1)
    expect(skipped.reportsSynced).toBe(0)
    expect(fetchMock).not.toHaveBeenCalled()

    vi.setSystemTime(new Date('2026-06-11T10:00:01.000Z'))
    await drainQueue()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('drainQueue skips records until the current attempt backoff delay has elapsed', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-11T10:00:00.000Z'))
    dbState.reports = [pendingReport({ attempts: 2, lastAttemptAt: Date.now() })]
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => jsonResponse(200, { success: true }))
    vi.stubGlobal('fetch', fetchMock)

    const skipped = await drainQueue()

    expect(skipped.reportsAttempted).toBe(1)
    expect(skipped.reportsSynced).toBe(0)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(dbState.reports).toHaveLength(1)

    vi.setSystemTime(new Date('2026-06-11T10:00:05.000Z'))
    const synced = await drainQueue()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(synced.reportsSynced).toBe(1)
    expect(dbState.reports).toEqual([])
  })

  it('uploads queued photos, patches report payload URLs, and cleans report/photos after 200 response', async () => {
    dbState.photos = [
      pendingPhoto('before-photo-id', 'before', 0),
      pendingPhoto('after-photo-id', 'after', 0),
      pendingPhoto('signature-photo-id', 'signature', -1),
    ]
    dbState.reports = [pendingReport({ photoIds: ['before-photo-id', 'after-photo-id', 'signature-photo-id'] })]
    const bucketCalls: string[] = []
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/api/photos/signed-upload-url')) {
        const body = JSON.parse(String(init?.body))
        bucketCalls.push(body.bucket)
        return jsonResponse(200, { signedUrl: `https://upload.test/${body.bucket}/${body.path}` })
      }
      if (url.startsWith('https://upload.test/')) {
        return new Response(null, { status: 200 })
      }
      return jsonResponse(200, { success: true })
    })
    vi.stubGlobal('fetch', fetchMock)
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://storage.test')

    const result = await drainQueue()

    expect(result.reportsSynced).toBe(1)
    expect(bucketCalls).toEqual([
      'service-photos', 'service-photos', 'signatures',
    ])
    const reportCall = fetchMock.mock.calls.find((call) => String(call[0]).endsWith('/report'))
    if (!reportCall) throw new Error('expected report fetch call')
    const postedPayload = JSON.parse(String(reportCall[1]?.body))
    expect(postedPayload.customer_signature_url).toBe('https://storage.test/storage/v1/object/public/signatures/WO-SYNC-001/signature-photo-id.png')
    expect(postedPayload.ac_units[0].photos_before).toEqual(['https://storage.test/storage/v1/object/public/service-photos/WO-SYNC-001/before-photo-id.jpeg'])
    expect(postedPayload.ac_units[0].photos_after).toEqual(['https://storage.test/storage/v1/object/public/service-photos/WO-SYNC-001/after-photo-id.jpeg'])
    expect(dbState.reports).toEqual([])
    expect(dbState.photos).toEqual([])
  })

  it('keeps reports queued when photo upload fails', async () => {
    dbState.photos = [pendingPhoto('before-photo-id', 'before', 0)]
    dbState.reports = [pendingReport({ photoIds: ['before-photo-id'] })]
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/api/photos/signed-upload-url')) {
        return jsonResponse(200, { signedUrl: 'https://upload.test/fail' })
      }
      if (url.startsWith('https://upload.test/')) {
        return new Response(null, { status: 500, statusText: 'bucket unavailable' })
      }
      return jsonResponse(200, { success: true })
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await drainQueue()

    expect(result.reportsAttempted).toBe(1)
    expect(result.reportsSynced).toBe(0)
    expect(result.errors).toEqual([
      {
        kind: 'report',
        key: '11111111-1111-4111-8111-111111111111',
        message: 'photo upload failed',
        status: 'pending',
      },
    ])
    expect(dbState.reports).toHaveLength(1)
    expect(dbState.reports[0]).toMatchObject({
      status: 'pending',
      attempts: 1,
      lastError: 'photo upload failed',
    })
  })

  it('manual drain bypasses retry backoff and drains immediately', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-11T10:00:00.000Z'))
    dbState.reports = [pendingReport({ attempts: 2, lastAttemptAt: Date.now() })]
    const fetchMock = vi.fn(async () => jsonResponse(200, { success: true }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await drainQueue({ bypassBackoff: true })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result.reportsSynced).toBe(1)
    expect(dbState.reports).toEqual([])
  })

  it('enqueueReport triggers an immediate drain when browser is online', async () => {
    vi.stubGlobal('navigator', {
      onLine: true,
      serviceWorker: {
        ready: Promise.resolve({ active: { postMessage: swState.postMessage } }),
      },
      storage: { estimate: vi.fn(async () => ({ usage: 0, quota: 100 })) },
    })
    const fetchMock = vi.fn(async () => jsonResponse(200, { success: true }))
    vi.stubGlobal('fetch', fetchMock)

    await enqueueReport({
      orderId: 'WO-SYNC-001',
      technicianId: 'tech-1',
      payload: reportPayload(),
      photoIds: [],
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/technician/jobs/WO-SYNC-001/report', expect.objectContaining({ method: 'POST' }))
    expect(dbState.reports).toEqual([])
  })

  it('DrainResult exposes typed errors for UI surfaces', async () => {
    dbState.reports = [pendingReport()]
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(422, { error: 'customer signature is missing' })))

    const result: DrainResult = await drainQueue()

    expect(result.errors).toEqual([
      {
        kind: 'report',
        key: '11111111-1111-4111-8111-111111111111',
        message: 'NEEDS_ATTENTION: customer signature is missing',
        status: 'needs-attention',
      },
    ])
  })
})

async function waitForMicrotasks() {
  await Promise.resolve()
  await Promise.resolve()
}
