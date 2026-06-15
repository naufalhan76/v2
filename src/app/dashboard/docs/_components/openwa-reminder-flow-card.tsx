'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { GitBranch } from 'lucide-react'

export function OpenwaReminderFlowCard() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <GitBranch className="h-5 w-5 text-muted-foreground mt-1" />
          <div>
            <CardTitle>3. Wire ke Reminder Flow</CardTitle>
            <CardDescription>
              Di <code>src/lib/actions/reminders.ts</code>, modify <code>markReminderSent</code> agar dispatch ke channel yang sesuai.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p>Existing flow saat ini cuma set status ke SENT. Untuk kirim beneran, tambahin branch <code>channel === &apos;WHATSAPP&apos;</code>:</p>
        <pre className="rounded-md bg-muted p-3 overflow-x-auto text-xs">
{`// src/lib/actions/reminders.ts (modifikasi)
import { sendWhatsApp } from '@/lib/server/whatsapp-sender'

export async function markReminderSent(reminderId: string, externalId?: string) {
  const supabase = createAdminClient()
  const { data: reminder } = await supabase
    .from('customer_reminders')
    .select('channel, recipient, message')
    .eq('reminder_id', reminderId)
    .single()
  if (!reminder) return { success: false, error: 'Reminder not found' }

  if (reminder.channel === 'WHATSAPP') {
    const result = await sendWhatsApp(reminder.recipient, reminder.message)
    if (!result.success) {
      await supabase.from('customer_reminders')
        .update({ status: 'FAILED', error_message: result.error, updated_at: new Date().toISOString() })
        .eq('reminder_id', reminderId)
      return { success: false, error: result.error }
    }
    externalId = result.messageId
  }

  await supabase.from('customer_reminders')
    .update({ status: 'SENT', sent_at: new Date().toISOString(), external_id: externalId, updated_at: new Date().toISOString() })
    .eq('reminder_id', reminderId)
  return { success: true, error: null }
}`}
        </pre>
      </CardContent>
    </Card>
  )
}
