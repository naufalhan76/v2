'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export function OpenwaChannelMatrixCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Channel Dispatch Matrix</CardTitle>
        <CardDescription>Ringkasan channel mana yang dipakai untuk reminder apa.</CardDescription>
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
                <td className="p-2 text-muted-foreground">Open rate tinggi, customer lebih cepet respon</td>
              </tr>
              <tr className="border-b">
                <td className="p-2">Invoice / tagihan</td>
                <td className="p-2"><Badge variant="secondary">EMAIL</Badge></td>
                <td className="p-2 text-muted-foreground">Ada PDF, formal, arsip di inbox</td>
              </tr>
              <tr className="border-b">
                <td className="p-2">Konfirmasi appointment</td>
                <td className="p-2"><Badge>WHATSAPP</Badge></td>
                <td className="p-2 text-muted-foreground">Butuh respon cepat (confirm/cancel)</td>
              </tr>
              <tr>
                <td className="p-2">Service report selesai</td>
                <td className="p-2"><Badge variant="secondary">EMAIL</Badge></td>
                <td className="p-2 text-muted-foreground">Ada lampiran foto, butuh arsip</td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
