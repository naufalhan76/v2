'use client'

import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { useRecordPayment } from '@/hooks/use-invoice-mutation'
import { formatCurrency } from '@/lib/format'
import type { Invoice } from '@/lib/actions/invoices'

interface RecordPaymentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoice: Pick<
    Invoice,
    'invoice_id' | 'invoice_number' | 'total_amount' | 'paid_amount'
  >
  onSuccess?: () => void
}

const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Cash' },
  { value: 'TRANSFER', label: 'Transfer' },
  { value: 'CHECK', label: 'Check' },
  { value: 'CREDIT_CARD', label: 'Credit Card' },
  { value: 'DEBIT_CARD', label: 'Debit Card' },
  { value: 'QRIS', label: 'QRIS' },
  { value: 'OTHER', label: 'Other' },
] as const

export function RecordPaymentModal({
  open,
  onOpenChange,
  invoice,
  onSuccess,
}: RecordPaymentModalProps) {
  const remaining = useMemo(
    () => Math.max(0, invoice.total_amount - invoice.paid_amount),
    [invoice.total_amount, invoice.paid_amount]
  )

  // Build schema each render so the `<= remaining` constraint reflects current state.
  const schema = useMemo(
    () =>
      z.object({
        amount: z
          .number({ invalid_type_error: 'Jumlah wajib diisi' })
          .positive('Jumlah harus lebih dari 0')
          .max(remaining, `Jumlah tidak boleh melebihi sisa tagihan ${formatCurrency(remaining)}`),
        payment_method: z.enum([
          'CASH',
          'TRANSFER',
          'CHECK',
          'CREDIT_CARD',
          'DEBIT_CARD',
          'QRIS',
          'OTHER',
        ]),
        payment_date: z.string().min(1, 'Tanggal wajib diisi'),
        reference_number: z.string().optional(),
        notes: z.string().optional(),
      }),
    [remaining]
  )

  type FormValues = z.infer<typeof schema>

  const mutation = useRecordPayment()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      amount: remaining,
      payment_method: 'TRANSFER',
      payment_date: new Date().toISOString().split('T')[0],
      reference_number: '',
      notes: '',
    },
  })

  // Re-pre-fill on open because remaining can change between opens.
  useEffect(() => {
    if (open) {
      form.reset({
        amount: remaining,
        payment_method: 'TRANSFER',
        payment_date: new Date().toISOString().split('T')[0],
        reference_number: '',
        notes: '',
      })
    }
  }, [open, remaining, form])

  async function onSubmit(values: FormValues) {
    await mutation.mutateAsync({
      invoiceId: invoice.invoice_id,
      payment: {
        amount: values.amount,
        payment_method: values.payment_method,
        payment_date: values.payment_date,
        reference_number: values.reference_number || undefined,
        notes: values.notes || undefined,
      },
    })
    onOpenChange(false)
    onSuccess?.()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Catat Pembayaran</DialogTitle>
          <DialogDescription>
            Mencatat pembayaran untuk invoice {invoice.invoice_number}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-border bg-surface-muted p-3 text-sm">
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">Total Invoice</span>
            <span className="font-semibold">{formatCurrency(invoice.total_amount)}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">Sudah Dibayar</span>
            <span className="font-semibold text-status-paid">
              {formatCurrency(invoice.paid_amount)}
            </span>
          </div>
          <Separator className="my-2" />
          <div className="flex justify-between gap-2">
            <span className="font-semibold">Sisa Tagihan</span>
            <span className="font-bold text-destructive">{formatCurrency(remaining)}</span>
          </div>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount">
              Jumlah Pembayaran <span className="text-destructive">*</span>
            </Label>
            <Input
              id="amount"
              type="number"
              inputMode="numeric"
              min="0"
              step="0.01"
              {...form.register('amount', { valueAsNumber: true })}
              placeholder="0"
              className="min-h-[44px]"
            />
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <button
                type="button"
                className="text-primary hover:underline min-h-[32px]"
                onClick={() => form.setValue('amount', remaining, { shouldValidate: true })}
              >
                Bayar penuh ({formatCurrency(remaining)})
              </button>
              {form.formState.errors.amount && (
                <p className="text-destructive">
                  {form.formState.errors.amount.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="payment_method">
                Metode <span className="text-destructive">*</span>
              </Label>
              <Select
                value={form.watch('payment_method')}
                onValueChange={(v) =>
                  form.setValue('payment_method', v as FormValues['payment_method'], {
                    shouldValidate: true,
                  })
                }
              >
                <SelectTrigger id="payment_method" className="min-h-[44px]">
                  <SelectValue placeholder="Pilih metode" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment_date">
                Tanggal <span className="text-destructive">*</span>
              </Label>
              <Input
                id="payment_date"
                type="date"
                {...form.register('payment_date')}
                className="min-h-[44px]"
              />
              {form.formState.errors.payment_date && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.payment_date.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reference_number">Nomor Referensi</Label>
            <Input
              id="reference_number"
              {...form.register('reference_number')}
              placeholder="Misal: nomor transfer, nomor cek"
              className="min-h-[44px]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Catatan</Label>
            <Textarea
              id="notes"
              {...form.register('notes')}
              placeholder="Catatan opsional"
              rows={2}
            />
          </div>

          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="min-h-[44px]">
              Batal
            </Button>
            <Button type="submit" disabled={mutation.isPending} className="min-h-[44px]">
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Catat Pembayaran
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
