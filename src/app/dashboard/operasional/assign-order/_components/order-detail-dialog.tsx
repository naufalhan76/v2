'use client'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { MapPin, User } from 'lucide-react'
import { format } from 'date-fns'
import { formatPhone } from '@/lib/utils'

interface OrderDetailDialogProps {
  detailOrderId: string | null
  orderDetail: { data?: Record<string, unknown> } | undefined
  onClose: () => void
}

const SERVICE_TYPES = [
  { value: 'REFILL_FREON', label: 'Refill Freon' },
  { value: 'CLEANING', label: 'Cleaning' },
  { value: 'REPAIR', label: 'Repair' },
  { value: 'INSTALLATION', label: 'Installation' },
  { value: 'INSPECTION', label: 'Inspection' },
]

export function OrderDetailDialog({ detailOrderId, orderDetail, onClose }: OrderDetailDialogProps) {
  if (!orderDetail?.data) return null

  const data = orderDetail.data as Record<string, unknown> & {
    order_id: string
    status: string
    order_date?: string
    req_visit_date?: string
    notes?: string
    customers?: {
      customer_name?: string
      primary_contact_person?: string
      phone_number?: string | number
      email?: string
    }
    order_items?: Array<Record<string, unknown> & {
      location_id?: string
      locations?: Record<string, unknown>
      service_type?: string
      quantity?: number
      estimated_price?: number
      ac_units?: Record<string, unknown> & {
        brand?: string
        model_number?: string
        serial_number?: string
      }
    }>
  }

  // Group order_items by location
  const groupedByLocation = (data.order_items || []).reduce((acc: Record<string, { location: unknown; items: unknown[] }>, item) => {
    const locationId = (item.location_id as string) || 'unknown'
    if (!acc[locationId]) {
      acc[locationId] = { location: item.locations, items: [] }
    }
    acc[locationId].items.push(item)
    return acc
  }, {})

  const totalEstimated = (data.order_items || []).reduce((sum: number, item) => {
    return sum + ((item.estimated_price as number) || 0)
  }, 0)

  return (
    <Dialog open={!!detailOrderId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className='max-w-2xl max-h-[80vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>Order Details</DialogTitle>
          <DialogDescription>Complete information about this order</DialogDescription>
        </DialogHeader>
        <div className='space-y-4'>
          {/* Order Info */}
          <div className='space-y-2'>
            <h3 className='font-semibold text-lg'>Order Information</h3>
            <div className='grid grid-cols-2 gap-3 text-sm'>
              <div>
                <span className='text-muted-foreground'>Order ID:</span>
                <p className='font-mono font-semibold'>{data.order_id}</p>
              </div>
              <div>
                <span className='text-muted-foreground'>Status:</span>
                <div className='mt-1'>
                  <Badge>{data.status}</Badge>
                </div>
              </div>
              <div>
                <span className='text-muted-foreground'>Order Date:</span>
                <p className='font-semibold'>
                  {data.order_date ? format(new Date(data.order_date), 'dd MMM yyyy') : '-'}
                </p>
              </div>
              <div>
                <span className='text-muted-foreground'>Requested Visit:</span>
                <p className='font-semibold'>
                  {data.req_visit_date ? format(new Date(data.req_visit_date), 'dd MMM yyyy') : '-'}
                </p>
              </div>
            </div>
            {data.notes && (
              <div className='pt-2'>
                <span className='text-muted-foreground text-sm'>Notes:</span>
                <p className='text-sm mt-1 p-3 bg-muted rounded-md'>{data.notes}</p>
              </div>
            )}
          </div>

          {/* Customer Info */}
          <div className='space-y-2'>
            <div className='flex items-center gap-2'>
              <User className='w-5 h-5 text-muted-foreground' />
              <h3 className='font-semibold text-lg'>Customer Information</h3>
            </div>
            <div className='bg-muted/50 rounded-lg p-4 space-y-2'>
              <div>
                <span className='text-sm font-semibold text-muted-foreground'>Name: </span>
                <span className='font-medium'>{data.customers?.customer_name}</span>
              </div>
              {data.customers?.primary_contact_person && (
                <div>
                  <span className='text-sm font-semibold text-muted-foreground'>Contact Person: </span>
                  <span>{data.customers.primary_contact_person}</span>
                </div>
              )}
              <div className='flex gap-4 text-sm'>
                {data.customers?.phone_number && (
                  <div className='flex items-center gap-1'>
                    <span className='text-muted-foreground'>Phone:</span>
                    {formatPhone(data.customers.phone_number)}
                  </div>
                )}
                {data.customers?.email && (
                  <div className='flex items-center gap-1'>
                    <span className='text-muted-foreground'>Email:</span>
                    {data.customers.email}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Locations & Services */}
          <div className='space-y-2'>
            <div className='flex items-center gap-2'>
              <MapPin className='w-5 h-5 text-muted-foreground' />
              <h3 className='font-semibold text-lg'>Locations & Services ({Object.keys(groupedByLocation).length} locations)</h3>
            </div>
            <div className='space-y-3'>
              {Object.entries(groupedByLocation).map(([locationId, locationData]) => {
                const locData = locationData as { location: Record<string, unknown>; items: unknown[] }
                return (
                  <div key={locationId} className='border rounded-lg p-4 space-y-3'>
                    <div className='flex items-start gap-2'>
                      <div className='flex-1'>
                        <p className='font-semibold'>{(locData.location?.building_name as string) || 'Unknown Location'}</p>
                        <p className='text-sm text-muted-foreground'>
                          Floor {String(locData.location?.floor ?? '')} - Room {String(locData.location?.room_number ?? '')}
                        </p>
                      </div>
                    </div>
                    <div className='space-y-2 pl-0'>
                      <p className='text-sm font-semibold text-muted-foreground'>Services:</p>
                      {locData.items.map((item: unknown, idx: number) => {
                        const it = item as Record<string, unknown> & { ac_units?: Record<string, unknown> }
                        return (
                          <div key={idx} className='flex justify-between items-start text-sm p-2 bg-muted/50 rounded'>
                            <div className='space-y-1'>
                              <div className='flex items-center gap-2'>
                                <Badge variant='outline' className='text-xs'>
                                  {SERVICE_TYPES.find(t => t.value === it.service_type)?.label || it.service_type as string}
                                </Badge>
                                <span className='text-muted-foreground'>×{it.quantity as number}</span>
                              </div>
                              {it.ac_units && (
                                <p className='text-xs text-muted-foreground'>
                                  AC: {String(it.ac_units.brand ?? '')} {String(it.ac_units.model_number ?? '')}
                                  {!!it.ac_units.serial_number && ` (SN: ${String(it.ac_units.serial_number)})`}
                                </p>
                              )}
                            </div>
                            <div className='font-semibold'>
                              Rp {(it.estimated_price as number)?.toLocaleString('id-ID') || '0'}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className='flex justify-between items-center pt-3 border-t font-semibold'>
              <span>Total Estimated Price:</span>
              <span className='text-lg'>Rp {totalEstimated.toLocaleString('id-ID')}</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
