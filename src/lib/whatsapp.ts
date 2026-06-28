// src/lib/whatsapp.ts
// WhatsApp sender via OpenWA API. Server-only.

import { logger } from './logger'

function normalizePhone(raw: string): string {
  let id = raw.trim()
  if (id.includes('@')) return id // already chatId
  id = id.replace(/^\+/, '').replace(/^0/, '62')
  if (!id.startsWith('62')) id = '62' + id
  return `${id}@c.us`
}

export async function sendWhatsApp(
  to: string,
  message: string,
): Promise<{ ok: true; messageId: string | null } | { ok: false; error: string }> {
  const baseUrl = process.env.OPENWA_API_URL
  const apiKey = process.env.OPENWA_API_KEY
  const sessionId = process.env.OPENWA_SESSION_ID

  if (!baseUrl || !apiKey || !sessionId) {
    return { ok: false, error: 'OPENWA_API_URL/API_KEY/SESSION_ID not configured' }
  }

  const chatId = normalizePhone(to)
  const url = `${baseUrl.replace(/\/$/, '')}/sessions/${sessionId}/messages/send-text`

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId, text: message }),
      signal: AbortSignal.timeout(15_000),
    })

    const json = await res.json().catch(() => null)

    if (!res.ok) {
      const err = json?.message || json?.error || `HTTP ${res.status}`
      logger.warn('sendWhatsApp failed:', err)
      return { ok: false, error: String(err) }
    }

    return { ok: true, messageId: json?.id?._serialized || json?.messageId || json?.id || null }
  } catch (err) {
    logger.error('sendWhatsApp error:', err)
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
