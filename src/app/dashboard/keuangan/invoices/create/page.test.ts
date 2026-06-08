import { describe, expect, it } from 'vitest'
import {
  getBaseServiceItems,
  getBaseServiceNames,
  type LineItem,
} from './line-items'

describe('invoice create line-item filtering and mapping', () => {
  it('keeps active base service items in original order with original indexes', () => {
    const lineItems: LineItem[] = [
      {
        type: 'BASE_SERVICE',
        description: '[MSN-001] AC Cleaning (Cassette 2PK)',
        quantity: 1,
        unitPrice: 150_000,
        total: 150_000,
      },
      {
        type: 'ADDON',
        description: 'Freon R32',
        quantity: 2,
        unitPrice: 75_000,
        total: 150_000,
        addonId: 'addon-1',
      },
      {
        type: 'BASE_SERVICE',
        description: '[MSN-002] AC Repair (Wall 1PK)',
        quantity: 3,
        unitPrice: 200_000,
        total: 600_000,
      },
    ]

    expect(getBaseServiceItems(lineItems)).toEqual([
      { item: lineItems[0], index: 0 },
      { item: lineItems[2], index: 2 },
    ])
  })

  it('excludes inactive addon items and empty input exactly as current behavior', () => {
    const addonOnlyItems: LineItem[] = [
      {
        type: 'ADDON',
        description: 'Bracket Outdoor',
        quantity: 1,
        unitPrice: 50_000,
        total: 50_000,
        addonId: 'addon-2',
      },
    ]

    expect(getBaseServiceItems(addonOnlyItems)).toEqual([])
    expect(getBaseServiceItems([])).toEqual([])
    expect(getBaseServiceNames(addonOnlyItems)).toEqual([])
    expect(getBaseServiceNames([])).toEqual([])
  })

  it('maps active base service descriptions to service names before quantity suffix', () => {
    const lineItems: LineItem[] = [
      {
        type: 'BASE_SERVICE',
        description: 'AC Cleaning (2 unit)',
        quantity: 2,
        unitPrice: 120_000,
        total: 240_000,
      },
      {
        type: 'ADDON',
        description: 'Pipa Drain',
        quantity: 1,
        unitPrice: 30_000,
        total: 30_000,
        addonId: 'addon-3',
      },
      {
        type: 'BASE_SERVICE',
        description: 'AC Deep Cleaning',
        quantity: 1,
        unitPrice: 180_000,
        total: 180_000,
      },
    ]

    expect(getBaseServiceNames(lineItems)).toEqual([
      'AC Cleaning',
      'AC Deep Cleaning',
    ])
  })
})
