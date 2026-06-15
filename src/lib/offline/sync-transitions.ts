/**
 * Sync transitions — enqueue + drain helpers for status transitions.
 */

import {
  deleteTransition,
  putConflict,
  putTransition,
  type PendingTransitionRecord,
} from './db'
import { newIdempotencyKey } from './idempotency'
import type { TechnicianTransitionPayload } from '@/app/api/schemas/technician'
import type { DrainQueueOptions } from './sync-types'
import { backoffMs, classifyResponse, type ClassifyResult } from './sync-utils'

// Re-export for barrel consumers
export type { TechnicianTransitionPayload }

/**
 * Enqueue a transition for later sync.
 */
export async function enqueueTransition(
  orderId: string,
  payload: TechnicianTransitionPayload
): Promise<PendingTransitionRecord> {
  if (!payload.idempotency_key) {
    throw new Error('enqueueTransition: idempotency_key is required')
  }
  const record: PendingTransitionRecord = {
    idempotencyKey: payload.idempotency_key,
    orderId,
    payload,
    attempts: 0,
    lastAttemptAt: null,
    lastError: null,
    createdAt: Date.now(),
  }
  await putTransition(record)
  await requestBackgroundSync('msn-tech-sync-transitions')
  return record
}

async function requestBackgroundSync(tag: string): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.serviceWorker) return
  try {
    const reg = await navigator.serviceWorker.ready
    if (reg.active) {
      reg.active.postMessage({ type: 'REGISTER_SYNC', tag })
    }
  } catch {
    // No-op; the online-event listener will still drive the queue.
  }
}

type TransitionDrainResult = {
  synced: number
  errors: Array<{ kind: 'transition'; key: string; message: string }>
}

/**
 * Drain pending transitions with backoff + response classification.
 */
export async function drainTransitions(
  transitions: PendingTransitionRecord[],
  options: DrainQueueOptions,
): Promise<TransitionDrainResult> {
  const result: TransitionDrainResult = { synced: 0, errors: [] }

  for (const record of transitions) {
    const now = Date.now()
    const lastAttempt = record.lastAttemptAt ?? 0
    if (!options.bypassBackoff && lastAttempt + backoffMs(record.attempts) > now) continue

    let res: Response | null = null
    let classify: ClassifyResult = { action: 'retry', message: null }

    try {
      res = await fetch(`/api/technician/jobs/${encodeURIComponent(record.orderId)}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record.payload),
      })
      classify = await classifyResponse(res)
    } catch {
      classify = { action: 'retry', message: null }
    }

    if (classify.action === 'success' || classify.action === 'idempotent') {
      await deleteTransition(record.idempotencyKey)
      result.synced++
    } else if (classify.action === 'retry') {
      await putTransition({
        ...record,
        attempts: record.attempts + 1,
        lastAttemptAt: Date.now(),
        lastError: res ? `HTTP ${res.status}` : 'network error',
      })
    } else if (classify.action === 'conflict-cancelled') {
      const cloned = res ? res.clone() : null
      const body = cloned ? await cloned.json().catch(() => ({})) : {}
      await putConflict({
        id: newIdempotencyKey(),
        orderId: record.orderId,
        kind: 'CANCELLED',
        reportSnapshot: null,
        transitionSnapshot: record,
        serverMessage: body.error ?? body.message ?? null,
        createdAt: Date.now(),
      })
      await deleteTransition(record.idempotencyKey)
    } else if (classify.action === 'auth-fail') {
      result.errors.push({
        kind: 'transition',
        key: record.idempotencyKey,
        message: 'AUTH_REQUIRED: session expired during sync',
      })
    } else {
      result.errors.push({
        kind: 'transition',
        key: record.idempotencyKey,
        message: res ? `HTTP ${res.status}` : 'permanent failure',
      })
      await deleteTransition(record.idempotencyKey)
    }
  }

  return result
}
