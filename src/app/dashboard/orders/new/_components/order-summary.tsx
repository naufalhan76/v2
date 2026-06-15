import { format } from 'date-fns'

import { Badge } from '@/components/ui/badge'

import type { SelectedAcLine } from '../_hooks/use-create-order-form'

type Technician = {
  technician_id: string
  full_name: string
}

type OrderSummaryProps = {
  customer: { customer_name: string; phone_number: string } | null
  scheduledDate: Date | undefined
  skipAssignment: boolean
  leadTechnicianId: string
  helperTechnicianIds: string[]
  technicians: Technician[] | undefined
  serviceLines: SelectedAcLine[]
  totalEstimatedPrice: number
}

const idrFmt = (n: number) => `Rp ${n.toLocaleString('id-ID')}`

function SummaryRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  )
}

export function OrderSummary({
  customer,
  scheduledDate,
  skipAssignment,
  leadTechnicianId,
  helperTechnicianIds,
  technicians,
  serviceLines,
  totalEstimatedPrice,
}: OrderSummaryProps) {
  return (
    <div className="space-y-3 rounded-md border p-4">
      <SummaryRow label="Customer">
        {customer ? (
          <span>
            {customer.customer_name} • {customer.phone_number}
          </span>
        ) : (
          <span className="text-muted-foreground">Belum dipilih</span>
        )}
      </SummaryRow>
      <SummaryRow label="Tanggal Kunjungan">
        {scheduledDate ? format(scheduledDate, 'EEEE, dd MMMM yyyy') : '-'}
      </SummaryRow>
      <SummaryRow label="Teknisi">
        {skipAssignment ? (
          <Badge variant="outline">Assign nanti</Badge>
        ) : (
          <span>
            {technicians?.find((t) => t.technician_id === leadTechnicianId)?.full_name ||
              '-'}
            {helperTechnicianIds.length > 0 && (
              <span className="text-muted-foreground">
                {' '}
                (+{helperTechnicianIds.length} helper)
              </span>
            )}
          </span>
        )}
      </SummaryRow>
      <div>
        <p className="mb-2 text-sm font-medium">Service Items</p>
        <div className="space-y-1 text-sm">
          {serviceLines.map((l) => (
            <div
              key={l.line_id}
              className="flex items-start justify-between rounded bg-muted/30 px-3 py-2"
            >
              <div className="flex-1">
                <p className="font-medium">
                  {l.service_name || '(Belum pilih service)'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {l.ac_label} • {l.location_label}
                  {l.quantity > 1 && ` × ${l.quantity}`}
                </p>
              </div>
              <span>{idrFmt(l.estimated_price * l.quantity)}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between border-t pt-3">
        <span className="text-sm font-medium">Total Estimasi</span>
        <span className="text-lg font-bold">{idrFmt(totalEstimatedPrice)}</span>
      </div>
    </div>
  )
}
