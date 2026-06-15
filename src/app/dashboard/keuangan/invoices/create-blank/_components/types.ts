import type { FieldErrors, UseFormRegister, UseFormSetValue, UseFormWatch } from 'react-hook-form'
import type { CreateBlankInvoiceInput } from '@/app/api/schemas'
import type { BankAccount } from '@/lib/bank-accounts'
import type { Invoice } from '@/types/invoices'

export interface CustomerOption {
  customer_id: string
  customer_name: string
  phone_number?: string | null
  email?: string | null
  billing_address?: string | null
}

export interface InvoiceTotals {
  subtotal: number
  totalDiscount: number
  taxPercentage: number
  taxAmount: number
  total: number
}

export interface CustomerSelectorProps {
  customers: CustomerOption[]
  watchedCustomerId: string | undefined
  errors: FieldErrors<CreateBlankInvoiceInput>
  register: UseFormRegister<CreateBlankInvoiceInput>
  setValue: UseFormSetValue<CreateBlankInvoiceInput>
}

export interface LineItemsEditorProps {
  fields: { id: string }[]
  watchedItems: CreateBlankInvoiceInput['items']
  errors: FieldErrors<CreateBlankInvoiceInput>
  register: UseFormRegister<CreateBlankInvoiceInput>
  setValue: UseFormSetValue<CreateBlankInvoiceInput>
  watch: UseFormWatch<CreateBlankInvoiceInput>
  append: (item: { item_type: 'BASE_SERVICE'; description: string; quantity: number; unit_price: number }) => void
  remove: (index: number) => void
  formatCurrency: (amount: number) => string
}

export interface BlankInvoiceFormProps {
  watchedPaymentAccountId: string | undefined
  bankAccounts: BankAccount[]
  totals: InvoiceTotals
  register: UseFormRegister<CreateBlankInvoiceInput>
  setValue: UseFormSetValue<CreateBlankInvoiceInput>
  formatCurrency: (amount: number) => string
}

export interface InvoicePreviewProps {
  createdInvoice: Invoice | null
  onOpenChange: (open: boolean) => void
  onStay: () => void
  onViewDetail: (invoiceId: string) => void
  formatCurrency: (amount: number) => string
}
