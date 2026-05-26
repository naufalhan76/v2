'use client'

import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { Building2, Calendar, MapPin, Phone, User, Wrench } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ServiceTypeBadge } from '@/components/orders/service-type-badge'

interface DetailOrderItem {
  order_item_id: string
  service_type?: string | null
  quantity?: number | null
  estimated_price?: number | null
  actual_price?: number | null
  description?: string | null
  locations?: { full_address?: string | null; city?: string | null } | null
  ac_units?: {
    brand?: string | null
    model_number?: string | null
    serial_number?: string | null
  } | null
}

export interface OrderDetailData {
  order_id: string
  status: string | null
  scheduled_visit_date?: string | null
  req_visit_date?: string | null
  notes?: string | null
  customers?: {
    customer_name?: string | null
    primary_contact_person?: string | null
    phone_number?: string | null
    email?: string | null
    billing_address?: string | null
  } | null
  order_items?: DetailOrderItem[] | null
  order_technicians?: Array<{
    role?: string | null
    technicians?: { technician_name?: string | null; contact_number?: string | null } | null
  }> | null
}

interface OrderDetailTabProps {
  order: OrderDetailData
}

export function OrderDetailTab({ order }: OrderDetailTabProps) {
  const lead = order.order_technicians?.find((t) => t.role === 'lead')
  const helpers = order.order_technicians?.filter((t) => t.role === 'helper') ?? []
  const dateStr = order.scheduled_visit_date ?? order.req_visit_date

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Building2 className="h-4 w-4" />
            Customer
          </div>
          <div className="space-y-1 text-sm">
            <p className="font-medium">{order.customers?.customer_name ?? '-'}</p>
            {order.customers?.primary_contact_person && (
              <p className="flex items-center gap-1.5 text-muted-foreground">
                <User className="h-3 w-3" />
                {order.customers.primary_contact_person}
              </p>
            )}
            {order.customers?.phone_number && (
              <p className="flex items-center gap-1.5 text-muted-foreground">
                <Phone className="h-3 w-3" />
                {order.customers.phone_number}
              </p>
            )}
            {order.customers?.email && (
              <p className="text-muted-foreground">{order.customers.email}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Calendar className="h-4 w-4" />
            Jadwal
          </div>
          <p className="text-sm">
            {dateStr
              ? format(new Date(dateStr), 'EEEE, d MMMM yyyy', { locale: localeId })
              : 'Belum dijadwalkan'}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Wrench className="h-4 w-4" />
            Teknisi
          </div>
          {lead?.technicians?.technician_name ? (
            <div className="space-y-1 text-sm">
              <p>
                <span className="font-medium">Lead:</span> {lead.technicians.technician_name}
                {lead.technicians.contact_number && (
                  <span className="text-muted-foreground ml-2">
                    {lead.technicians.contact_number}
                  </span>
                )}
              </p>
              {helpers.length > 0 && (
                <p>
                  <span className="font-medium">Helper:</span>{' '}
                  {helpers.map((h) => h.technicians?.technician_name).filter(Boolean).join(', ')}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Belum di-assign</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <MapPin className="h-4 w-4" />
            Lokasi & Service
          </div>
          {(order.order_items ?? []).map((item, idx) => (
            <div key={item.order_item_id} className="space-y-2">
              {idx > 0 && <Separator />}
              <div className="space-y-1 text-sm">
                <div className="flex items-center gap-2">
                  {item.service_type && <ServiceTypeBadge serviceType={item.service_type} size="sm" />}
                  {item.quantity && (
                    <span className="text-xs text-muted-foreground">Qty {item.quantity}</span>
                  )}
                </div>
                {item.locations?.full_address && (
                  <p className="text-muted-foreground">
                    {item.locations.full_address}
                    {item.locations.city ? `, ${item.locations.city}` : ''}
                  </p>
                )}
                {item.ac_units?.brand && (
                  <p className="text-xs text-muted-foreground">
                    AC: {item.ac_units.brand} {item.ac_units.model_number ?? ''}
                    {item.ac_units.serial_number ? ` (SN: ${item.ac_units.serial_number})` : ''}
                  </p>
                )}
                {item.description && (
                  <p className="text-xs text-muted-foreground italic">{item.description}</p>
                )}
                {item.estimated_price != null && (
                  <p className="text-xs">
                    Estimasi: Rp {Number(item.estimated_price).toLocaleString('id-ID')}
                  </p>
                )}
              </div>
            </div>
          ))}
          {(!order.order_items || order.order_items.length === 0) && (
            <p className="text-sm text-muted-foreground">Tidak ada item</p>
          )}
        </CardContent>
      </Card>

      {order.notes && (
        <Card>
          <CardContent className="pt-4 space-y-2">
            <p className="text-sm font-semibold">Catatan</p>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{order.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
