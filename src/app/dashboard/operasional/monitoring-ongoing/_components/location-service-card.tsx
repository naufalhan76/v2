import { Building } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface LocationServiceCardProps {
  group: Record<string, unknown>
}

export function LocationServiceCard({ group }: LocationServiceCardProps) {
  const loc = group.location as Record<string, unknown> | undefined
  const items = group.items as unknown[]

  return (
    <div className="border rounded-lg p-4 space-y-3 bg-card">
      <div className="space-y-1">
        <div className="flex items-center gap-2 font-semibold text-base">
          <Building className="w-4 h-4 text-primary" />
          {(loc?.full_address as string) || 'Unknown Location'}
        </div>
        {loc && (
          <div className="text-sm text-muted-foreground pl-6">
            House {loc.house_number as string}, {loc.city as string}
          </div>
        )}
      </div>

      <div className="pl-6 space-y-2">
        <div className="text-sm font-semibold text-muted-foreground">
          Services ({items.length}):
        </div>
        <div className="space-y-2">
          {items.map((item: unknown) => {
            const it = item as Record<string, unknown>
            const unitTypes = it.unit_types as Record<string, unknown> | undefined
            const capacityRanges = it.capacity_ranges as Record<string, unknown> | undefined
            const serviceCatalog = it.service_catalog as Record<string, unknown> | undefined
            const acUnits = it.ac_units as Record<string, unknown> | undefined
            return (
              <div key={it.order_item_id as string} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {it.msn_code ? (
                      <Badge variant="outline" className="font-mono text-xs font-semibold">
                        {it.msn_code as string}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="font-semibold">
                        {it.service_type as string}
                      </Badge>
                    )}
                    {!!unitTypes?.name && (
                      <span className="text-xs text-muted-foreground">
                        {String(unitTypes.name)}{capacityRanges?.capacity_label ? ` · ${String(capacityRanges.capacity_label)}` : ''}
                      </span>
                    )}
                  </div>
                  {!!serviceCatalog?.service_name && (
                    <div className="text-xs text-muted-foreground pl-1">{String(serviceCatalog.service_name)}</div>
                  )}
                  {acUnits && (
                    <div className="text-xs text-muted-foreground pl-1">
                      {acUnits.brand as string} {acUnits.model_number as string}
                    </div>
                  )}
                </div>
                <span className="font-semibold text-sm">
                  Rp {(((it.estimated_price as number) || 0) * ((it.quantity as number) || 1)).toLocaleString('id-ID')}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
