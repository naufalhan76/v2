import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { AddressPicker } from '@/components/address/address-picker'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { BankAccount } from '@/lib/bank-accounts'
import type { RevisionDraft } from '../_hooks/use-invoice-detail'

interface InvoiceRevisionFormProps {
  revisionDraft: RevisionDraft
  invoiceCustomerId: string | null
  bankAccounts: BankAccount[]
  formatCurrency: (amount: number) => string
  onUpdateField: <K extends keyof RevisionDraft>(field: K, value: RevisionDraft[K]) => void
}

export function InvoiceRevisionForm({
  revisionDraft,
  invoiceCustomerId,
  bankAccounts,
  formatCurrency,
  onUpdateField,
}: InvoiceRevisionFormProps) {
  const isLinkedCustomer = Boolean(invoiceCustomerId)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="rev-customer-name">Nama Customer</Label>
          <Input
            id="rev-customer-name"
            value={revisionDraft.customer_name}
            onChange={(e) => onUpdateField('customer_name', e.target.value)}
            disabled={isLinkedCustomer}
            placeholder="Nama customer"
          />
          {isLinkedCustomer && (
            <p className="text-xs text-muted-foreground">Customer terhubung — kelola di halaman customer.</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="rev-customer-phone">No. Telepon</Label>
          <Input
            id="rev-customer-phone"
            value={revisionDraft.customer_phone}
            onChange={(e) => onUpdateField('customer_phone', e.target.value)}
            disabled={isLinkedCustomer}
            placeholder="08xxxxxxxxxx"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="rev-customer-email">Email</Label>
          <Input
            id="rev-customer-email"
            type="email"
            value={revisionDraft.customer_email}
            onChange={(e) => onUpdateField('customer_email', e.target.value)}
            disabled={isLinkedCustomer}
            placeholder="customer@example.com"
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="rev-customer-address">Alamat</Label>
          <Textarea
            id="rev-customer-address"
            rows={2}
            value={revisionDraft.customer_address}
            onChange={(e) => onUpdateField('customer_address', e.target.value)}
            disabled={isLinkedCustomer}
            placeholder="Alamat penagihan"
          />
        </div>

        <div className="space-y-2 md:col-span-2 pt-2">
          <Label>Titik Lokasi Peta (Opsional)</Label>
          {isLinkedCustomer ? (
            <div className="rounded-md border bg-muted/50 p-4 text-sm text-muted-foreground flex items-center justify-center">
              Peta dinonaktifkan. Customer terhubung — kelola lokasi di halaman customer.
            </div>
          ) : (
            <AddressPicker
              value={{
                lat: revisionDraft.customer_lat ?? null,
                lng: revisionDraft.customer_lng ?? null,
              }}
              onChange={(coords) => {
                onUpdateField('customer_lat', coords.lat)
                onUpdateField('customer_lng', coords.lng)
              }}
            />
          )}
          <p className="text-xs text-muted-foreground mt-1">
            {isLinkedCustomer 
              ? '' 
              : 'Pin lokasi akan digunakan untuk navigasi teknisi. Opsional.'}
          </p>
        </div>
      </div>

      <Separator />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="rev-discount">Diskon (Rp)</Label>
          <Input
            id="rev-discount"
            type="number"
            min="0"
            value={revisionDraft.discount_amount}
            onChange={(e) => onUpdateField('discount_amount', parseFloat(e.target.value) || 0)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="rev-tax">Pajak (%)</Label>
          <Input
            id="rev-tax"
            type="number"
            min="0"
            step="0.01"
            value={revisionDraft.tax_percentage}
            onChange={(e) => onUpdateField('tax_percentage', parseFloat(e.target.value) || 0)}
          />
        </div>
      </div>

      {bankAccounts.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor="rev-payment-account">Rekening Pembayaran</Label>
          <Select
            value={revisionDraft.payment_account_id || '__none__'}
            onValueChange={(value) => onUpdateField('payment_account_id', value === '__none__' ? '' : value)}
          >
            <SelectTrigger id="rev-payment-account">
              <SelectValue placeholder="Pilih rekening" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Tidak ada</SelectItem>
              {bankAccounts.map((acc) => (
                <SelectItem key={acc.id} value={acc.id}>
                  {acc.account_label} — {acc.bank} / {acc.account_number}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Memilih rekening akan otomatis menerapkan pajak default rekening tersebut.
          </p>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="rev-notes">Catatan</Label>
        <Textarea
          id="rev-notes"
          value={revisionDraft.notes}
          onChange={(e) => onUpdateField('notes', e.target.value)}
          placeholder="Catatan tambahan untuk customer"
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="rev-terms">Syarat &amp; Ketentuan</Label>
        <Textarea
          id="rev-terms"
          value={revisionDraft.terms_conditions}
          onChange={(e) => onUpdateField('terms_conditions', e.target.value)}
          placeholder="Syarat dan ketentuan invoice"
          rows={4}
        />
      </div>

      <div className="rounded-md bg-muted/40 p-3 text-sm">
        <div className="flex justify-between">
          <span>Estimasi Subtotal:</span>
          <span className="font-semibold">
            {formatCurrency(
              revisionDraft.items.reduce(
                (sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0),
                0
              )
            )}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Total final akan dihitung ulang server setelah disimpan.
        </p>
      </div>
    </div>
  )
}
