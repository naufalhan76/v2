import { format } from 'date-fns'
import { User, MapPin, Mail, Phone, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/orders/status-badge'
import { formatPhone } from '@/lib/utils'
import { isTerminalState, toCanonical } from '@/lib/order-status'
import {
  getUniqueServiceLabels,
  getOrderDetailLocationGroups,
  getOrderItemsEstimatedTotal,
} from '../monitoring-ongoing-utils'
import { LocationServiceCard } from './location-service-card'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OrderDetailData = any

interface OrderDetailContentProps {
  orderDetail: { success: boolean; data?: OrderDetailData }
  onOpenAddHelper: () => void
  onOpenRemoveHelper: (techId: string) => void
  onOpenCancel: () => void
  onOpenReschedule: () => void
  isProcessing: boolean
}

export function OrderDetailContent({
  orderDetail,
  onOpenAddHelper,
  onOpenRemoveHelper,
  onOpenCancel,
  onOpenReschedule,
  isProcessing,
}: OrderDetailContentProps) {
  const orderData = orderDetail.data
  const customers = orderData.customers as Record<string, unknown> | undefined
  const orderItems = (orderData.order_items as unknown[]) || []
  const orderTechs = orderData.order_technicians as unknown[] | undefined
  const locationGroups = getOrderDetailLocationGroups(orderItems)
  const totalEstimated = getOrderItemsEstimatedTotal(orderItems)

  return (
    <div className="space-y-4">
      {/* Order Info */}
      <div className="space-y-2">
        <h3 className="font-semibold text-lg">Order Information</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-muted-foreground">Order ID:</span>
            <p className="font-mono font-semibold">{orderData.order_id as string}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Status:</span>
            <div className="mt-1">
              <StatusBadge status={orderData.status as string} />
            </div>
          </div>
          <div>
            <span className="text-muted-foreground">Order Date:</span>
            <p className="font-semibold">
              {orderData.order_date ? format(new Date(orderData.order_date as string), 'dd MMM yyyy') : '-'}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Services:</span>
            <div className="mt-1 flex flex-wrap gap-1">
              {getUniqueServiceLabels(orderItems).map((label) => (
                <Badge key={label} variant="outline" className="font-mono text-xs">
                  {label}
                </Badge>
              ))}
              {getUniqueServiceLabels(orderItems).length === 0 && (
                <Badge variant="outline">
                  {(orderData.order_type as string) || '-'}
                </Badge>
              )}
            </div>
          </div>
          <div>
            <span className="text-muted-foreground">Requested Visit:</span>
            <p className="font-semibold">
              {orderData.req_visit_date ? format(new Date(orderData.req_visit_date as string), 'dd MMM yyyy') : '-'}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Scheduled Visit:</span>
            <p className="font-semibold">
              {orderData.scheduled_visit_date ? format(new Date(orderData.scheduled_visit_date as string), 'dd MMM yyyy') : '-'}
            </p>
          </div>
        </div>
        {orderData.notes && (
          <div className="pt-2">
            <span className="text-muted-foreground text-sm">Notes:</span>
            <p className="text-sm mt-1 p-3 bg-muted rounded-md">{orderData.notes as string}</p>
          </div>
        )}
      </div>

      {/* Customer Info */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <User className="w-5 h-5 text-muted-foreground" />
          <h3 className="font-semibold text-lg">Customer Information</h3>
        </div>
        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
          <div>
            <span className="text-sm font-semibold text-muted-foreground">Name: </span>
            <span className="font-medium">{customers?.customer_name as string}</span>
          </div>
          {!!customers?.primary_contact_person && (
            <div>
              <span className="text-sm font-semibold text-muted-foreground">Contact Person: </span>
              <span>{String(customers.primary_contact_person)}</span>
            </div>
          )}
          <div className="flex gap-4 text-sm">
            {!!customers?.phone_number && (
              <div className="flex items-center gap-1">
                <Phone className="w-3 h-3 text-muted-foreground" />
                {formatPhone(customers.phone_number as string | number | null | undefined)}
              </div>
            )}
            {!!customers?.email && (
              <div className="flex items-center gap-1">
                <Mail className="w-3 h-3 text-muted-foreground" />
                {customers.email as string}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Technician Info */}
      {orderTechs && orderTechs.length > 0 && (
        <TechnicianSection
          orderTechs={orderTechs}
          onOpenAddHelper={onOpenAddHelper}
          onOpenRemoveHelper={onOpenRemoveHelper}
          isProcessing={isProcessing}
        />
      )}

      {/* Locations & Services */}
      <LocationsAndServices
        locationGroups={locationGroups}
        totalEstimated={totalEstimated}
      />

      {(() => {
        const canonical = toCanonical(orderData.status as string)
        if (isTerminalState(canonical)) return null
        const canReschedule = canonical !== 'COMPLETED' && canonical !== 'INVOICED'
        return (
          <div className="flex gap-3 pt-4 border-t">
            <Button
              variant="destructive"
              onClick={onOpenCancel}
              disabled={isProcessing}
              className="flex-1"
            >
              Cancel Order
            </Button>
            {canReschedule && (
              <Button
                variant="outline"
                onClick={onOpenReschedule}
                disabled={isProcessing}
                className="flex-1"
              >
                Reschedule
              </Button>
            )}
          </div>
        )
      })()}
    </div>
  )
}

// -- Internal sub-components to keep line count low --

interface TechnicianSectionProps {
  orderTechs: unknown[]
  onOpenAddHelper: () => void
  onOpenRemoveHelper: (techId: string) => void
  isProcessing: boolean
}

function TechnicianSection({ orderTechs, onOpenAddHelper, onOpenRemoveHelper, isProcessing }: TechnicianSectionProps) {
  const leadTechs = orderTechs.filter((t) => (t as Record<string, unknown>).role === 'lead')
  const helpers = orderTechs.filter((t) => (t as Record<string, unknown>).role === 'helper')

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <User className="w-5 h-5 text-muted-foreground" />
          <h3 className="font-semibold text-lg">Assigned Technicians</h3>
        </div>
        <Button size="sm" variant="outline" onClick={onOpenAddHelper} disabled={isProcessing}>
          <Plus className="w-4 h-4 mr-1" />
          Add Helper
        </Button>
      </div>
      <div className="bg-muted/50 rounded-lg p-4 space-y-3">
        {leadTechs.map((tech) => {
          const tc = tech as Record<string, unknown>
          const technicians = tc.technicians as Record<string, unknown> | undefined
          return (
            <div key={tc.id as string} className="flex items-center justify-between p-3 bg-primary/10 rounded-lg border border-primary/20">
              <div>
                <div className="font-semibold">{(technicians?.technician_name as string) || 'Unknown'}</div>
                <div className="text-xs text-muted-foreground">Lead Technician</div>
              </div>
              <Badge className="bg-primary">LEAD</Badge>
            </div>
          )
        })}

        {helpers.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground">Helpers:</div>
            {helpers.map((tech) => {
              const tc = tech as Record<string, unknown>
              const technicians = tc.technicians as Record<string, unknown> | undefined
              return (
                <div key={tc.id as string} className="flex items-center justify-between p-2 bg-background rounded border border-border">
                  <div className="flex-1">
                    <div className="font-medium text-sm">{(technicians?.technician_name as string) || 'Unknown'}</div>
                    {!!technicians?.contact_number && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {formatPhone(technicians.contact_number as string | number | null | undefined)}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">HELPER</Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onOpenRemoveHelper(tc.technician_id as string)}
                      disabled={isProcessing}
                    >
                      <X className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

interface LocationsAndServicesProps {
  locationGroups: unknown[]
  totalEstimated: number
}

function LocationsAndServices({ locationGroups, totalEstimated }: LocationsAndServicesProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <MapPin className="w-5 h-5 text-muted-foreground" />
        <h3 className="font-semibold text-lg">Locations & Services ({locationGroups.length} location{locationGroups.length > 1 ? 's' : ''})</h3>
      </div>

      {locationGroups.length === 0 ? (
        <div className="bg-muted/50 rounded-lg p-4 text-center text-muted-foreground">
          No location data available
        </div>
      ) : (
        <div className="space-y-3">
          {locationGroups.map((group: unknown, idx: number) => (
            <LocationServiceCard key={idx} group={group as Record<string, unknown>} />
          ))}

          <div className="flex justify-between items-center p-4 bg-primary/10 rounded-lg font-semibold border-2 border-primary/20">
            <span className="text-base">Total Estimated:</span>
            <span className="text-lg text-primary">
              Rp {totalEstimated.toLocaleString('id-ID')}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
