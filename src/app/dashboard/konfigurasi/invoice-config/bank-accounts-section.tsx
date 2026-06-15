'use client'

import { useState } from 'react'
import type { BankAccount } from '@/lib/bank-accounts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { BankAccountItem } from './_components/bank-account-item'
import { AddBankAccountForm } from './_components/add-bank-account-form'

export type { BankAccount } from '@/lib/bank-accounts'

interface BankAccountsSectionProps {
  accounts: BankAccount[]
  onChange: (accounts: BankAccount[]) => void
}

export function BankAccountsSection({ accounts, onChange }: BankAccountsSectionProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({ account_label: '', bank: '', account_number: '', account_name: '', tax_percentage: '11' })

  const handleAdd = () => {
    if (!formData.bank || !formData.account_number || !formData.account_name) return
    const accountLabel = formData.account_label || `Payment Account ${accounts.length + 1}`
    const newAccount: BankAccount = {
      id: Date.now().toString(), account_label: accountLabel, bank: formData.bank,
      account_number: formData.account_number, account_name: formData.account_name,
      tax_percentage: parseFloat(formData.tax_percentage) || 11,
    }
    onChange([...accounts, newAccount])
    setFormData({ account_label: '', bank: '', account_number: '', account_name: '', tax_percentage: '11' })
    setIsAdding(false)
  }

  const handleEdit = (account: BankAccount) => {
    setEditingId(account.id)
    setFormData({
      account_label: account.account_label, bank: account.bank, account_number: account.account_number,
      account_name: account.account_name, tax_percentage: account.tax_percentage?.toString() || '11',
    })
  }

  const handleUpdate = (id: string) => {
    const updatedAccounts = accounts.map((acc) =>
      acc.id === id ? { ...acc, account_label: formData.account_label, bank: formData.bank, account_number: formData.account_number, account_name: formData.account_name, tax_percentage: parseFloat(formData.tax_percentage) || 11 } : acc
    )
    onChange(updatedAccounts)
    setEditingId(null)
    setFormData({ account_label: '', bank: '', account_number: '', account_name: '', tax_percentage: '11' })
  }

  const handleDelete = (id: string) => {
    onChange(accounts.filter((acc) => acc.id !== id))
  }

  const handleCancel = () => {
    setIsAdding(false); setEditingId(null)
    setFormData({ account_label: '', bank: '', account_number: '', account_name: '', tax_percentage: '11' })
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-xl border border-border/50 shadow-sm">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg font-semibold text-foreground">Rekening Bank</CardTitle>
              <CardDescription>Kelola rekening bank untuk pembayaran invoice (bisa lebih dari 1)</CardDescription>
            </div>
            {!isAdding && (
              <Button onClick={() => setIsAdding(true)} size="sm" className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />Tambah Rekening
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {accounts.length > 0 && (
            <div className="space-y-3">
              {accounts.map((account) => (
                <div key={account.id} className="space-y-3 rounded-xl border border-border/50 p-4 shadow-sm">
                  <BankAccountItem
                    account={account}
                    isEditing={editingId === account.id}
                    formData={formData}
                    onFormDataChange={setFormData}
                    onEdit={() => handleEdit(account)}
                    onUpdate={() => handleUpdate(account.id)}
                    onDelete={() => handleDelete(account.id)}
                    onCancel={handleCancel}
                  />
                </div>
              ))}
            </div>
          )}

          {isAdding && (
            <AddBankAccountForm
              accountsCount={accounts.length}
              formData={formData}
              onFormDataChange={setFormData}
              onAdd={handleAdd}
              onCancel={handleCancel}
            />
          )}

          {accounts.length === 0 && !isAdding && (
            <div className="text-center py-8 text-muted-foreground">
              <p>Belum ada rekening bank yang ditambahkan</p>
              <Button onClick={() => setIsAdding(true)} variant="outline" size="sm" className="mt-4">
                <Plus className="h-4 w-4 mr-2" />Tambah Rekening Pertama
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
