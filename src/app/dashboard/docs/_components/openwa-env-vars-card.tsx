'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Settings } from 'lucide-react'

export function OpenwaEnvVarsCard() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <Settings className="h-5 w-5 text-muted-foreground mt-1" />
          <div>
            <CardTitle>1. Tambah Env Vars ke MSN ERP</CardTitle>
            <CardDescription>
              OpenWA URL, API key, dan session ID. Sama dengan step 2-3 di tab sebelumnya — tinggal copy-paste.
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
          Kalau OpenWA di belakang reverse proxy (Traefik/Nginx), pakai HTTPS URL. Set <code>OPENWA_API_URL=https://wa.yourdomain.com</code>.
        </p>
      </CardContent>
    </Card>
  )
}
