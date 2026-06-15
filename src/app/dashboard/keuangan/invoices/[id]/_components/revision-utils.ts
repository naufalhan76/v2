import type { Invoice, InvoiceItem, ReviseInvoiceItemInput } from '@/types/invoices'
import type { BankAccount } from '@/lib/bank-accounts'

export type RevisionItemDraft = {
  item_id?: string
  item_type: 'BASE_SERVICE' | 'ADDON'
  description: string
  quantity: number
  unit_price: number
  line_order: number
}

export type RevisionDraft = {
  customer_name: string
  customer_phone: string
  customer_email: string
  customer_address: string
  due_date: string
  notes: string
  terms_conditions: string
  discount_amount: number
  tax_percentage: number
  payment_account_id: string
  items: RevisionItemDraft[]
}

export function buildRevisionDraft(invoice: Invoice, items: InvoiceItem[]): RevisionDraft {
  return {
    customer_name: invoice.customer_name_override ?? invoice.customers?.customer_name ?? '',
    customer_phone: invoice.customer_phone_override ?? invoice.customers?.phone_number ?? '',
    customer_email: invoice.customer_email_override ?? invoice.customers?.email ?? '',
    customer_address: invoice.customer_address_override ?? invoice.customers?.billing_address ?? '',
    due_date: invoice.due_date ? invoice.due_date.slice(0, 10) : '',
    notes: invoice.notes ?? '',
    terms_conditions: invoice.terms_conditions ?? '',
    discount_amount: invoice.discount_amount ?? 0,
    tax_percentage: invoice.tax_percentage ?? 0,
    payment_account_id: (invoice as Invoice & { payment_account_id?: string | null }).payment_account_id ?? '',
    items: items.map((it, idx) => ({
      item_id: it.item_id,
      item_type: (it.item_type === 'ADDON' ? 'ADDON' : 'BASE_SERVICE') as 'BASE_SERVICE' | 'ADDON',
      description: it.description,
      quantity: it.quantity,
      unit_price: it.unit_price,
      line_order: it.line_order ?? idx,
    })),
  }
}

export function validateRevisionDraft(draft: RevisionDraft): string | null {
  if (draft.items.length === 0) return 'Minimal satu item invoice harus diisi'
  for (const item of draft.items) {
    if (!item.description.trim()) return 'Setiap item harus memiliki deskripsi'
    if (!(item.quantity > 0)) return 'Kuantitas item harus lebih dari 0'
    if (item.unit_price < 0) return 'Harga satuan tidak boleh negatif'
  }
  return null
}

export function buildRevisionPayload(
  draft: RevisionDraft,
  bankAccounts: BankAccount[],
  isLinkedCustomer: boolean,
): [Record<string, unknown>, ReviseInvoiceItemInput[]] {
  const headerUpdates: Record<string, unknown> = {
    due_date: draft.due_date,
    notes: draft.notes || null,
    terms_conditions: draft.terms_conditions || null,
    discount_amount: Number(draft.discount_amount) || 0,
    tax_percentage: Number(draft.tax_percentage) || 0,
  }
  if (!isLinkedCustomer) {
    headerUpdates.customer_name_override = draft.customer_name.trim() || null
    headerUpdates.customer_phone_override = draft.customer_phone.trim() || null
    headerUpdates.customer_email_override = draft.customer_email.trim() || null
    headerUpdates.customer_address_override = draft.customer_address.trim() || null
  }
  if (draft.payment_account_id) {
    const selected = bankAccounts.find((acc) => acc.id === draft.payment_account_id)
    if (selected) {
      Object.assign(headerUpdates, {
        payment_account_id: selected.id, payment_account_label: selected.account_label,
        payment_bank_name: selected.bank, payment_account_number: selected.account_number,
        payment_account_name: selected.account_name,
      })
      if (typeof selected.tax_percentage === 'number') headerUpdates.tax_percentage = selected.tax_percentage
    }
  } else {
    Object.assign(headerUpdates, {
      payment_account_id: null, payment_account_label: null, payment_bank_name: null,
      payment_account_number: null, payment_account_name: null,
    })
  }
  const itemsPayload: ReviseInvoiceItemInput[] = draft.items.map((it, idx) => ({
    item_id: it.item_id, item_type: it.item_type,
    description: it.description.trim(), quantity: Number(it.quantity),
    unit_price: Number(it.unit_price), line_order: idx,
  }))
  return [headerUpdates, itemsPayload]
}
