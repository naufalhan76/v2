import type { FieldErrors, UseFormRegister, UseFormSetValue } from 'react-hook-form'

import type { Addon } from '@/lib/actions/addons'
import type { BankAccount } from '@/lib/bank-accounts'
import type { LineItem } from '../line-items'
import type { InvoiceOrder, InvoiceType } from '../invoice-reducer'

export interface InvoiceFormData {
  orderId: string
  paymentAccountId: string
  dueDate: string
  discountAmount?: string
  discountPercentage?: string
  notes?: string
}

export interface InvoiceTotals {
  subtotal: number
  discountAmount: number
  taxAmount: number
  taxPercentage: number
  total: number
}

export interface StepNavigationProps {
  onNext: () => void
  onPrevious: () => void
}

export interface OrderSelectionStepProps {
  orders: InvoiceOrder[]
  selectedOrder: InvoiceOrder | null
  requestedInvoiceType: InvoiceType | null
  prefillMessage: string | null
  orderId: string
  orderError?: string
  onOrderSelect: (orderId: string) => void
  onNext: () => void
}

export interface BaseServiceStepProps extends StepNavigationProps {
  baseService: unknown
  lineItems: LineItem[]
  onUpdateQuantity: (index: number, quantity: number) => void
  onUpdatePrice: (index: number, price: number) => void
}

export interface AddOnsStepProps extends StepNavigationProps {
  addons: Addon[]
  selectedAddon: string
  addonQuantity: number
  lineItems: LineItem[]
  onSelectedAddonChange: (addonId: string) => void
  onAddonQuantityChange: (quantity: number) => void
  onAddAddon: () => void
  onRemoveItem: (index: number) => void
}

export interface LineItemEditorProps {
  lineItems: LineItem[]
  onRemoveItem: (index: number) => void
}

export interface ReviewSubmitStepProps {
  bankAccounts: BankAccount[]
  paymentAccountId: string
  totals: InvoiceTotals
  errors: FieldErrors<InvoiceFormData>
  register: UseFormRegister<InvoiceFormData>
  setValue: UseFormSetValue<InvoiceFormData>
  isLoading: boolean
  onPrevious: () => void
}
