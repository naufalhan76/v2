'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import type { FieldValues, UseFormReturn } from 'react-hook-form'

interface CompanyTabProps {
  form: UseFormReturn<FieldValues>
}

export function CompanyTab({ form }: CompanyTabProps) {
  const { register, formState } = form
  return (
    <Card className="rounded-xl border border-border/50 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-foreground">Informasi Perusahaan</CardTitle>
        <CardDescription>Informasi ini akan ditampilkan di header invoice</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="companyName" className="text-sm font-medium text-foreground">Nama Perusahaan <span className="text-destructive">*</span></Label>
          <Input id="companyName" placeholder="PT. AC Service Indonesia" className="h-10" {...register('companyName')} />
          {formState.errors.companyName && <p className="text-sm text-destructive">{String(formState.errors.companyName.message)}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="companyAddress" className="text-sm font-medium text-foreground">Alamat</Label>
          <Textarea id="companyAddress" placeholder="Jl. Contoh No. 123, Jakarta Selatan" rows={3} {...register('companyAddress')} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="companyPhone" className="text-sm font-medium text-foreground">Telepon</Label>
            <Input id="companyPhone" placeholder="021-12345678" className="h-10" {...register('companyPhone')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="companyEmail" className="text-sm font-medium text-foreground">Email</Label>
            <Input id="companyEmail" type="email" placeholder="info@acservice.com" className="h-10" {...register('companyEmail')} />
            {formState.errors.companyEmail && <p className="text-sm text-destructive">{String(formState.errors.companyEmail.message)}</p>}
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="npwp" className="text-sm font-medium text-foreground">NPWP</Label>
          <Input id="npwp" placeholder="12.345.678.9-012.000" className="h-10" {...register('npwp')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="logoUrl" className="text-sm font-medium text-foreground">URL Logo</Label>
          <Input id="logoUrl" placeholder="https://example.com/logo.png" className="h-10" {...register('logoUrl')} />
          <p className="text-sm text-muted-foreground">URL logo perusahaan yang akan ditampilkan di invoice</p>
        </div>
      </CardContent>
    </Card>
  )
}
