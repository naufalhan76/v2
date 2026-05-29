/**
 * Scoped logger for the offline sync layer.
 *
 * Uses logger.child() to produce an [offline]-prefixed logger that follows
 * the same debug/info-stripped-in-prod behaviour as the rest of the app.
 */

import { logger } from '@/lib/logger'

export const offlineLogger = logger.child('offline')
