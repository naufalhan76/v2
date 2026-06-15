'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { CheckCircle2, XCircle, AlertTriangle, Info, ArrowRight } from 'lucide-react'

export function BusinessFlowTab() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Siklus Order</CardTitle>
          <CardDescription>
            8 state yang dilalui setiap order, dari dibuat sampai lunas atau dibatalkan.
            Perpindahan state otomatis tercatat di <code>order_status_transitions</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="outline">PENDING</Badge>
            <ArrowRight className="h-3 w-3" />
            <Badge variant="outline">ASSIGNED</Badge>
            <ArrowRight className="h-3 w-3" />
            <Badge variant="outline">EN_ROUTE</Badge>
            <ArrowRight className="h-3 w-3" />
            <Badge variant="outline">IN_PROGRESS</Badge>
            <ArrowRight className="h-3 w-3" />
            <Badge variant="outline">COMPLETED</Badge>
            <ArrowRight className="h-3 w-3" />
            <Badge variant="outline">INVOICED</Badge>
            <ArrowRight className="h-3 w-3" />
            <Badge variant="outline">PAID</Badge>
          </div>
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <p className="font-medium">CANCELLED</p>
            <p className="text-muted-foreground">
              Status terminal alternatif. Bisa dicapai dari PENDING, ASSIGNED,
              atau EN_ROUTE. Setelah IN_PROGRESS, order harus diselesaikan dulu
              (COMPLETED) lalu di-void via invoice jika customer取消.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Skenario Pembayaran</CardTitle>
          <CardDescription>
            Empat skenario utama. Pilih sesuai deal dengan customer.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge>Lunas Penuh</Badge>
              <span className="text-sm text-muted-foreground">
                Customer bayar 100% di muka via transfer
              </span>
            </div>
            <p className="text-sm pl-1">
              Invoice dibuat → status <code>INVOICED</code> → catat pembayaran
              full → status <code>PAID</code> dalam satu kali update.
            </p>
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge>DP + Pelunasan</Badge>
              <span className="text-sm text-muted-foreground">
                Customer bayar sebagian (DP) dulu, sisanya setelah selesai
              </span>
            </div>
            <p className="text-sm pl-1">
              Invoice dibuat → catat DP (mis. 50%) → status tetap
              <code> INVOICED</code> → setelah service selesai, catat pelunasan
              → status <code>PAID</code>. Riwayat pembayaran tersimpan sebagai
              multiple rows di <code>invoice_payments</code>.
            </p>
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Cicilan / Nyicil</Badge>
              <span className="text-sm text-muted-foreground">
                Customer bayar berkali-kali sampai lunas
              </span>
            </div>
            <p className="text-sm pl-1">
              Sama seperti DP+pelunasan, tapi bisa lebih dari 2 termin. Catat
              tiap pembayaran terpisah. Invoice <code>PAID</code> hanya setelah
              total pembayaran = total tagihan.
            </p>
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="destructive">Kontrak</Badge>
              <span className="text-sm text-muted-foreground">
                Deal jangka panjang (kontrak maintenance bulanan / tahunan)
              </span>
            </div>
            <p className="text-sm pl-1">
              Satu kontrak bisa generate banyak order (tiak kunjungan). Tagihan
              dikirim per periode (bulanan). Lihat <code>contracts</code> table
              untuk detail. Status invoice independen per kunjungan, tapi
              pembayaran bisa di-consolidate per kontrak.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tanggung Jawab per Role</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Aktivitas</th>
                  <th className="text-center p-2">SUPERADMIN</th>
                  <th className="text-center p-2">ADMIN</th>
                  <th className="text-center p-2">FINANCE</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="p-2">Buat order baru</td>
                  <td className="text-center">✓</td>
                  <td className="text-center">✓</td>
                  <td className="text-center text-muted-foreground">—</td>
                </tr>
                <tr className="border-b">
                  <td className="p-2">Assign teknisi</td>
                  <td className="text-center">✓</td>
                  <td className="text-center">✓</td>
                  <td className="text-center text-muted-foreground">—</td>
                </tr>
                <tr className="border-b">
                  <td className="p-2">Buat / edit invoice</td>
                  <td className="text-center">✓</td>
                  <td className="text-center">✓</td>
                  <td className="text-center">✓</td>
                </tr>
                <tr className="border-b">
                  <td className="p-2">Catat pembayaran</td>
                  <td className="text-center">✓</td>
                  <td className="text-center">✓</td>
                  <td className="text-center">✓</td>
                </tr>
                <tr className="border-b">
                  <td className="p-2">Buat / edit user</td>
                  <td className="text-center">✓</td>
                  <td className="text-center">✓</td>
                  <td className="text-center text-muted-foreground">—</td>
                </tr>
                <tr className="border-b">
                  <td className="p-2">Kirim reminder ke customer</td>
                  <td className="text-center">✓</td>
                  <td className="text-center">✓</td>
                  <td className="text-center">✓</td>
                </tr>
                <tr>
                  <td className="p-2">Konfigurasi sistem</td>
                  <td className="text-center">✓</td>
                  <td className="text-center text-muted-foreground">—</td>
                  <td className="text-center text-muted-foreground">—</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Do &amp; Don&apos;t</CardTitle>
          <CardDescription>
            Hal-hal yang sering bikin error / data korup kalau dilanggar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <CheckCircle2 className="h-4 w-4 text-success mt-1 shrink-0" />
            <div className="text-sm">
              <p className="font-medium">DO — Assign teknisi dulu, baru mulai kerja</p>
              <p className="text-muted-foreground">
                Order tanpa assigned teknisi tidak bisa diproses. State
                machine reject transition.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <CheckCircle2 className="h-4 w-4 text-success mt-1 shrink-0" />
            <div className="text-sm">
              <p className="font-medium">DO — Foto before/after wajib di service report</p>
              <p className="text-muted-foreground">
                Bukti visual untuk klaim dispute customer. Tanpa foto, report
                tidak bisa di-approve.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <XCircle className="h-4 w-4 text-destructive mt-1 shrink-0" />
            <div className="text-sm">
              <p className="font-medium">DON&apos;T — Hapus user yang punya order history</p>
              <p className="text-muted-foreground">
                Pakai <code>is_active = false</code> saja. Riwayat order
                teknisi akan orphan kalau user di-hard-delete.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <XCircle className="h-4 w-4 text-destructive mt-1 shrink-0" />
            <div className="text-sm">
              <p className="font-medium">DON&apos;T — Edit invoice yang sudah PAID</p>
              <p className="text-muted-foreground">
                Buat invoice baru (atau credit note) untuk koreksi. Edit
                langsung merusak audit trail pembayaran.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <AlertTriangle className="h-4 w-4 text-warning mt-1 shrink-0" />
            <div className="text-sm">
              <p className="font-medium">WATCH — Cancel order yang sudah ada proforma</p>
              <p className="text-muted-foreground">
                Sistem akan otomatis void proforma. Pastikan customer sudah
                di-refund DP-nya sebelum cancel, kalau tidak uang nyangkut.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Info className="h-4 w-4 text-info mt-1 shrink-0" />
            <div className="text-sm">
              <p className="font-medium">INFO — Addon request butuh approval admin</p>
              <p className="text-muted-foreground">
                Teknisi propose harga, admin yang set harga final. Selisih
                menjadi margin / diskon yang ditentukan admin, bukan teknisi.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
