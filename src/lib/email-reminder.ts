// src/lib/email-reminder.ts
// Reminder email sender via Resend. Server-only.

import { Resend } from 'resend'
import { logger } from './logger'

const FROM = 'MSN ERP <noreply@nufnh.my.id>'

export async function sendReminderEmail(
  to: string,
  subject: string,
  message: string,
): Promise<{ ok: true; messageId: string | null } | { ok: false; error: string }> {
  if (!process.env.RESEND_API_KEY) {
    return { ok: false, error: 'RESEND_API_KEY not configured' }
  }

  const resend = new Resend(process.env.RESEND_API_KEY)

  try {
    const { data, error } = await resend.emails.send({
      from: FROM,
      to,
      subject,
      html: `<div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:20px;"><p style="white-space:pre-line;">${message}</p><hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb;"><p style="font-size:12px;color:#6b7280;">Email ini dikirim otomatis dari MSN ERP. Balas email ini jika ada pertanyaan.</p></div>`,
    })

    if (error) {
      logger.error('sendReminderEmail Resend error:', error)
      return { ok: false, error: error.message || String(error) }
    }

    return { ok: true, messageId: data?.id ?? null }
  } catch (err) {
    logger.error('sendReminderEmail error:', err)
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
