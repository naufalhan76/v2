'use client'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { AddressPicker } from '@/components/address/address-picker'

export interface CustomerFormData {
  customer_name: string
  primary_contact_person: string
  phone_number: string
  email: string
  billing_address: string
  notes: string
  lat: number | null
  lng: number | null
}

interface CustomerFormModalProps {
  mode: 'create' | 'edit'
  open: boolean
  onOpenChange: (open: boolean) => void
  formData: CustomerFormData
  onFormDataChange: (data: CustomerFormData) => void
  onSubmit: (e: React.FormEvent) => void
  isSubmitting: boolean
}

const emptyForm: CustomerFormData = {
  customer_name: '',
  primary_contact_person: '',
  phone_number: '',
  email: '',
  billing_address: '',
  notes: '',
  lat: null,
  lng: null,
}

export function CustomerFormModal({
  mode,
  open,
  onOpenChange,
  formData,
  onFormDataChange,
  onSubmit,
  isSubmitting,
}: CustomerFormModalProps) {
  const handleOpenChange = (open: boolean) => {
    if (open && mode === 'create') {
      onFormDataChange(emptyForm)
    } else if (!open && mode === 'create') {
      onFormDataChange(emptyForm)
    }
    onOpenChange(open)
  }

  // Use formData directly for edit mode (populated by parent)
  const activeData = formData

  const updateField = (field: keyof CustomerFormData, value: string) => {
    const newData = { ...activeData, [field]: value }
    onFormDataChange(newData)
  }

  const title = mode === 'create' ? 'Tambah Customer Baru' : 'Edit Customer'
  const description = mode === 'create'
    ? 'Lengkapi informasi customer di bawah ini'
    : 'Perbarui informasi customer'
  const submitLabel = isSubmitting ? 'Menyimpan...' : 'Simpan'

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="w-full max-w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <form onSubmit={onSubmit} className="space-y-4 mt-4">
          <div>
            <Label htmlFor={`${mode}_customer_name`}>Nama Customer *</Label>
            <Input
              id={`${mode}_customer_name`}
              value={activeData.customer_name}
              onChange={(e) => updateField('customer_name', e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor={`${mode}_primary_contact_person`}>Kontak Person *</Label>
            <Input
              id={`${mode}_primary_contact_person`}
              value={activeData.primary_contact_person}
              onChange={(e) => updateField('primary_contact_person', e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor={`${mode}_phone_number`}>Nomor Telepon *</Label>
            <Input
              id={`${mode}_phone_number`}
              type="tel"
              value={activeData.phone_number}
              onChange={(e) => updateField('phone_number', e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor={`${mode}_email`}>Email *</Label>
            <Input
              id={`${mode}_email`}
              type="email"
              value={activeData.email}
              onChange={(e) => updateField('email', e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor={`${mode}_billing_address`}>Alamat Billing *</Label>
            <Textarea
              id={`${mode}_billing_address`}
              value={activeData.billing_address}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateField('billing_address', e.target.value)}
              required
              rows={3}
            />
          </div>
          <div className="pt-2">
            <AddressPicker
              value={{ lat: activeData.lat ?? null, lng: activeData.lng ?? null }}
              onChange={(v) => {
                onFormDataChange({
                  ...activeData,
                  lat: v.lat,
                  lng: v.lng
                })
              }}
            />
          </div>
          <div>
            <Label htmlFor={`${mode}_notes`}>Catatan</Label>
            <Textarea
              id={`${mode}_notes`}
              value={activeData.notes}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateField('notes', e.target.value)}
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onOpenChange(false)
                onFormDataChange(emptyForm)
              }}
            >
              Batal
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {submitLabel}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
