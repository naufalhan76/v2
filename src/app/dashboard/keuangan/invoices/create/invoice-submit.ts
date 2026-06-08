import type { BankAccount } from '@/lib/bank-accounts'

import { getBaseServiceNames, type LineItem } from './line-items'
import type { InvoiceOrder, InvoiceType } from './invoice-reducer'
import type { InvoiceFormData } from './_components/types'

export const resolveInvoiceType = (order: InvoiceOrder): InvoiceType => {
  return order.status === 'COMPLETED' ? 'FINAL' : 'PROFORMA'
}

export const calculateInvoiceTotals = ({
  lineItems,
  discountAmount,
  discountPercentage,
  selectedBankAccount,
}: {
  lineItems: LineItem[]
  discountAmount: string
  discountPercentage: string
  selectedBankAccount?: BankAccount
}) => {
  const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0)
  const discountTotal = parseFloat(discountAmount || '0') + (subtotal * parseFloat(discountPercentage || '0')) / 100
  const taxPercentage = typeof selectedBankAccount?.tax_percentage === 'number' ? selectedBankAccount.tax_percentage : 11
  const taxAmount = ((subtotal - discountTotal) * taxPercentage) / 100
  return {
    subtotal,
    discountAmount: discountTotal,
    taxAmount,
    taxPercentage,
    total: subtotal - discountTotal + taxAmount,
  }
}

export const buildCreateInvoicePayload = ({
  data,
  selectedOrder,
  lineItems,
  baseService,
  selectedBankAccount,
}: {
  data: InvoiceFormData
  selectedOrder: InvoiceOrder
  lineItems: LineItem[]
  baseService: unknown
  selectedBankAccount: BankAccount
}) => {
  const invoiceItems = lineItems.map((item) => ({
    item_type: item.type,
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    service_type: item.type === 'BASE_SERVICE' ? undefined : undefined,
    addon_id: item.addonId,
  }))

  const baseServiceTotal = lineItems
    .filter((item) => item.type === 'BASE_SERVICE')
    .reduce((sum, item) => sum + item.total, 0)
  const baseServiceNames = getBaseServiceNames(lineItems)
  const serviceName = baseServiceNames.length > 1
    ? 'Multiple Services'
    : ((baseService as Record<string, unknown>)?.service_name as string || baseServiceNames[0] || 'Service')
  const invoiceType = resolveInvoiceType(selectedOrder)

  return {
    payload: {
      order_id: data.orderId,
      customer_id: selectedOrder.customer_id,
      invoice_type: invoiceType,
      due_date: data.dueDate,
      service_type: selectedOrder.order_type,
      service_name: serviceName,
      base_service_price: baseServiceTotal,
      items: invoiceItems,
      discount_amount: parseFloat(data.discountAmount || '0'),
      discount_percentage: parseFloat(data.discountPercentage || '0'),
      notes: data.notes,
      payment_account_id: selectedBankAccount.id,
      payment_account_label: selectedBankAccount.account_label,
      payment_bank_name: selectedBankAccount.bank,
      payment_account_number: selectedBankAccount.account_number,
      payment_account_name: selectedBankAccount.account_name,
      tax_percentage: selectedBankAccount.tax_percentage,
    },
    invoiceType,
  }
}
