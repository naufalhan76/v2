import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Pencil, User, Phone, Mail, Building2, MapPin, FileText } from 'lucide-react'
import { formatPhone } from '@/lib/utils'
import type { Customer } from '@/types/customers'

import { AddressPickerReadOnly } from '@/components/address/address-picker-readonly'

interface CustomerInfoCardProps {
  customer: Customer
  onEdit: () => void
}

export function CustomerInfoCard({ customer, onEdit }: CustomerInfoCardProps) {
  const locationsCount = customer.locations?.length ?? 0
  const totalAcUnits = (customer.locations ?? []).reduce(
    (sum, loc) => sum + (loc.ac_units?.length ?? 0),
    0,
  )

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide">
              <User className="h-3.5 w-3.5" />
              Kontak Person
            </div>
            <p className="text-sm font-medium">{customer.primary_contact_person || '-'}</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide">
              <Phone className="h-3.5 w-3.5" />
              Telepon
            </div>
            <p className="text-sm font-medium font-mono">
              {formatPhone(customer.phone_number) || '-'}
            </p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide">
              <Mail className="h-3.5 w-3.5" />
              Email
            </div>
            <p className="text-sm font-medium truncate">{customer.email || '-'}</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide">
              <Building2 className="h-3.5 w-3.5" />
              Aset
            </div>
            <p className="text-sm font-medium">
              {locationsCount} lokasi · {totalAcUnits} AC
            </p>
          </div>
        </div>
        {customer.billing_address && (
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-start gap-2 text-sm">
              <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Alamat Billing
                </p>
                <p>{customer.billing_address}</p>
                <AddressPickerReadOnly lat={customer.lat ?? null} lng={customer.lng ?? null} />
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface DetailTabProps {
  customer: Customer
  onEdit: () => void
}

export function DetailTab({ customer, onEdit }: DetailTabProps) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Informasi Customer</CardTitle>
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Pencil className="h-4 w-4 mr-2" />
          Ubah
        </Button>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-4 sm:grid-cols-2">
          <DetailRow label="Nama Customer" value={customer.customer_name} />
          <DetailRow label="Kontak Person" value={customer.primary_contact_person} />
          <DetailRow
            label="Nomor Telepon"
            value={formatPhone(customer.phone_number) || '-'}
            mono
          />
          <DetailRow label="Email" value={customer.email} />
          <DetailRow
            label="Alamat Billing"
            value={customer.billing_address}
            className="sm:col-span-2"
          />
          <DetailRow
            label="Catatan"
            value={customer.notes || '-'}
            className="sm:col-span-2"
            icon={FileText}
          />
        </dl>
      </CardContent>
    </Card>
  )
}

function DetailRow({
  label,
  value,
  mono,
  className,
  icon: Icon,
}: {
  label: string
  value: string | null | undefined
  mono?: boolean
  className?: string
  icon?: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className={className}>
      <dt className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
      </dt>
      <dd className={`mt-1 text-sm ${mono ? 'font-mono' : ''}`}>{value || '-'}</dd>
    </div>
  )
}
