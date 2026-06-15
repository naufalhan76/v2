'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import type { FieldValues, UseFormReturn } from 'react-hook-form'

interface InvoiceSettingsTabProps {
  form: UseFormReturn<FieldValues>
}

export function InvoiceSettingsTab({ form }: InvoiceSettingsTabProps) {
  const { register, formState } = form
  return (
    <Card className="rounded-xl border border-border/50 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-foreground">Pengaturan Invoice</CardTitle>
        <CardDescription>Konfigurasi format dan ketentuan invoice</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="invoicePrefix" className="text-sm font-medium text-foreground">Prefix Invoice <span className="text-destructive">*</span></Label>
          <Input id="invoicePrefix" placeholder="INV" className="h-10" {...register('invoicePrefix')} />
          {formState.errors.invoicePrefix && <p className="text-sm text-destructive">{String(formState.errors.invoicePrefix.message)}</p>}
          <p className="text-sm text-muted-foreground">Format: INV/2025/01/0001</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="defaultDueDays" className="text-sm font-medium text-foreground">Jatuh Tempo (hari)</Label>
          <Input id="defaultDueDays" placeholder="30" type="number" className="h-10" {...register('defaultDueDays')} />
          <p className="text-sm text-muted-foreground">Jumlah hari dari tanggal invoice hingga jatuh tempo</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="termsConditions" className="text-sm font-medium text-foreground">Syarat & Ketentuan</Label>
          <Textarea id="termsConditions" placeholder="Terima kasih atas kepercayaan Anda..." rows={4} {...register('termsConditions')} />
          <p className="text-sm text-muted-foreground">Teks yang akan ditampilkan di bagian bawah invoice</p>
        </div>
      </CardContent>
    </Card>
  )
}
