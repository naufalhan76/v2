import { describe, expect, it } from 'vitest'

import {
  createInitialInvoiceState,
  invoiceReducer,
  type InvoiceOrder,
  type InvoiceState,
} from './invoice-reducer'
import type { LineItem } from './line-items'

const order: InvoiceOrder = {
  order_id: 'ORD-001',
  customer_id: 'CUS-001',
  status: 'COMPLETED',
  order_type: 'AC_CLEANING',
  customers: { customer_name: 'Budi Santoso', phone_number: '081234567890' },
}

const baseLine: LineItem = {
  type: 'BASE_SERVICE',
  description: 'AC Cleaning',
  quantity: 1,
  unitPrice: 150_000,
  total: 150_000,
}

const addonLine: LineItem = {
  type: 'ADDON',
  description: 'Freon R32',
  quantity: 2,
  unitPrice: 75_000,
  total: 150_000,
  addonId: 'ADD-FREON',
}

const stateWithItems = (): InvoiceState => ({
  ...createInitialInvoiceState(),
  lineItems: [baseLine, addonLine],
})

describe('invoiceReducer', () => {
  it('initializes with defaults', () => {
    expect(createInitialInvoiceState()).toEqual({
      step: 1,
      selectedOrder: null,
      baseService: null,
      lineItems: [],
      addonQuantities: { selected: 1 },
      addonTypes: { selected: '' },
      prefillDefaults: {
        requestedInvoiceType: null,
        message: null,
      },
    })
  })

  it('SELECT_ORDER sets selectedOrder and clears prefill message by default', () => {
    const previous = {
      ...createInitialInvoiceState(),
      prefillDefaults: { requestedInvoiceType: 'FINAL' as const, message: 'Prefilled' },
    }

    const next = invoiceReducer(previous, { type: 'SELECT_ORDER', order })

    expect(next.selectedOrder).toBe(order)
    expect(next.prefillDefaults).toEqual({ requestedInvoiceType: 'FINAL', message: null })
    expect(previous.prefillDefaults.message).toBe('Prefilled')
  })

  it('PREFILL_FROM_ORDER sets order, requested invoice type, and message', () => {
    const next = invoiceReducer(createInitialInvoiceState(), {
      type: 'PREFILL_FROM_ORDER',
      order,
      requestedInvoiceType: 'PROFORMA',
      message: 'Order and invoice type were prefilled from the create-order flow.',
    })

    expect(next.selectedOrder).toBe(order)
    expect(next.prefillDefaults).toEqual({
      requestedInvoiceType: 'PROFORMA',
      message: 'Order and invoice type were prefilled from the create-order flow.',
    })
  })

  it('ADD_LINE_ITEM appends to lineItems array', () => {
    const previous = { ...createInitialInvoiceState(), lineItems: [baseLine] }
    const next = invoiceReducer(previous, { type: 'ADD_LINE_ITEM', item: addonLine })

    expect(next.lineItems).toEqual([baseLine, addonLine])
    expect(next.lineItems).not.toBe(previous.lineItems)
    expect(previous.lineItems).toEqual([baseLine])
  })

  it('UPDATE_LINE_ITEM updates quantity and price fields with recalculated total', () => {
    const previous = stateWithItems()
    const next = invoiceReducer(previous, {
      type: 'UPDATE_LINE_ITEM',
      index: 0,
      changes: { quantity: 3, unitPrice: 175_000 },
    })

    expect(next.lineItems[0]).toEqual({ ...baseLine, quantity: 3, unitPrice: 175_000, total: 525_000 })
    expect(next.lineItems[0]).not.toBe(previous.lineItems[0])
    expect(previous.lineItems[0]).toEqual(baseLine)
  })

  it('REMOVE_LINE_ITEM removes by index', () => {
    const previous = stateWithItems()
    const next = invoiceReducer(previous, { type: 'REMOVE_LINE_ITEM', index: 1 })

    expect(next.lineItems).toEqual([baseLine])
    expect(previous.lineItems).toEqual([baseLine, addonLine])
  })

  it('SET_ADDON_QTY and SET_ADDON_TYPE update addon state', () => {
    const withQty = invoiceReducer(createInitialInvoiceState(), { type: 'SET_ADDON_QTY', addonId: 'selected', quantity: 3 })
    const withType = invoiceReducer(withQty, { type: 'SET_ADDON_TYPE', addonId: 'selected', addonType: 'ADD-FREON' })

    expect(withType.addonQuantities.selected).toBe(3)
    expect(withType.addonTypes.selected).toBe('ADD-FREON')
    expect(withQty.addonQuantities).not.toBe(createInitialInvoiceState().addonQuantities)
    expect(withType.addonTypes).not.toBe(withQty.addonTypes)
  })

  it('NEXT_STEP and PREV_STEP transition step within wizard bounds', () => {
    const step2 = invoiceReducer(createInitialInvoiceState(), { type: 'NEXT_STEP' })
    const step4 = invoiceReducer({ ...step2, step: 4 }, { type: 'NEXT_STEP' })
    const step3 = invoiceReducer(step4, { type: 'PREV_STEP' })
    const step1 = invoiceReducer({ ...step3, step: 1 }, { type: 'PREV_STEP' })

    expect(step2.step).toBe(2)
    expect(step4.step).toBe(4)
    expect(step3.step).toBe(3)
    expect(step1.step).toBe(1)
  })

  it('RESET returns to initial state', () => {
    const next = invoiceReducer({ ...stateWithItems(), selectedOrder: order, step: 4 }, { type: 'RESET' })

    expect(next).toEqual(createInitialInvoiceState())
  })
})
