'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { MessageCircle, QrCode, Key, CheckCircle2, AlertCircle, Server } from 'lucide-react'

export function OpenwaSetupTab() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <MessageCircle className="h-5 w-5 text-muted-foreground mt-1" />
            <div>
              <CardTitle>Apa itu OpenWA?</CardTitle>
              <CardDescription>
                Self-hosted WhatsApp API gateway —替代 third-party Fonnte/WAblas
                yang biasanya bayar per pesan.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            <a
              href="https://github.com/rmyndharis/OpenWA"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium underline"
            >
              rmyndharis/OpenWA
            </a>{' '}
            adalah fork open-source dari{' '}
            <code>whatsapp-web.js</code> dengan REST API di atasnya. Lo host
            di VPS sendiri, scan QR WhatsApp sekali, lalu bisa kirim pesan via
            HTTP.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
            <div className="rounded border p-2">
              <p className="font-medium">Port default</p>
              <ul className="text-muted-foreground">
                <li>API: <code>2785</code></li>
                <li>Dashboard: <code>2886</code></li>
                <li>Swagger: <code>2785/api/docs</code></li>
              </ul>
            </div>
            <div className="rounded border p-2">
              <p className="font-medium">Stack</p>
              <p className="text-muted-foreground">
                Node.js 22, NestJS 11, TypeScript 5, PostgreSQL (optional), Redis (optional)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <Server className="h-5 w-5 text-muted-foreground mt-1" />
            <div>
              <CardTitle>1. Deploy OpenWA (Docker)</CardTitle>
              <CardDescription>
                Single-command deploy. Bisa di VPS yang sama dengan MSN ERP,
                atau di VPS terpisah.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <pre className="rounded-md bg-muted p-3 overflow-x-auto text-xs">
{`# Clone repo
git clone https://github.com/rmyndharis/OpenWA.git
cd OpenWA

# Production: SQLite + local storage (paling simpel)
docker compose up -d

# Production: full stack (PostgreSQL + Redis + Dashboard + Traefik)
docker compose --profile full up -d`}
          </pre>
          <p>
            Tunggu sampai container healthy. Cek dengan:
          </p>
          <pre className="rounded-md bg-muted p-3 overflow-x-auto text-xs">
{`docker compose ps
curl http://localhost:2785/api/health`}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <Key className="h-5 w-5 text-muted-foreground mt-1" />
            <div>
              <CardTitle>2. Buat API Key</CardTitle>
              <CardDescription>
                Semua request ke OpenWA butuh API key untuk auth.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            1. Buka dashboard <code>http://&lt;vps-ip&gt;:2886</code>
          </p>
          <p>
            2. Login pertama kali — bakal diminta set admin password
          </p>
          <p>
            3. Menu <strong>API Keys → Generate Key</strong>, simpan nilainya
            dengan aman (hanya muncul sekali)
          </p>
          <div className="flex gap-2 rounded-md border bg-status-pending-bg dark:bg-status-pending-bg p-3">
            <AlertCircle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
            <p className="text-xs text-warning dark:text-warning">
              API key ini nanti dimasukkan ke <code>.env.local</code> MSN ERP
              sebagai <code>OPENWA_API_KEY</code>. Treat as secret.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <QrCode className="h-5 w-5 text-muted-foreground mt-1" />
            <div>
              <CardTitle>3. Scan QR WhatsApp</CardTitle>
              <CardDescription>
                Hubungkan device WhatsApp (bisnis或个人) ke OpenWA.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            1. Dashboard OpenWA → <strong>Sessions → Create Session</strong>
            (misal nama: <code>msn-erp-prod</code>)
          </p>
          <p>
            2. Klik <strong>Start</strong> di session yang baru dibuat
          </p>
          <p>
            3. OpenWA akan generate QR code. Scan pakai HP:
            <ul className="list-disc list-inside ml-6 mt-1">
              <li>Buka WhatsApp di HP</li>
              <li>Android: <strong>⋮ → Linked Devices → Link a Device</strong></li>
              <li>iPhone: <strong>Settings → Linked Devices → Link a Device</strong></li>
            </ul>
          </p>
          <p>
            4. Setelah scan, status session jadi <Badge>CONNECTED</Badge>.
            Session tetap aktif meskipun HP offline (pakai websocket ke
            WhatsApp servers).
          </p>
          <div className="flex gap-2 rounded-md border bg-status-assigned-bg dark:bg-status-assigned-bg p-3">
            <AlertCircle className="h-4 w-4 text-info mt-0.5 shrink-0" />
            <p className="text-xs text-info dark:text-info">
              <strong>Penting:</strong> Jangan pakai nomor WhatsApp utama lo.
              Pakai nomor terpisah khusus untuk bot (mis. nomor customer service
              bisnis). WhatsApp bisa ban nomor yang kirim massal tanpa persetujuan.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-muted-foreground mt-1" />
            <div>
              <CardTitle>4. Test Kirim Pesan</CardTitle>
              <CardDescription>
                Verifikasi OpenWA + WhatsApp udah siap.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>Format chatId WhatsApp: <code>628123456789@c.us</code> (kode negara + nomor, tanpa + atau 0).</p>
          <pre className="rounded-md bg-muted p-3 overflow-x-auto text-xs">
{`curl -X POST http://localhost:2785/api/sessions/{sessionId}/messages/send-text \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -d '{
    "chatId": "628123456789@c.us",
    "text": "Halo dari OpenWA!"
  }'`}
          </pre>
          <p>
            Response sukses: <code>{`{ "success": true, "messageId": "..." }`}</code>.
            Simpan <code>messageId</code> untuk tracking nanti.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Optional: Setup Webhook</CardTitle>
          <CardDescription>
            Terima event dari OpenWA (mis. incoming message, session status).
            Hanya perlu kalau lo mau handle incoming message — untuk reminder
            keluar, tidak wajib.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <pre className="rounded-md bg-muted p-3 overflow-x-auto text-xs">
{`curl -X POST http://localhost:2785/api/sessions/{sessionId}/webhooks \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -d '{
    "url": "https://v2.nufnh.my.id/api/openwa/webhook",
    "events": ["message.received", "session.status"],
    "secret": "your-hmac-secret-32-bytes"
  }'`}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Troubleshooting</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <p className="font-medium">Session tiba-tiba disconnected</p>
            <p className="text-muted-foreground text-xs">
              WhatsApp web multi-device kadang drop. Solusi: setup auto-reconnect
              di OpenWA dashboard, atau pakai UptimeRobot untuk monitor dan
              restart container kalau down.
            </p>
          </div>
          <Separator />
          <div>
            <p className="font-medium">Pesan tidak terkirim tapi API return success</p>
            <p className="text-muted-foreground text-xs">
              Kemungkinan: nomor tujuan belum save di WhatsApp kontak bot. Tambahin
              dulu, atau OpenWA perlu <code>forceSend: true</code>.
            </p>
          </div>
          <Separator />
          <div>
            <p className="font-medium">API key tidak valid</p>
            <p className="text-muted-foreground text-xs">
              Cek header-nya: <code>X-API-Key</code> (bukan Authorization
              Bearer). Case-sensitive.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
