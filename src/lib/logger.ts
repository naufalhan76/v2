/**
 * Centralized logger.
 *
 * Levels:
 *   debug  - dev only
 *   info   - dev only
 *   warn   - always (kept in production by next.config removeConsole)
 *   error  - always
 *
 * Usage:
 *   import { logger } from '@/lib/logger'
 *   logger.debug('something', { id })
 *   logger.error('Failed to fetch', err)
 */

type LogArgs = unknown[]

const isDev = process.env.NODE_ENV !== 'production'

function format(scope: string | undefined, msg: string): string {
  return scope ? `[${scope}] ${msg}` : msg
}

function emit(
  level: 'debug' | 'info' | 'warn' | 'error',
  scope: string | undefined,
  msg: string,
  args: LogArgs,
) {
  if ((level === 'debug' || level === 'info') && !isDev) return

  const line = format(scope, msg)

  switch (level) {
    case 'debug':
    case 'info':
      // eslint-disable-next-line no-console
      console.log(line, ...args)
      return
    case 'warn':
      // eslint-disable-next-line no-console
      console.warn(line, ...args)
      return
    case 'error':
      // eslint-disable-next-line no-console
      console.error(line, ...args)
      return
  }
}

export interface Logger {
  debug(msg: string, ...args: LogArgs): void
  info(msg: string, ...args: LogArgs): void
  warn(msg: string, ...args: LogArgs): void
  error(msg: string, ...args: LogArgs): void
  child(scope: string): Logger
}

function createLogger(scope?: string): Logger {
  return {
    debug: (msg, ...args) => emit('debug', scope, msg, args),
    info: (msg, ...args) => emit('info', scope, msg, args),
    warn: (msg, ...args) => emit('warn', scope, msg, args),
    error: (msg, ...args) => emit('error', scope, msg, args),
    child: (childScope) =>
      createLogger(scope ? `${scope}:${childScope}` : childScope),
  }
}

export const logger: Logger = createLogger()
