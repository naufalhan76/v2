'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2, Edit2, Check, X } from 'lucide-react'

export interface BankAccount {
  id: string
  account_label: string  // e.g., "Payment Account 1", "Payment Account 2"
  bank: string
  account_number: string
  account_name: string
  tax_percentage: number  // PPN per account (e.g., 11, 12, 0)
}

interface BankAccountsSectionProps {
  accounts: BankAccount[]
  onChange: (accounts: BankAccount[]) => void
}

export function BankAccountsSection({ accounts, onChange }: BankAccountsSectionProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    account_label: '',
    bank: '',
    account_number: '',
    account_name: '',
    tax_percentage: '11',
  })

  const handleAdd = () => {
    if (!formData.bank || !formData.account_number || !formData.account_name) return

    const accountLabel = formData.account_label || `Payment Account ${accounts.length + 1}`

    const newAccount: BankAccount = {
      id: Date.now().toString(),
      account_label: accountLabel,
      bank: formData.bank,
      account_number: formData.account_number,
      account_name: formData.account_name,
      tax_percentage: parseFloat(formData.tax_percentage) || 11,
    }

    onChange([...accounts, newAccount])
    setFormData({ account_label: '', bank: '', account_number: '', account_name: '', tax_percentage: '11' })
    setIsAdding(false)
  }

  const handleEdit = (account: BankAccount) => {
    setEditingId(account.id)
    setFormData({
      account_label: account.account_label,
      bank: account.bank,
      account_number: account.account_number,
      account_name: account.account_name,
      tax_percentage: account.tax_percentage?.toString() || '11',
    })
  }

  const handleUpdate = (id: string) => {
    const updatedAccounts = accounts.map((acc) =>
      acc.id === id
        ? { 
            ...acc, 
            account_label: formData.account_label,
            bank: formData.bank,
            account_number: formData.account_number,
            account_name: formData.account_name,
            tax_percentage: parseFloat(formData.tax_percentage) || 11,
          }
        : acc
    )
    onChange(updatedAccounts)
    setEditingId(null)
    setFormData({ account_label: '', bank: '', account_number: '', account_name: '', tax_percentage: '11' })
  }

  const handleDelete = (id: string) => {
    const remainingAccounts = accounts.filter((acc) => acc.id !== id)
    onChange(remainingAccounts)
  }

  const handleCancel = () => {
    setIsAdding(false)
    setEditingId(null)
    setFormData({ account_label: '', bank: '', account_number: '', account_name: '', tax_percentage: '11' })
  }

  return (
    <div className="space-y-6">
      {/* Bank Accounts */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Rekening Bank</CardTitle>
              <CardDescription>
                Kelola rekening bank untuk pembayaran invoice (bisa lebih dari 1)
              </CardDescription>
            </div>
          {!isAdding && (
            <Button onClick={() => setIsAdding(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Tambah Rekening
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Existing Accounts */}
        {accounts.length > 0 && (
          <div className="space-y-3">
            {accounts.map((account) => (
              <div
                key={account.id}
                className="p-4 border rounded-lg space-y-3"
              >
                {editingId === account.id ? (
                  // Edit Mode
                  <div className="space-y-3">
                    <div>
                      <Label>Label Akun *</Label>
                      <Input
                        value={formData.account_label}
                        onChange={(e) => setFormData({ ...formData, account_label: e.target.value })}
                        placeholder="Payment Account 1"
                      />
                    </div>
                    <div>
                      <Label>Nama Bank *</Label>
                      <Input
                        value={formData.bank}
                        onChange={(e) => setFormData({ ...formData, bank: e.target.value })}
                        placeholder="Bank Mandiri"
                      />
                    </div>
                    <div>
                      <Label>Nomor Rekening</Label>
                      <Input
                        value={formData.account_number}
                        onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                        placeholder="1234567890"
                      />
                    </div>
                    <div>
                      <Label>Atas Nama *</Label>
                      <Input
                        value={formData.account_name}
                        onChange={(e) => setFormData({ ...formData, account_name: e.target.value })}
                        placeholder="PT. AC Service Indonesia"
                      />
                    </div>
                    <div>
                      <Label>PPN (%) *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.tax_percentage}
                        onChange={(e) => setFormData({ ...formData, tax_percentage: e.target.value })}
                        placeholder="11"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Tarif PPN yang berlaku untuk payment account ini
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => handleUpdate(account.id)} size="sm">
                        <Check className="h-4 w-4 mr-2" />
                        Simpan
                      </Button>
                      <Button onClick={handleCancel} variant="outline" size="sm">
                        <X className="h-4 w-4 mr-2" />
                        Batal
                      </Button>
                    </div>
                  </div>
                ) : (
                  // View Mode
                  <div>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="text-sm font-semibold">
                            {account.account_label}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            PPN {account.tax_percentage}%
                          </Badge>
                        </div>
                        <h4 className="font-semibold mb-1">{account.bank}</h4>
                        <p className="text-sm text-muted-foreground">
                          {account.account_number}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          a/n {account.account_name}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleEdit(account)}
                          variant="outline"
                          size="sm"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          onClick={() => handleDelete(account.id)}
                          variant="destructive"
                          size="sm"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add New Account Form */}
        {isAdding && (
          <div className="p-4 border rounded-lg space-y-3 bg-muted/50">
            <h4 className="font-semibold">Tambah Rekening Baru</h4>
            <div>
              <Label>Label Akun (opsional)</Label>
              <Input
                value={formData.account_label}
                onChange={(e) => setFormData({ ...formData, account_label: e.target.value })}
                placeholder={`Payment Account ${accounts.length + 1}`}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Kosongkan untuk auto-generate: Payment Account {accounts.length + 1}
              </p>
            </div>
            <div>
              <Label>Nama Bank *</Label>
              <Input
                value={formData.bank}
                onChange={(e) => setFormData({ ...formData, bank: e.target.value })}
                placeholder="Bank Mandiri"
              />
            </div>
            <div>
              <Label>Nomor Rekening *</Label>
              <Input
                value={formData.account_number}
                onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                placeholder="1234567890"
              />
            </div>
            <div>
              <Label>Atas Nama *</Label>
              <Input
                value={formData.account_name}
                onChange={(e) => setFormData({ ...formData, account_name: e.target.value })}
                placeholder="PT. AC Service Indonesia"
              />
            </div>
            <div>
              <Label>PPN (%) *</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.tax_percentage}
                onChange={(e) => setFormData({ ...formData, tax_percentage: e.target.value })}
                placeholder="11"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Tarif PPN yang berlaku (default 11%)
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleAdd} size="sm">
                <Check className="h-4 w-4 mr-2" />
                Tambah
              </Button>
              <Button onClick={handleCancel} variant="outline" size="sm">
                <X className="h-4 w-4 mr-2" />
                Batal
              </Button>
            </div>
          </div>
        )}

        {accounts.length === 0 && !isAdding && (
          <div className="text-center py-8 text-muted-foreground">
            <p>Belum ada rekening bank yang ditambahkan</p>
            <Button onClick={() => setIsAdding(true)} variant="outline" size="sm" className="mt-4">
              <Plus className="h-4 w-4 mr-2" />
              Tambah Rekening Pertama
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
    </div>
  )
}
