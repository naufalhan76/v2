/**
 * Shared sync utilities — backoff calculation, response classification,
 * and type definitions used across sync modules.
 */

/**
 * Exponential backoff delay in ms for a given attempt count.
 * Steps: 0, 1 s, 5 s, 30 s, 2 min, 10 min (capped at index 5).
 */
export function backoffMs(n: number): number {
  const steps = [0, 1000, 5000, 30000, 120000, 600000]
  return steps[Math.min(n, steps.length - 1)]
}

export type ClassifyResult =
  | { action: 'success' }
  | { action: 'idempotent' }
  | { action: 'conflict-cancelled'; message: string | null }
  | { action: 'auth-fail'; message: string | null }
  | { action: 'retry'; message: string | null }
  | { action: 'needs-attention'; status: import('./db').PendingReportStatus; message: string | null }
  | { action: 'permanent-fail'; message: string | null }

/**
 * Classify an HTTP response into a sync outcome.
 * Clones the response before reading the body so the original remains readable.
 */
export async function classifyResponse(res: Response): Promise<ClassifyResult> {
  const body = await res.clone().json().catch(() => ({}))
  const message = responseMessage(body)

  if (res.ok) {
    return body.idempotent_replay ? { action: 'idempotent' } : { action: 'success' }
  }

  if (res.status === 401) return { action: 'auth-fail', message }

  if (res.status === 403) {
    return { action: 'needs-attention', status: 'auth-error', message }
  }

  if (res.status === 409) {
    return /cancel|reassign/i.test(message ?? '')
      ? { action: 'conflict-cancelled', message }
      : { action: 'permanent-fail', message }
  }

  if (res.status === 422) {
    return { action: 'needs-attention', status: 'needs-attention', message }
  }

  if (res.status >= 500) return { action: 'retry', message }

  return { action: 'permanent-fail', message }
}

function responseMessage(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null
  const payload = body as { error?: unknown; message?: unknown }
  if (typeof payload.error === 'string' && payload.error.length > 0) return payload.error
  if (typeof payload.message === 'string' && payload.message.length > 0) return payload.message
  return null
}
