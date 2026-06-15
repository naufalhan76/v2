import { Clock, MapPin, Phone, User } from 'lucide-react'

interface CustomerInfoCardProps {
  customer: {
    customer_name?: string | null
    primary_contact_person?: string | null
    phone_number?: string | null
  } | null
  location: {
    full_address?: string | null
    city?: string | null
  } | null
  scheduledTime: string
}

export function CustomerInfoCard({ customer, location, scheduledTime }: CustomerInfoCardProps) {
  return (
    <div className="rounded-lg border border-border dark:border-border bg-background dark:bg-surface-muted p-4 space-y-3">
      <h2 className="font-semibold text-lg text-balance dark:text-foreground">{customer?.customer_name ?? 'Customer'}</h2>

      {customer?.primary_contact_person && (
        <div className="flex items-center gap-2 text-sm">
          <User className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
          <span>{customer.primary_contact_person}</span>
        </div>
      )}

      {customer?.phone_number && (
        <div className="flex items-center gap-2 text-sm">
          <Phone className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
          <a
            href={`tel:${customer.phone_number}`}
            className="text-primary underline-offset-2 hover:underline"
          >
            {customer.phone_number}
          </a>
        </div>
      )}

      {location && (
        <div className="flex items-start gap-2 text-sm">
          <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
          <span>{location.full_address}{location.city ? `, ${location.city}` : ''}</span>
        </div>
      )}

      <div className="flex items-center gap-2 text-sm">
        <Clock className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
        <span>{scheduledTime}</span>
      </div>
    </div>
  )
}
