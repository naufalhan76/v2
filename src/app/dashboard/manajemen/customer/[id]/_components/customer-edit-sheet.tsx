'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { AddressPicker } from '@/components/address/address-picker'
import type { CustomerFormState } from '../_hooks/use-customer-detail'

interface CustomerEditSheetProps {
  customerId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  form: CustomerFormState
  onFormChange: (form: CustomerFormState) => void
  isSaving: boolean
  onSave: (e: React.FormEvent) => Promise<void>
}

function field(field: keyof CustomerFormState, form: CustomerFormState, onChange: (f: CustomerFormState) => void) {
  return (value: string) => onChange({ ...form, [field]: value })
}

export function CustomerEditSheet({
  customerId, open, onOpenChange, form, onFormChange, isSaving, onSave,
}: CustomerEditSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full max-w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Edit Customer</SheetTitle>
          <SheetDescription>Perbarui informasi customer</SheetDescription>
        </SheetHeader>
        <form onSubmit={onSave} className="space-y-4 mt-4">
          {([
            ['customer_name', 'Nama Customer', false],
            ['primary_contact_person', 'Kontak Person', false],
            ['phone_number', 'Nomor Telepon', true],
            ['email', 'Email', true],
          ] as const).map(([key, label, isTel]) => (
            <div className="space-y-2" key={key}>
              <Label htmlFor={key}>{label} *</Label>
              <Input
                id={key}
                type={isTel ? 'tel' : 'text'}
                value={form[key]}
                onChange={(e) => (onFormChange as (f: CustomerFormState) => void)({ ...form, [key]: e.target.value })}
                required
              />
            </div>
          ))}
          <div className="space-y-2">
            <Label htmlFor="billing_address">Alamat Billing *</Label>
            <Textarea id="billing_address" value={form.billing_address} onChange={(e) => onFormChange({ ...form, billing_address: e.target.value })} required rows={3} />
          </div>
          <div className="pt-2">
            <AddressPicker
              value={{ lat: form.lat ?? null, lng: form.lng ?? null }}
              onChange={(v) => onFormChange({ ...form, lat: v.lat, lng: v.lng })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Catatan</Label>
            <Textarea id="notes" value={form.notes} onChange={(e) => onFormChange({ ...form, notes: e.target.value })} rows={3} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
            <Button type="submit" disabled={isSaving}>{isSaving ? 'Menyimpan...' : 'Simpan'}</Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
