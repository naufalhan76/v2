import { describe, expect, it } from 'vitest'
import {
  EXISTING_AC_COMPLETE,
  EXISTING_AC_INCOMPLETE,
  MIXED_AC_ORDER,
  NEW_AC_SLOT,
  classifyAcCompletionOrderItem,
} from './ac-completion-contract.fixtures'

describe('technician AC completion contract fixtures', () => {
  it('classifies existing AC only by a non-null order_items.ac_unit_id', () => {
    expect(classifyAcCompletionOrderItem(EXISTING_AC_COMPLETE)).toBe('existing-complete')
    expect(classifyAcCompletionOrderItem(EXISTING_AC_INCOMPLETE)).toBe('existing-incomplete')
  })

  it('classifies new AC slots only by null order_items.ac_unit_id', () => {
    expect(classifyAcCompletionOrderItem(NEW_AC_SLOT)).toBe('new-slot')
  })

  it('keeps mixed orders deterministic regardless of labels or item indexes', () => {
    const kinds = MIXED_AC_ORDER.order_items.map((item) => classifyAcCompletionOrderItem(item))

    expect(kinds).toEqual(['existing-complete', 'new-slot', 'existing-incomplete'])
    expect(MIXED_AC_ORDER.order_items.map((item) => item.label)).toEqual([
      'AC Baru 1',
      'Existing AC - Bedroom',
      'AC Baru 2',
    ])
    expect(MIXED_AC_ORDER.order_items.map((item) => item.index)).toEqual([3, 1, 0])
  })

  it('does not use new_ac_data or brand text as the existing/new source of truth', () => {
    const nullIdWithNewAcBrand = {
      ...NEW_AC_SLOT,
      ac_unit_id: null,
      brand: 'Looks Existing From Brand Text',
      new_ac_data: { brand: 'Strong New AC Brand Signal', model_number: 'CS-XU10', capacity_btu: 9000 },
    }

    const existingIdWithMissingBrandText = {
      ...EXISTING_AC_INCOMPLETE,
      ac_unit_id: 'ac-unit-brand-missing',
      brand: null,
      ac_units: { ...EXISTING_AC_INCOMPLETE.ac_units, brand: null },
      new_ac_data: { brand: 'Misleading New Data', model_number: 'IGNORE-ME', capacity_btu: null },
    }

    expect(classifyAcCompletionOrderItem(nullIdWithNewAcBrand)).toBe('new-slot')
    expect(classifyAcCompletionOrderItem(existingIdWithMissingBrandText)).toBe('existing-incomplete')
  })
})
