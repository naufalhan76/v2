'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Plug } from 'lucide-react'

export function OpenwaSenderModuleCard() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <Plug className="h-5 w-5 text-muted-foreground mt-1" />
          <div>
            <CardTitle>2. Sender Module</CardTitle>
            <CardDescription>
              Wrapper di <code>src/lib/server/whatsapp-sender.ts</code> yang manggil OpenWA REST API. Pattern ini bisa di-reuse dari mana aja.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p>Bikin file baru:</p>
        <pre className="rounded-md bg-muted p-3 overflow-x-auto text-xs">
{`// src/lib/server/whatsapp-sender.ts
import { logger } from '@/lib/logger'

const OPENWA_URL = process.env.OPENWA_API_URL
const OPENWA_KEY = process.env.OPENWA_API_KEY
const SESSION_ID = process.env.OPENWA_SESSION_ID

export type SendResult =
  | { success: true; messageId: string }
  | { success: false; error: string }

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\\D/g, '')
  if (digits.startsWith('0')) return \`62\${digits.slice(1)}\`
  if (digits.startsWith('62')) return digits
  return digits
}

export async function sendWhatsApp(to: string, text: string): Promise<SendResult> {
  if (!OPENWA_URL || !OPENWA_KEY || !SESSION_ID) {
    return { success: false, error: 'OpenWA env vars not configured' }
  }
  const chatId = \`\${normalizePhone(to)}@c.us\`
  try {
    const res = await fetch(\`\${OPENWA_URL}/api/sessions/\${SESSION_ID}/messages/send-text\`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-Key': OPENWA_KEY },
      body: JSON.stringify({ chatId, text }),
    })
    if (!res.ok) {
      const body = await res.text()
      logger.error('[whatsapp-sender] OpenWA error:', res.status, body)
      return { success: false, error: \`HTTP \${res.status}: \${body}\` }
    }
    const json = (await res.json()) as { messageId?: string }
    return { success: true, messageId: json.messageId ?? 'unknown' }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error('[whatsapp-sender] fetch failed:', msg)
    return { success: false, error: msg }
  }
}`}
        </pre>
      </CardContent>
    </Card>
  )
}
