import { describe, expect, it } from 'vitest'

import { buildRevisionPayload, type RevisionDraft } from './revision-utils'

const BASE_DRAFT: RevisionDraft = {
  customer_name: 'Budi',
  customer_phone: '08123',
  customer_email: 'budi@example.com',
  customer_address: 'Jl. Sudirman No. 1',
  customer_lat: -6.2,
  customer_lng: 106.8,
  due_date: '2026-07-15',
  notes: '',
  terms_conditions: '',
  discount_amount: 0,
  tax_percentage: 11,
  payment_account_id: '',
  items: [{ item_type: 'BASE_SERVICE', description: 'Service AC', quantity: 1, unit_price: 250000, line_order: 0 }],
}

describe('buildRevisionPayload coordinate mapping', () => {
  it('maps draft customer_lat/customer_lng to DB override fields for manual invoices', () => {
    const [headerUpdates] = buildRevisionPayload(BASE_DRAFT, [], false)

    expect(headerUpdates).toMatchObject({ customer_lat_override: -6.2, customer_lng_override: 106.8 })
  })

  it('maps omitted draft coordinates to null override fields for manual invoices', () => {
    const { customer_lat: _lat, customer_lng: _lng, ...draft } = BASE_DRAFT
    const [headerUpdates] = buildRevisionPayload(draft, [], false)

    expect(headerUpdates).toMatchObject({ customer_lat_override: null, customer_lng_override: null })
  })

  it('does not write coordinate overrides for linked customer revisions', () => {
    const [headerUpdates] = buildRevisionPayload(BASE_DRAFT, [], true)

    expect(headerUpdates).not.toHaveProperty('customer_lat_override')
    expect(headerUpdates).not.toHaveProperty('customer_lng_override')
  })
})
