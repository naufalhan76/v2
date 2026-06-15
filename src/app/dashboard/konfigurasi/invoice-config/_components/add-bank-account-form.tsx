'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Check, X } from 'lucide-react'

interface AddBankAccountFormProps {
  accountsCount: number
  formData: { account_label: string; bank: string; account_number: string; account_name: string; tax_percentage: string }
  onFormDataChange: (data: { account_label: string; bank: string; account_number: string; account_name: string; tax_percentage: string }) => void
  onAdd: () => void
  onCancel: () => void
}

export function AddBankAccountForm({ accountsCount, formData, onFormDataChange, onAdd, onCancel }: AddBankAccountFormProps) {
  return (
    <div className="space-y-3 rounded-xl border border-border/50 bg-muted/50 p-4 shadow-sm">
      <h4 className="text-lg font-semibold text-foreground">Tambah Rekening Baru</h4>
      <div>
        <Label className="text-sm font-medium text-foreground">Label Akun (opsional)</Label>
        <Input value={formData.account_label} onChange={(e) => onFormDataChange({ ...formData, account_label: e.target.value })}
          placeholder={`Payment Account ${accountsCount + 1}`} className="h-10" />
        <p className="text-xs text-muted-foreground mt-1">Kosongkan untuk auto-generate: Payment Account {accountsCount + 1}</p>
      </div>
      <div>
        <Label className="text-sm font-medium text-foreground">Nama Bank *</Label>
        <Input value={formData.bank} onChange={(e) => onFormDataChange({ ...formData, bank: e.target.value })} placeholder="Bank Mandiri" className="h-10" />
      </div>
      <div>
        <Label className="text-sm font-medium text-foreground">Nomor Rekening *</Label>
        <Input value={formData.account_number} onChange={(e) => onFormDataChange({ ...formData, account_number: e.target.value })} placeholder="1234567890" className="h-10" />
      </div>
      <div>
        <Label className="text-sm font-medium text-foreground">Atas Nama *</Label>
        <Input value={formData.account_name} onChange={(e) => onFormDataChange({ ...formData, account_name: e.target.value })} placeholder="PT. AC Service Indonesia" className="h-10" />
      </div>
      <div>
        <Label className="text-sm font-medium text-foreground">PPN (%) *</Label>
        <Input type="number" step="0.01" value={formData.tax_percentage} onChange={(e) => onFormDataChange({ ...formData, tax_percentage: e.target.value })} placeholder="11" className="h-10" />
        <p className="text-xs text-muted-foreground mt-1">Tarif PPN yang berlaku (default 11%)</p>
      </div>
      <div className="flex gap-2">
        <Button onClick={onAdd} size="sm"><Check className="h-4 w-4 mr-2" />Tambah</Button>
        <Button onClick={onCancel} variant="outline" size="sm"><X className="h-4 w-4 mr-2" />Batal</Button>
      </div>
    </div>
  )
}
