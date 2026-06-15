import { StatusBadge } from '@/components/orders/status-badge'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Check, X, User, MapPin, Phone, Mail, Building } from 'lucide-react'
import { format } from 'date-fns'
import { formatPhone } from '@/lib/utils'

const SERVICE_TYPES = [
  { value: 'REFILL_FREON', label: 'Refill Freon' },
  { value: 'CLEANING', label: 'Cleaning' },
  { value: 'REPAIR', label: 'Repair' },
  { value: 'INSTALLATION', label: 'Installation' },
  { value: 'INSPECTION', label: 'Inspection' },
]

interface OrderItem {
  location_id?: string
  locations?: Record<string, unknown>
  ac_units?: Record<string, unknown>
  service_type?: string
  quantity?: number
  estimated_price?: number
  [key: string]: unknown
}

export interface OrderDetailProps {
  order_id: string
  status: string
  order_date?: string
  req_visit_date?: string
  order_type?: string
  notes?: string
  customers?: {
    customer_name?: string
    primary_contact_person?: string
    phone_number?: string
    email?: string
  }
  order_items?: OrderItem[]
}

interface OrderDetailContentProps {
  data: OrderDetailProps
  onActionClick: (orderId: string, type: 'accept' | 'cancel') => void
}

export function OrderDetailContent({ data, onActionClick }: OrderDetailContentProps) {
  const orderItems = data.order_items || []

  const groupedByLocation = orderItems.reduce(
    (acc: Record<string, { location: unknown; items: OrderItem[] }>, item) => {
      const locationId = item.location_id || 'unknown'
      if (!acc[locationId]) {
        acc[locationId] = { location: item.locations, items: [] }
      }
      acc[locationId].items.push(item)
      return acc
    },
    {} as Record<string, { location: unknown; items: OrderItem[] }>,
  )

  const totalEstimated = orderItems.reduce(
    (sum: number, item) => sum + (item.estimated_price || 0),
    0,
  )

  return (
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
            <div className='mt-1'><StatusBadge status={data.status} /></div>
          </div>
          <div>
            <span className='text-muted-foreground'>Order Date:</span>
            <p className='font-semibold'>
              {data.order_date ? format(new Date(data.order_date), 'dd MMM yyyy') : '-'}
            </p>
          </div>
          <div>
            <span className='text-muted-foreground'>Order Type:</span>
            <div className='mt-1'>
              <Badge variant='outline'>
                {SERVICE_TYPES.find(t => t.value === data.order_type)?.label || data.order_type}
              </Badge>
            </div>
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
                <Phone className='w-3 h-3 text-muted-foreground' />
                {formatPhone(data.customers.phone_number)}
              </div>
            )}
            {data.customers?.email && (
              <div className='flex items-center gap-1'>
                <Mail className='w-3 h-3 text-muted-foreground' />
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
          {Object.entries(groupedByLocation).map(([locationId, locData]) => {
            const d = locData as { location: Record<string, unknown>; items: OrderItem[] }
            return (
            <div key={locationId} className='border rounded-lg p-4 space-y-3'>
              <div className='flex items-start gap-2'>
                <Building className='w-4 h-4 text-muted-foreground mt-0.5' />
                <div className='flex-1'>
                  <p className='font-semibold'>{(d.location?.building_name as string) || 'Unknown Location'}</p>
                  <p className='text-sm text-muted-foreground'>
                    Floor {String(d.location?.floor ?? '')} - Room {String(d.location?.room_number ?? '')}
                  </p>
                </div>
              </div>
              <div className='space-y-2 pl-6'>
                <p className='text-sm font-semibold text-muted-foreground'>Services:</p>
                {d.items.map((item, idx: number) => (
                  <div key={idx} className='flex justify-between items-start text-sm p-2 bg-muted/50 rounded'>
                    <div className='space-y-1'>
                      <div className='flex items-center gap-2'>
                        <Badge variant='outline' className='text-xs'>
                          {SERVICE_TYPES.find(t => t.value === item.service_type)?.label || item.service_type}
                        </Badge>
                        <span className='text-muted-foreground'>×{item.quantity}</span>
                      </div>
                      {item.ac_units && (
                        <p className='text-xs text-muted-foreground'>
                          AC: {String(item.ac_units.brand ?? '')} {String(item.ac_units.model_number ?? '')}
                          {item.ac_units.serial_number ? ` (SN: ${String(item.ac_units.serial_number)})` : null}
                        </p>
                      )}
                    </div>
                    <div className='font-semibold'>
                      Rp {(item.estimated_price || 0).toLocaleString('id-ID')}
                    </div>
                  </div>
                ))}
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

      {/* Action Buttons */}
      <div className='flex gap-2 pt-4 border-t'>
        <Button
          className='flex-1 bg-success hover:bg-success/90'
          onClick={() => onActionClick(data.order_id, 'accept')}
        >
          <Check className='w-4 h-4 mr-2' />
          Accept Order
        </Button>
        <Button
          variant='destructive'
          className='flex-1'
          onClick={() => onActionClick(data.order_id, 'cancel')}
        >
          <X className='w-4 h-4 mr-2' />
          Cancel Order
        </Button>
      </div>
    </div>
  )
}
