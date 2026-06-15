import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Receipt } from 'lucide-react'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import type { PaymentRecord } from '@/types/invoices'

interface PaymentHistoryProps {
  payments: PaymentRecord[]
  totalAmount: number
  formatCurrency: (amount: number) => string
}

export function PaymentHistory({ payments, totalAmount, formatCurrency }: PaymentHistoryProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Riwayat Pembayaran</CardTitle>
        <CardDescription>
          {payments.length > 0
            ? `${payments.length} pembayaran tercatat`
            : 'Belum ada pembayaran tercatat'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {payments.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="Belum ada pembayaran"
            description="Catat pembayaran pertama untuk invoice ini lewat tombol di atas."
          />
        ) : (
          <>
            {/* Mobile cards */}
            <div className="md:hidden space-y-2">
              {(() => {
                const sorted = [...payments].sort(
                  (a, b) => new Date(a.payment_date).getTime() - new Date(b.payment_date).getTime()
                )
                let running = totalAmount
                const rows = sorted.map((p) => {
                  running -= p.amount
                  return { ...p, balanceAfter: running }
                })
                return rows.reverse().map((p) => (
                  <div key={p.payment_id} className="rounded-lg border p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">
                        {format(new Date(p.payment_date), 'dd MMM yyyy', { locale: localeId })}
                      </span>
                      <Badge variant="outline">{p.payment_method}</Badge>
                    </div>
                    {p.reference_number && (
                      <div className="font-mono text-xs text-muted-foreground break-all">
                        {p.reference_number}
                      </div>
                    )}
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-success">
                        {formatCurrency(p.amount)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Sisa: {formatCurrency(p.balanceAfter)}
                      </span>
                    </div>
                  </div>
                ))
              })()}
            </div>

            {/* Tablet/desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Metode</TableHead>
                    <TableHead>Referensi</TableHead>
                    <TableHead className="text-right">Jumlah</TableHead>
                    <TableHead className="text-right">Sisa Setelah</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(() => {
                    const sorted = [...payments].sort(
                      (a, b) => new Date(a.payment_date).getTime() - new Date(b.payment_date).getTime()
                    )
                    let running = totalAmount
                    const rows = sorted.map((p) => {
                      running -= p.amount
                      return { ...p, balanceAfter: running }
                    })
                    return rows.reverse().map((p) => (
                      <TableRow key={p.payment_id}>
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(p.payment_date), 'dd MMM yyyy', { locale: localeId })}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{p.payment_method}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm break-all">
                          {p.reference_number || '-'}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-success whitespace-nowrap">
                          {formatCurrency(p.amount)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground whitespace-nowrap">
                          {formatCurrency(p.balanceAfter)}
                        </TableCell>
                      </TableRow>
                    ))
                  })()}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
