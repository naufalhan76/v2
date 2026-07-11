import { FileText, Wrench } from 'lucide-react'

export interface ServiceInfoOrderItem {
  order_item_id?: string | null
  service_type?: string | null
  description?: string | null
  quantity?: number | null
  ac_units?: {
    brand?: string | null
    model_number?: string | null
    serial_number?: string | null
  } | null
}

interface ServiceInfoCardProps {
  /** Prefer this — shows every service line on multi-service orders. */
  orderItems?: ServiceInfoOrderItem[] | null
  /**
   * @deprecated Use `orderItems` so multi-service orders render fully.
   * Kept for backward-compat single-item callers.
   */
  orderItem?: ServiceInfoOrderItem | null
}

function ServiceLine({ item, index, total }: {
  item: ServiceInfoOrderItem
  index: number
  total: number
}) {
  const acUnit = item.ac_units
  const qty = item.quantity && item.quantity > 1 ? ` ×${item.quantity}` : ''

  return (
    <div className={total > 1 ? 'space-y-2' : 'space-y-3'}>
      {total > 1 && (
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Layanan {index + 1}
        </p>
      )}

      <div className="flex items-center gap-2 text-sm">
        <Wrench className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
        <span className="font-medium">
          {item.service_type ?? '-'}
          {qty}
        </span>
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

      {item.description && (
        <div className="flex items-start gap-2 text-sm">
          <FileText className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
          <span>{item.description}</span>
        </div>
      )}
    </div>
  )
}

export function ServiceInfoCard({ orderItems, orderItem }: ServiceInfoCardProps) {
  const items: ServiceInfoOrderItem[] =
    Array.isArray(orderItems) && orderItems.length > 0
      ? orderItems
      : orderItem
        ? [orderItem]
        : []

  return (
    <div className="rounded-lg border border-border dark:border-border bg-background dark:bg-surface-muted p-4 space-y-3">
      <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide dark:text-muted-foreground">
        Detail Layanan
      </h3>

      {items.length === 0 ? (
        <div className="flex items-center gap-2 text-sm">
          <Wrench className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
          <span className="font-medium">-</span>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item, index) => (
            <div
              key={item.order_item_id ?? `${item.service_type ?? 'svc'}-${index}`}
              className={
                index > 0
                  ? 'pt-3 border-t border-border dark:border-border'
                  : undefined
              }
            >
              <ServiceLine item={item} index={index} total={items.length} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
