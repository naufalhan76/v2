'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { ArrowLeft, Check, Loader2 } from 'lucide-react'

import { formatCurrency } from './format'
import type { ReviewSubmitStepProps } from './types'

export function ReviewSubmitStep({
  bankAccounts,
  paymentAccountId,
  totals,
  errors,
  register,
  setValue,
  isLoading,
  onPrevious,
}: ReviewSubmitStepProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 4: Review & Finalize</CardTitle>
        <CardDescription>Review invoice dan finalisasi</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Payment Account *</Label>
            {bankAccounts.length > 3 ? (
              <SearchableSelect
                options={bankAccounts.map((account) => ({
                  id: account.id,
                  label: account.account_label,
                  secondaryLabel: `${account.bank} - ${account.account_number} (PPN ${account.tax_percentage}%)`,
                }))}
                value={paymentAccountId}
                onValueChange={(value) => setValue('paymentAccountId', value)}
                placeholder="Pilih payment account"
                searchPlaceholder="Cari rekening..."
              />
            ) : (
              <Select
                value={paymentAccountId}
                onValueChange={(value) => setValue('paymentAccountId', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih payment account" />
                </SelectTrigger>
                <SelectContent>
                  {bankAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      <div className="flex flex-col">
                        <span className="font-semibold">{account.account_label}</span>
                        <span className="text-xs text-muted-foreground">
                          {account.bank} - {account.account_number} (PPN {account.tax_percentage}%)
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {errors.paymentAccountId && (
              <p className="text-sm text-destructive">{errors.paymentAccountId.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Tanggal Jatuh Tempo *</Label>
            <Input type="date" {...register('dueDate')} />
            {errors.dueDate && (
              <p className="text-sm text-destructive">{errors.dueDate.message}</p>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Diskon (Rp)</Label>
            <Input type="number" {...register('discountAmount')} />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Catatan</Label>
          <Textarea {...register('notes')} rows={3} />
        </div>

        <Separator />

        <div className="space-y-2">
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span className="font-semibold">{formatCurrency(totals.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span>Diskon:</span>
            <span className="font-semibold text-destructive">
              - {formatCurrency(totals.discountAmount)}
            </span>
          </div>
          <div className="flex justify-between">
            <span>PPN ({totals.taxPercentage}%):</span>
            <span className="font-semibold">{formatCurrency(totals.taxAmount)}</span>
          </div>
          <Separator />
          <div className="flex justify-between text-lg">
            <span className="font-bold">Total:</span>
            <span className="font-bold text-primary">
              {formatCurrency(totals.total)}
            </span>
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-2">
          <Button type="button" variant="outline" onClick={onPrevious} className="min-h-[44px]">
            <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
          </Button>
          <Button type="submit" disabled={isLoading} className="min-h-[44px]">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Membuat Invoice...
              </>
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                Buat Invoice
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
