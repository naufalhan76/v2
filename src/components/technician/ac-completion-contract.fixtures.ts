export type AcCompletionOrderItemFixture = {
  order_item_id: string
  label: string
  index: number
  ac_unit_id: string | null
  brand?: string | null
  ac_units?: {
    brand?: string | null
    brand_id?: string | null
    ac_type?: string | null
    unit_type_id?: string | null
    capacity_id?: string | null
    capacity_ranges?: { capacity_label?: string | null } | null
    room_location?: string | null
    model_number?: string | null
    serial_number?: string | null
  } | null
  new_ac_data?: {
    brand?: string | null
    model_number?: string | null
    capacity_btu?: number | null
  } | null
}

export type AcCompletionContractKind = 'existing-complete' | 'existing-incomplete' | 'new-slot'

export const EXISTING_AC_COMPLETE: AcCompletionOrderItemFixture = {
  order_item_id: 'order-item-existing-complete',
  label: 'AC Baru 1',
  index: 3,
  ac_unit_id: 'ac-unit-existing-complete',
  brand: 'Should Not Be Source Of Truth',
  new_ac_data: {
    brand: 'Wrong New AC Brand',
    model_number: 'WRONG-NEW-MODEL',
    capacity_btu: 9000,
  },
  ac_units: {
    brand: 'Daikin',
    brand_id: 'brand-daikin',
    ac_type: 'Split Wall',
    unit_type_id: 'unit-type-split-wall',
    capacity_id: 'capacity-1pk',
    capacity_ranges: { capacity_label: '1 PK' },
    room_location: 'Ruang Tamu',
    model_number: 'FTKQ25',
    serial_number: 'SN-EXISTING-COMPLETE',
  },
}

export const EXISTING_AC_INCOMPLETE: AcCompletionOrderItemFixture = {
  order_item_id: 'order-item-existing-incomplete',
  label: 'AC Baru 2',
  index: 0,
  ac_unit_id: 'ac-unit-existing-incomplete',
  brand: null,
  new_ac_data: null,
  ac_units: {
    brand: null,
    brand_id: null,
    ac_type: null,
    unit_type_id: null,
    capacity_id: null,
    capacity_ranges: null,
    room_location: 'Kamar Utama',
    model_number: null,
    serial_number: 'SN-EXISTING-INCOMPLETE',
  },
}

export const NEW_AC_SLOT: AcCompletionOrderItemFixture = {
  order_item_id: 'order-item-new-slot',
  label: 'Existing AC - Bedroom',
  index: 1,
  ac_unit_id: null,
  brand: 'Misleading Brand Text',
  new_ac_data: {
    brand: 'Panasonic',
    model_number: 'Technician Will Confirm',
    capacity_btu: null,
  },
  ac_units: {
    brand: 'Misleading Joined Brand',
    brand_id: 'misleading-brand-id',
    unit_type_id: 'misleading-unit-type-id',
    capacity_id: 'misleading-capacity-id',
  },
}

export const MIXED_AC_ORDER = {
  order_id: 'order-mixed-ac-contract',
  order_items: [EXISTING_AC_COMPLETE, NEW_AC_SLOT, EXISTING_AC_INCOMPLETE],
}

export function classifyAcCompletionOrderItem(
  item: Pick<AcCompletionOrderItemFixture, 'ac_unit_id' | 'ac_units'>
): AcCompletionContractKind {
  if (!item.ac_unit_id) return 'new-slot'

  const identity = item.ac_units
  const hasCompleteIdentity = Boolean(
    identity?.brand_id && identity.unit_type_id && identity.capacity_id && identity.room_location
  )

  return hasCompleteIdentity ? 'existing-complete' : 'existing-incomplete'
}
