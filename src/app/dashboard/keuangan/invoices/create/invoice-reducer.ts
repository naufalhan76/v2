import type { LineItem } from './line-items'
import type { InvoiceOrder, InvoiceType } from '@/types/invoices'

export type { InvoiceOrder, InvoiceType }

export interface InvoicePrefillDefaults {
  requestedInvoiceType: InvoiceType | null
  message: string | null
}

export interface InvoiceState {
  step: number
  selectedOrder: InvoiceOrder | null
  baseService: unknown
  lineItems: LineItem[]
  addonQuantities: Record<string, number>
  addonTypes: Record<string, string>
  prefillDefaults: InvoicePrefillDefaults
}

export type InvoiceAction =
  | { type: 'SELECT_ORDER'; order: InvoiceOrder }
  | {
      type: 'PREFILL_FROM_ORDER'
      order: InvoiceOrder | null
      requestedInvoiceType?: InvoiceType | null
      message: string | null
    }
  | { type: 'SET_BASE_SERVICE'; baseService: unknown }
  | { type: 'SET_LINE_ITEMS'; items: LineItem[] }
  | { type: 'ADD_LINE_ITEM'; item: LineItem; resetSelectedAddon?: boolean }
  | { type: 'UPDATE_LINE_ITEM'; index: number; changes: Partial<Pick<LineItem, 'quantity' | 'unitPrice'>> }
  | { type: 'REMOVE_LINE_ITEM'; index: number }
  | { type: 'SET_ADDON_QTY'; addonId: string; quantity: number }
  | { type: 'SET_ADDON_TYPE'; addonId: string; addonType: string }
  | { type: 'NEXT_STEP' }
  | { type: 'PREV_STEP' }
  | { type: 'RESET' }

export const SELECTED_ADDON_KEY = 'selected'

export const createInitialInvoiceState = (): InvoiceState => ({
  step: 1,
  selectedOrder: null,
  baseService: null,
  lineItems: [],
  addonQuantities: { [SELECTED_ADDON_KEY]: 1 },
  addonTypes: { [SELECTED_ADDON_KEY]: '' },
  prefillDefaults: {
    requestedInvoiceType: null,
    message: null,
  },
})

const recalculateTotal = (item: LineItem): LineItem => ({
  ...item,
  total: item.quantity * item.unitPrice,
})

export const invoiceReducer = (state: InvoiceState, action: InvoiceAction): InvoiceState => {
  switch (action.type) {
    case 'SELECT_ORDER':
      return {
        ...state,
        selectedOrder: action.order,
        prefillDefaults: { ...state.prefillDefaults, message: null },
      }

    case 'PREFILL_FROM_ORDER':
      return {
        ...state,
        selectedOrder: action.order,
        prefillDefaults: {
          requestedInvoiceType: action.requestedInvoiceType ?? state.prefillDefaults.requestedInvoiceType,
          message: action.message,
        },
      }

    case 'SET_BASE_SERVICE':
      return { ...state, baseService: action.baseService }

    case 'SET_LINE_ITEMS':
      return { ...state, lineItems: action.items }

    case 'ADD_LINE_ITEM':
      return {
        ...state,
        lineItems: [...state.lineItems, action.item],
        addonQuantities: action.resetSelectedAddon
          ? { ...state.addonQuantities, [SELECTED_ADDON_KEY]: 1 }
          : state.addonQuantities,
        addonTypes: action.resetSelectedAddon
          ? { ...state.addonTypes, [SELECTED_ADDON_KEY]: '' }
          : state.addonTypes,
      }

    case 'UPDATE_LINE_ITEM':
      return {
        ...state,
        lineItems: state.lineItems.map((item, index) =>
          index === action.index ? recalculateTotal({ ...item, ...action.changes }) : item
        ),
      }

    case 'REMOVE_LINE_ITEM':
      return {
        ...state,
        lineItems: state.lineItems.filter((_, index) => index !== action.index),
      }

    case 'SET_ADDON_QTY':
      return {
        ...state,
        addonQuantities: { ...state.addonQuantities, [action.addonId]: action.quantity },
      }

    case 'SET_ADDON_TYPE':
      return {
        ...state,
        addonTypes: { ...state.addonTypes, [action.addonId]: action.addonType },
      }

    case 'NEXT_STEP':
      return { ...state, step: Math.min(4, state.step + 1) }

    case 'PREV_STEP':
      return { ...state, step: Math.max(1, state.step - 1) }

    case 'RESET':
      return createInitialInvoiceState()
  }
}
