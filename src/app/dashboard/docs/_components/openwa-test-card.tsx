'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { TestTube2, CheckCircle2 } from 'lucide-react'

export function OpenwaTestCard() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <TestTube2 className="h-5 w-5 text-muted-foreground mt-1" />
          <div>
            <CardTitle>4. Test Integration</CardTitle>
            <CardDescription>Setelah env + sender module + reminder wiring terpasang:</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <ol className="list-decimal list-inside space-y-2">
          <li>Restart Next.js dev server (<code>npm run dev</code>) atau rebuild Docker image biar env baru ke-pick</li>
          <li>Login sebagai admin → <code>/dashboard/reminders</code> → pilih reminder pending dengan channel <Badge>WHATSAPP</Badge></li>
          <li>Klik <strong>&quot;Tandai Terkirim&quot;</strong></li>
          <li>Cek di HP customer (yang nomornya jadi recipient): pesan harus masuk</li>
          <li>Cek <code>customer_reminders</code> row: status harus <code>SENT</code>, <code>external_id</code> terisi dengan messageId dari OpenWA</li>
        </ol>
        <Separator />
        <div className="flex gap-2 rounded-md border bg-status-assigned-bg dark:bg-status-assigned-bg p-3">
          <CheckCircle2 className="h-4 w-4 text-info mt-0.5 shrink-0" />
          <div className="text-xs text-info dark:text-info">
            <p><strong>Happy path check:</strong> kalau step 2-5 di atas sukses, integrasi siap. Lanjut ke step 5 di bawah untuk auto-send.</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
