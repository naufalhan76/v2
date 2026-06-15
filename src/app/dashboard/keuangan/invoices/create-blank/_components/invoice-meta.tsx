'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { UseFormRegister, UseFormSetValue, FieldErrors } from 'react-hook-form'
import type { CreateBlankInvoiceInput } from '@/app/api/schemas'

interface InvoiceMetaProps {
  register: UseFormRegister<CreateBlankInvoiceInput>
  setValue: UseFormSetValue<CreateBlankInvoiceInput>
  watch: (field: 'invoice_type') => string
  errors: FieldErrors<CreateBlankInvoiceInput>
}

export function InvoiceMeta({ register, setValue, watch, errors }: InvoiceMetaProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label>Nomor Invoice</Label>
          <Input value="(akan dibuat otomatis)" readOnly disabled />
        </div>
        <div className="space-y-2">
          <Label>Tipe Invoice</Label>
          <Select
            value={watch('invoice_type')}
            onValueChange={(value: 'FINAL' | 'PROFORMA') =>
              setValue('invoice_type', value, { shouldValidate: true })
            }
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="FINAL">FINAL</SelectItem>
              <SelectItem value="PROFORMA">PROFORMA</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="invoice_date">Tanggal Invoice</Label>
          <Input id="invoice_date" type="date" {...register('invoice_date')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="due_date">
            Jatuh Tempo <span className="text-destructive">*</span>
          </Label>
          <Input id="due_date" type="date" {...register('due_date')} />
          {errors.due_date && (
            <p className="text-sm text-destructive">{errors.due_date.message}</p>
          )}
        </div>
      </div>
    </div>
  )
}
