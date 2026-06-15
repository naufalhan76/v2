'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SearchableSelect } from '@/components/ui/searchable-select'
import type { BlankInvoiceFormProps } from './types'

export function BlankInvoiceForm({
  watchedPaymentAccountId,
  bankAccounts,
  totals,
  register,
  setValue,
  formatCurrency,
}: BlankInvoiceFormProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="discount_amount">Diskon Nominal (Rp)</Label>
          <Input
            id="discount_amount"
            type="number"
            min="0"
            step="1"
            {...register('discount_amount', { valueAsNumber: true })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="discount_percentage">Diskon Persen (%)</Label>
          <Input
            id="discount_percentage"
            type="number"
            min="0"
            max="100"
            step="0.01"
            {...register('discount_percentage', { valueAsNumber: true })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tax_percentage">PPN (%)</Label>
          <Input
            id="tax_percentage"
            type="number"
            min="0"
            max="100"
            step="0.01"
            {...register('tax_percentage', { valueAsNumber: true })}
          />
        </div>
      </div>

      <Separator />

      <div className="space-y-2">
        <Label>Rekening Pembayaran (Opsional)</Label>
        {bankAccounts.length > 3 ? (
          <SearchableSelect
            options={[
              { id: 'none', label: '— Tanpa Rekening —' },
              ...bankAccounts.map((acc) => ({
                id: acc.id,
                label: acc.account_label,
                secondaryLabel: `${acc.bank} ${acc.account_number}`,
              })),
            ]}
            value={watchedPaymentAccountId || 'none'}
            onValueChange={(value) =>
              setValue('payment_account_id', value === 'none' ? undefined : value, {
                shouldValidate: true,
              })
            }
            placeholder="Pilih rekening (opsional)"
            searchPlaceholder="Cari rekening..."
          />
        ) : (
          <Select
            value={watchedPaymentAccountId || 'none'}
            onValueChange={(value) =>
              setValue('payment_account_id', value === 'none' ? undefined : value, {
                shouldValidate: true,
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Pilih rekening (opsional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— Tanpa Rekening —</SelectItem>
              {bankAccounts.map((acc) => (
                <SelectItem key={acc.id} value={acc.id}>
                  {acc.account_label} · {acc.bank} {acc.account_number}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <Separator />

      <div className="space-y-2">
        <Label htmlFor="notes">Catatan</Label>
        <Textarea id="notes" rows={3} placeholder="Catatan tambahan" {...register('notes')} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="terms_conditions">Syarat & Ketentuan</Label>
        <Textarea
          id="terms_conditions"
          rows={3}
          placeholder="Kosongkan untuk memakai template default"
          {...register('terms_conditions')}
        />
      </div>

      <Separator />

      <div className="space-y-2">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span className="font-semibold">{formatCurrency(totals.subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span>Diskon</span>
          <span className="font-semibold text-destructive">
            - {formatCurrency(totals.totalDiscount)}
          </span>
        </div>
        <div className="flex justify-between">
          <span>PPN ({totals.taxPercentage}%)</span>
          <span className="font-semibold">{formatCurrency(totals.taxAmount)}</span>
        </div>
        <Separator />
        <div className="flex justify-between text-lg">
          <span className="font-bold">Total</span>
          <span className="font-bold text-primary">
            {formatCurrency(totals.total)}
          </span>
        </div>
      </div>
    </div>
  )
}
