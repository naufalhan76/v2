'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Settings } from 'lucide-react'

export default function HargaServicePage() {
  return (
    <div className="space-y-4 md:space-y-6 p-4 md:p-0">
      <div className="flex items-center gap-2">
        <Settings className="h-5 w-5 md:h-6 md:w-6" />
        <h1 className="text-2xl md:text-3xl font-bold">Harga Service</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Konfigurasi Harga Service</CardTitle>
          <CardDescription>
            Atur harga untuk setiap jenis service AC
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Halaman ini dalam pengembangan. Fitur untuk mengatur harga service akan segera hadir.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
