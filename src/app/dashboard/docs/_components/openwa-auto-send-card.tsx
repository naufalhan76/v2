'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle } from 'lucide-react'

export function OpenwaAutoSendCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>5. Auto-Send (Optional)</CardTitle>
        <CardDescription>Skip admin review untuk rule yang punya <code>auto_send=true</code>.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p>Modify <code>generateRemindersFromAcUnits</code> di <code>src/lib/actions/reminders.ts</code>:</p>
        <pre className="rounded-md bg-muted p-3 overflow-x-auto text-xs">
{`// Setelah insert customer_reminders rows:
for (const reminder of inserted) {
  if (reminder.rule.auto_send) {
    // Langsung dispatch, skip antrian
    await markReminderSent(reminder.reminder_id)
  }
}`}
        </pre>
        <div className="flex gap-2 rounded-md border bg-status-pending-bg dark:bg-status-pending-bg p-3">
          <AlertCircle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
          <p className="text-xs text-warning dark:text-warning">
            <strong>Rate limiting:</strong> kalau lo auto-send banyak sekaligus, WhatsApp bisa throttle. Tambahin delay 1-2 detik antar kirim, atau batch jadi group max 10 per menit.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
