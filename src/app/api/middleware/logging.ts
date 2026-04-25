import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

export type RequestLog = {
  timestamp: string
  method: string
  url: string
  path: string
  status?: number
  duration?: number
  userId?: string
  error?: string
}

/**
 * Log API request with timing and status
 */
export function logRequest(
  method: string,
  path: string,
  userId?: string,
  details?: Record<string, any>,
) {
  const log: RequestLog = {
    timestamp: new Date().toISOString(),
    method,
    url: `${method} ${path}`,
    path,
    ...(userId && { userId }),
    ...details,
  }

  logger.debug('[API Request]', JSON.stringify(log, null, 2))
  return log
}

/**
 * Log API response with status and duration
 */
export function logResponse(
  log: RequestLog,
  status: number,
  duration: number,
  error?: string,
) {
  const responseLog = {
    ...log,
    status,
    duration: `${duration}ms`,
    ...(error && { error }),
  }

  const level = status >= 400 ? 'error' : 'info'
  logger.debug(`[API Response ${level.toUpperCase()}]`, JSON.stringify(responseLog, null, 2))
}

/**
 * Create audit log for sensitive operations
 */
export async function createAuditLog(
  userId: string,
  action: string,
  resource: string,
  resourceId: string,
  changes?: Record<string, any>,
) {
  const auditLog = {
    timestamp: new Date().toISOString(),
    userId,
    action,
    resource,
    resourceId,
    changes,
  }

  logger.debug('[Audit Log]', JSON.stringify(auditLog, null, 2))

  // TODO: Store audit log in database (audit_logs table)
  // This is a placeholder for future implementation
  return auditLog
}

/**
 * Middleware to measure request duration
 */
export function measureDuration() {
  const start = performance.now()
  return () => {
    const end = performance.now()
    return Math.round(end - start)
  }
}
