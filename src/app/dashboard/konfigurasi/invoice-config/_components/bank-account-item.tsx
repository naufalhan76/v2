'use client'

import { useState } from 'react'
import type { BankAccount } from '@/lib/bank-accounts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2, Edit2, Check, X } from 'lucide-react'

interface BankAccountItemProps {
  account: BankAccount
  isEditing: boolean
  formData: { account_label: string; bank: string; account_number: string; account_name: string; tax_percentage: string }
  onFormDataChange: (data: { account_label: string; bank: string; account_number: string; account_name: string; tax_percentage: string }) => void
  onEdit: () => void
  onUpdate: () => void
  onDelete: () => void
  onCancel: () => void
}

export function BankAccountItem({ account, isEditing, formData, onFormDataChange, onEdit, onUpdate, onDelete, onCancel }: BankAccountItemProps) {
  if (isEditing) {
    return (
      <div className="space-y-3">
        <div>
          <Label className="text-sm font-medium text-foreground">Label Akun *</Label>
          <Input value={formData.account_label} onChange={(e) => onFormDataChange({ ...formData, account_label: e.target.value })} placeholder="Payment Account 1" className="h-10" />
        </div>
        <div>
          <Label className="text-sm font-medium text-foreground">Nama Bank *</Label>
          <Input value={formData.bank} onChange={(e) => onFormDataChange({ ...formData, bank: e.target.value })} placeholder="Bank Mandiri" className="h-10" />
        </div>
        <div>
          <Label className="text-sm font-medium text-foreground">Nomor Rekening</Label>
          <Input value={formData.account_number} onChange={(e) => onFormDataChange({ ...formData, account_number: e.target.value })} placeholder="1234567890" className="h-10" />
        </div>
        <div>
          <Label className="text-sm font-medium text-foreground">Atas Nama *</Label>
          <Input value={formData.account_name} onChange={(e) => onFormDataChange({ ...formData, account_name: e.target.value })} placeholder="PT. AC Service Indonesia" className="h-10" />
        </div>
        <div>
          <Label className="text-sm font-medium text-foreground">PPN (%) *</Label>
          <Input type="number" step="0.01" value={formData.tax_percentage} onChange={(e) => onFormDataChange({ ...formData, tax_percentage: e.target.value })} placeholder="11" className="h-10" />
          <p className="text-xs text-muted-foreground mt-1">Tarif PPN yang berlaku untuk payment account ini</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={onUpdate} size="sm"><Check className="h-4 w-4 mr-2" />Simpan</Button>
          <Button onClick={onCancel} variant="outline" size="sm"><X className="h-4 w-4 mr-2" />Batal</Button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-2">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <Badge variant="outline" className="text-sm font-semibold">{account.account_label}</Badge>
            <Badge variant="secondary" className="text-xs">PPN {account.tax_percentage}%</Badge>
          </div>
          <h4 className="font-semibold mb-1">{account.bank}</h4>
          <p className="text-sm text-muted-foreground break-all">{account.account_number}</p>
          <p className="text-sm text-muted-foreground">a/n {account.account_name}</p>
        </div>
        <div className="flex gap-2 sm:shrink-0">
          <Button onClick={onEdit} variant="outline" size="sm" className="flex-1 sm:flex-none min-h-[44px] sm:min-h-9"><Edit2 className="h-4 w-4" /></Button>
          <Button onClick={onDelete} variant="destructive" size="sm" className="flex-1 sm:flex-none min-h-[44px] sm:min-h-9"><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>
    </div>
  )
}
