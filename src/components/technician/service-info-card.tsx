import { FileText, Wrench } from 'lucide-react'

interface ServiceInfoCardProps {
  orderItem: {
    service_type?: string | null
    description?: string | null
    ac_units?: {
      brand?: string | null
      model_number?: string | null
      serial_number?: string | null
    } | null
  } | null
}

export function ServiceInfoCard({ orderItem }: ServiceInfoCardProps) {
  const acUnit = orderItem?.ac_units

  return (
    <div className="rounded-lg border border-border dark:border-border bg-background dark:bg-surface-muted p-4 space-y-3">
      <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide dark:text-muted-foreground">
        Detail Layanan
      </h3>

      <div className="flex items-center gap-2 text-sm">
        <Wrench className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
        <span className="font-medium">{orderItem?.service_type ?? '-'}</span>
      </div>

      {acUnit && (
        <div className="text-sm space-y-1 pl-6">
          <p><span className="text-muted-foreground">Merk:</span> {acUnit.brand ?? '-'}</p>
          <p><span className="text-muted-foreground">Model:</span> {acUnit.model_number ?? '-'}</p>
          {acUnit.serial_number && (
            <p><span className="text-muted-foreground">S/N:</span> {acUnit.serial_number}</p>
          )}
        </div>
      )}

      {orderItem?.description && (
        <div className="flex items-start gap-2 text-sm">
          <FileText className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
          <span>{orderItem.description}</span>
        </div>
      )}
    </div>
  )
}
