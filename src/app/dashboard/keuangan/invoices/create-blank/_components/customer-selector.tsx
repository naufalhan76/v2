'use client'

import { SearchableSelect } from '@/components/ui/searchable-select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import type { CustomerSelectorProps } from './types'

export function CustomerSelector({
  customers,
  watchedCustomerId,
  errors,
  register,
  setValue,
}: CustomerSelectorProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Pelanggan Terdaftar (Opsional)</Label>
        <SearchableSelect
          options={[
            { id: 'none', label: '— Tanpa Pelanggan Terdaftar —' },
            ...customers.map((c) => ({
              id: c.customer_id,
              label: c.customer_name,
              secondaryLabel: c.phone_number || undefined,
            })),
          ]}
          value={watchedCustomerId || 'none'}
          onValueChange={(value) =>
            setValue('customer_id', value === 'none' ? undefined : value, {
              shouldValidate: true,
            })
          }
          placeholder="Pilih pelanggan terdaftar (opsional)"
          searchPlaceholder="Cari pelanggan..."
        />
        <p className="text-xs text-muted-foreground">
          Memilih pelanggan akan mengisi otomatis kolom di bawah. Jika tidak dipilih,
          isi manual.
        </p>
      </div>

      <Separator />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="customer_name">
            Nama Pelanggan <span className="text-destructive">*</span>
          </Label>
          <Input
            id="customer_name"
            placeholder="Nama pelanggan"
            {...register('customer_name')}
          />
          {errors.customer_name && (
            <p className="text-sm text-destructive">{errors.customer_name.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="customer_phone">No. Telepon</Label>
          <Input
            id="customer_phone"
            placeholder="08xxxxxxxxxx"
            {...register('customer_phone')}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="customer_email">Email</Label>
          <Input
            id="customer_email"
            type="email"
            placeholder="email@domain.com"
            {...register('customer_email')}
          />
          {errors.customer_email && (
            <p className="text-sm text-destructive">{errors.customer_email.message}</p>
          )}
        </div>

        <div className="space-y-2 md:col-span-1">
          <Label htmlFor="customer_address">Alamat</Label>
          <Textarea
            id="customer_address"
            rows={2}
            placeholder="Alamat penagihan"
            {...register('customer_address')}
          />
        </div>
      </div>
    </div>
  )
}
