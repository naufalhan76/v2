'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Plug, Settings, GitBranch, TestTube2, CheckCircle2, AlertCircle } from 'lucide-react'

export function OpenwaIntegrationTab() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <Settings className="h-5 w-5 text-muted-foreground mt-1" />
            <div>
              <CardTitle>1. Tambah Env Vars ke MSN ERP</CardTitle>
              <CardDescription>
                OpenWA URL, API key, dan session ID. Sama dengan step 2-3 di tab
                sebelumnya — tinggal copy-paste.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>Tambahin ke <code>.env.local</code> dan <code>.env.staging</code>:</p>
          <pre className="rounded-md bg-muted p-3 overflow-x-auto text-xs">
{`# URL OpenWA gateway (ganti IP/host sesuai VPS lo)
OPENWA_API_URL=http://<openwa-host>:2785

# API key dari step 2 OpenWA setup
OPENWA_API_KEY=your-api-key-here

# Session ID yang udah di-scan QR (dari step 3)
OPENWA_SESSION_ID=msn-erp-prod`}
          </pre>
          <p className="text-muted-foreground">
            Kalau OpenWA di belakang reverse proxy (Traefik/Nginx), pakai HTTPS
            URL. Set <code>OPENWA_API_URL=https://wa.yourdomain.com</code>.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <Plug className="h-5 w-5 text-muted-foreground mt-1" />
            <div>
              <CardTitle>2. Sender Module</CardTitle>
              <CardDescription>
                Wrapper di <code>src/lib/server/whatsapp-sender.ts</code> yang
                manggil OpenWA REST API. Pattern ini bisa di-reuse dari mana
                aja (reminder flow, notif order baru ke customer, dll).
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
  // Ubah 0812xxx jadi 62812xxx (kode Indonesia, tanpa '+')
  const digits = phone.replace(/\\D/g, '')
  if (digits.startsWith('0')) return \`62\${digits.slice(1)}\`
  if (digits.startsWith('62')) return digits
  return digits
}

export async function sendWhatsApp(
  to: string,
  text: string
): Promise<SendResult> {
  if (!OPENWA_URL || !OPENWA_KEY || !SESSION_ID) {
    return { success: false, error: 'OpenWA env vars not configured' }
  }

  const chatId = \`\${normalizePhone(to)}@c.us\`

  try {
    const res = await fetch(
      \`\${OPENWA_URL}/api/sessions/\${SESSION_ID}/messages/send-text\`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': OPENWA_KEY,
        },
        body: JSON.stringify({ chatId, text }),
      }
    )

    if (!res.ok) {
      const body = await res.text()
      logger.error('[whatsapp-sender] OpenWA error:', res.status, body)
      return { success: false, error: \`HTTP \${res.status}: \${body}\` }
    }

    const json = (await res.json()) as { messageId?: string }
    return {
      success: true,
      messageId: json.messageId ?? 'unknown',
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error('[whatsapp-sender] fetch failed:', msg)
    return { success: false, error: msg }
  }
}`}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <GitBranch className="h-5 w-5 text-muted-foreground mt-1" />
            <div>
              <CardTitle>3. Wire ke Reminder Flow</CardTitle>
              <CardDescription>
                Di <code>src/lib/actions/reminders.ts</code>, modify{' '}
                <code>markReminderSent</code> agar dispatch ke channel yang
                sesuai.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            Existing flow saat ini cuma set status ke SENT. Untuk kirim beneran,
            tambahin branch <code>channel === &apos;WHATSAPP&apos;</code>:
          </p>
          <pre className="rounded-md bg-muted p-3 overflow-x-auto text-xs">
{`// src/lib/actions/reminders.ts (modifikasi)
import { sendWhatsApp } from '@/lib/server/whatsapp-sender'

export async function markReminderSent(
  reminderId: string,
  externalId?: string
) {
  const supabase = createAdminClient()

  // Ambil detail reminder
  const { data: reminder } = await supabase
    .from('customer_reminders')
    .select('channel, recipient, message')
    .eq('reminder_id', reminderId)
    .single()

  if (!reminder) {
    return { success: false, error: 'Reminder not found' }
  }

  // Dispatch by channel
  if (reminder.channel === 'WHATSAPP') {
    const result = await sendWhatsApp(reminder.recipient, reminder.message)
    if (!result.success) {
      // Rollback: set status FAILED
      await supabase
        .from('customer_reminders')
        .update({
          status: 'FAILED',
          error_message: result.error,
          updated_at: new Date().toISOString(),
        })
        .eq('reminder_id', reminderId)
      return { success: false, error: result.error }
    }
    externalId = result.messageId
  }
  // (Email channel bisa ditambahin di sini juga)

  // Update status to SENT
  await supabase
    .from('customer_reminders')
    .update({
      status: 'SENT',
      sent_at: new Date().toISOString(),
      external_id: externalId,
      updated_at: new Date().toISOString(),
    })
    .eq('reminder_id', reminderId)

  return { success: true, error: null }
}`}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <TestTube2 className="h-5 w-5 text-muted-foreground mt-1" />
            <div>
              <CardTitle>4. Test Integration</CardTitle>
              <CardDescription>
                Setelah env + sender module + reminder wiring terpasang:
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <ol className="list-decimal list-inside space-y-2">
            <li>
              Restart Next.js dev server (<code>npm run dev</code>) atau rebuild
              Docker image biar env baru ke-pick
            </li>
            <li>
              Login sebagai admin → <code>/dashboard/reminders</code> → pilih
              reminder pending dengan channel <Badge>WHATSAPP</Badge>
            </li>
            <li>
              Klik <strong>&quot;Tandai Terkirim&quot;</strong>
            </li>
            <li>
              Cek di HP customer (yang nomornya jadi recipient): pesan harus
              masuk
            </li>
            <li>
              Cek <code>customer_reminders</code> row: status harus{' '}
              <code>SENT</code>, <code>external_id</code> terisi dengan
              messageId dari OpenWA
            </li>
          </ol>
          <Separator />
          <div className="flex gap-2 rounded-md border bg-blue-50 dark:bg-blue-950/30 p-3">
            <CheckCircle2 className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
            <div className="text-xs text-blue-900 dark:text-blue-200">
              <p>
                <strong>Happy path check:</strong> kalau step 2-5 di atas sukses,
                integrasi siap. Lanjut ke step 5 di bawah untuk auto-send.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>5. Auto-Send (Optional)</CardTitle>
          <CardDescription>
            Skip admin review untuk rule yang punya <code>auto_send=true</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            Modify <code>generateRemindersFromAcUnits</code> di{' '}
            <code>src/lib/actions/reminders.ts</code>:
          </p>
          <pre className="rounded-md bg-muted p-3 overflow-x-auto text-xs">
{`// Setelah insert customer_reminders rows:
for (const reminder of inserted) {
  if (reminder.rule.auto_send) {
    // Langsung dispatch, skip antrian
    await markReminderSent(reminder.reminder_id)
  }
}`}
          </pre>
          <div className="flex gap-2 rounded-md border bg-yellow-50 dark:bg-yellow-950/30 p-3">
            <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
            <p className="text-xs text-yellow-900 dark:text-yellow-200">
              <strong>Rate limiting:</strong> kalau lo auto-send banyak sekaligus,
              WhatsApp bisa throttle. Tambahin delay 1-2 detik antar kirim,
              atau batch jadi group max 10 per menit.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Channel Dispatch Matrix</CardTitle>
          <CardDescription>
            Ringkasan channel mana yang dipakai untuk reminder apa.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Tipe Reminder</th>
                  <th className="text-left p-2">Channel Recommended</th>
                  <th className="text-left p-2">Alasan</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="p-2">Service berkala (1-2 minggu sebelum due)</td>
                  <td className="p-2"><Badge>WHATSAPP</Badge></td>
                  <td className="p-2 text-muted-foreground">
                    Open rate tinggi, customer lebih cepet respon
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="p-2">Invoice / tagihan</td>
                  <td className="p-2"><Badge variant="secondary">EMAIL</Badge></td>
                  <td className="p-2 text-muted-foreground">
                    Ada PDF, formal, arsip永久 di inbox
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="p-2">Konfirmasi appointment</td>
                  <td className="p-2"><Badge>WHATSAPP</Badge></td>
                  <td className="p-2 text-muted-foreground">
                    Butuh respon cepat (confirm/cancel)
                  </td>
                </tr>
                <tr>
                  <td className="p-2">Service report selesai</td>
                  <td className="p-2"><Badge variant="secondary">EMAIL</Badge></td>
                  <td className="p-2 text-muted-foreground">
                    Ada lampiran foto, butuh arsip
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
