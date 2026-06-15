'use client'

import { Separator } from '@/components/ui/separator'
import { ServiceTypeBadge } from '@/components/orders/service-type-badge'
import { StatusBadge } from '@/components/orders/status-badge'
import { User, MapPin, Phone, Mail, Building } from 'lucide-react'
import { format } from 'date-fns'
import type { ReactNode } from 'react'

interface Order {
  order_id: string
  order_date?: string
  order_type?: string
  notes?: string
  customers?: { customer_name?: string; primary_contact_person?: string; phone_number?: string; email?: string }
  order_items?: Array<{
    location_id?: string
    service_type?: string
    quantity?: number
    estimated_price?: number
    locations?: { building_name?: string; floor?: string; room_number?: string }
    ac_units?: { brand?: string; model_number?: string; serial_number?: string }
  }>
}

interface OrderDetailCardProps {
  orders: Order[]
}

function OrderItem({ order, index }: { order: Order; index: number }) {
  const customers = order.customers
  const orderItems = (order.order_items || []) as Array<Record<string, unknown>>
  const groupedByLocation = orderItems.reduce((acc: Record<string, { location?: Record<string, unknown>; items: unknown[] }>, item) => {
    const locationId = (item.location_id as string) || 'unknown'
    if (!acc[locationId]) acc[locationId] = { location: item.locations as Record<string, unknown>, items: [] }
    acc[locationId].items.push(item)
    return acc
  }, {})
  const locationCount = Object.keys(groupedByLocation).length

  return (
    <div key={order.order_id}>
      {index > 0 && <Separator className='my-4' />}
      <div className='space-y-3'>
        <div className='flex items-start justify-between'>
          <div>
            <div className='flex items-center gap-2 mb-1'>
              <span className='font-mono text-sm font-bold'>{order.order_id}</span>
              <ServiceTypeBadge serviceType={order.order_type as string} />
            </div>
            <p className='text-xs text-muted-foreground'>Order Date: {order.order_date ? format(new Date(order.order_date), 'dd MMM yyyy') : '-'}</p>
          </div>
          <StatusBadge status="ASSIGNED" />
        </div>
        <div className='bg-muted/50 rounded-lg p-3'>
          <div className='flex items-center gap-2 mb-2'><User className='w-4 h-4 text-muted-foreground' /><span className='text-sm font-semibold'>Customer</span></div>
          <div className='ml-6 space-y-1'>
            <p className='font-medium'>{String(customers?.customer_name ?? '')}</p>
            {!!customers?.primary_contact_person && <p className='text-sm text-muted-foreground'>Contact: {String(customers.primary_contact_person)}</p>}
            <div className='flex gap-3 text-sm'>
              {!!customers?.phone_number && <span className='flex items-center gap-1'><Phone className='w-3 h-3' />{String(customers.phone_number)}</span>}
              {!!customers?.email && <span className='flex items-center gap-1'><Mail className='w-3 h-3' />{String(customers.email)}</span>}
            </div>
          </div>
        </div>
        <div className='space-y-2'>
          <div className='flex items-center gap-2'><MapPin className='w-4 h-4 text-muted-foreground' /><span className='text-sm font-semibold'>Locations & Services ({locationCount} location{locationCount > 1 ? 's' : ''})</span></div>
          <div className='space-y-3'>
            {Object.entries(groupedByLocation).map(([locationId, data]) => {
              const d = data as { location?: Record<string, unknown>; items: Record<string, unknown>[] }
              const loc = d.location
              const items = d.items
              return (
                <div key={locationId} className='bg-muted/50 rounded-lg p-3 space-y-2'>
                  <div className='flex items-start gap-2'>
                    <Building className='w-4 h-4 text-muted-foreground mt-0.5' />
                    <div className='flex-1'>
                      <p className='font-medium'>{loc?.building_name as string || 'Unknown Location'}</p>
                      <p className='text-sm text-muted-foreground'>Floor {String(loc?.floor ?? '')}, Room {String(loc?.room_number ?? '')}</p>
                    </div>
                  </div>
                  <div className='space-y-1.5 pl-6'>
                    <p className='text-xs font-semibold text-muted-foreground'>Services:</p>
                    {items.map((item, idx) => {
                      const acUnits = item.ac_units as Record<string, unknown> | undefined
                      return (
                        <div key={idx} className='flex justify-between items-start text-sm p-2 bg-background rounded'>
                          <div className='space-y-0.5'>
                            <div className='flex items-center gap-2'><ServiceTypeBadge serviceType={item.service_type as string} /><span className='text-xs text-muted-foreground'>×{item.quantity as number}</span></div>
                            {acUnits && <p className='text-xs text-muted-foreground'>AC: {acUnits.brand as string} {acUnits.model_number as string}{!!acUnits.serial_number && ` (SN: ${String(acUnits.serial_number)})`}</p>}
                          </div>
                          <div className='text-xs font-semibold'>Rp {(item.estimated_price as number)?.toLocaleString('id-ID') || '0'}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        {!!order.notes && (
          <div className='bg-status-assigned-bg border border-info/30 rounded-lg p-3'>
            <span className='text-sm font-semibold text-info'>Order Notes:</span>
            <p className='text-sm text-info mt-1'>{order.notes as string}</p>
          </div>
        )}
      </div>
    </div>
  )
}

export function OrderDetailCard({ orders }: OrderDetailCardProps) {
  return (
    <div className='space-y-4'>
      {orders.map((order, index) => <OrderItem key={order.order_id} order={order} index={index} />)}
    </div>
  )
}
