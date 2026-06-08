'use client'

import { useMemo, useReducer } from 'react'

import {
  createInitialInvoiceState,
  invoiceReducer,
  SELECTED_ADDON_KEY,
  type InvoiceOrder,
  type InvoiceType,
} from './invoice-reducer'
import type { LineItem } from './line-items'

export const useInvoiceForm = () => {
  const [state, dispatch] = useReducer(invoiceReducer, undefined, createInitialInvoiceState)

  const actions = useMemo(
    () => ({
      selectOrder: (order: InvoiceOrder) => dispatch({ type: 'SELECT_ORDER', order }),
      prefillFromOrder: (order: InvoiceOrder | null, requestedInvoiceType: InvoiceType | null, message: string | null) =>
        dispatch({ type: 'PREFILL_FROM_ORDER', order, requestedInvoiceType, message }),
      setBaseService: (baseService: unknown) => dispatch({ type: 'SET_BASE_SERVICE', baseService }),
      setLineItems: (items: LineItem[]) => dispatch({ type: 'SET_LINE_ITEMS', items }),
      addLineItem: (item: LineItem, resetSelectedAddon = false) =>
        dispatch({ type: 'ADD_LINE_ITEM', item, resetSelectedAddon }),
      updateLineItem: (index: number, changes: Partial<Pick<LineItem, 'quantity' | 'unitPrice'>>) =>
        dispatch({ type: 'UPDATE_LINE_ITEM', index, changes }),
      removeLineItem: (index: number) => dispatch({ type: 'REMOVE_LINE_ITEM', index }),
      setSelectedAddon: (addonType: string) =>
        dispatch({ type: 'SET_ADDON_TYPE', addonId: SELECTED_ADDON_KEY, addonType }),
      setSelectedAddonQuantity: (quantity: number) =>
        dispatch({ type: 'SET_ADDON_QTY', addonId: SELECTED_ADDON_KEY, quantity }),
      nextStep: () => dispatch({ type: 'NEXT_STEP' }),
      prevStep: () => dispatch({ type: 'PREV_STEP' }),
      reset: () => dispatch({ type: 'RESET' }),
    }),
    []
  )

  return {
    state,
    actions,
    selectedAddon: state.addonTypes[SELECTED_ADDON_KEY] ?? '',
    addonQuantity: state.addonQuantities[SELECTED_ADDON_KEY] ?? 1,
  }
}
