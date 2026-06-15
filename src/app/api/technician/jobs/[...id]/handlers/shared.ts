/**
 * Shared types + helpers for the technician job route handlers.
 */

import { logger } from '@/lib/logger'

export type MaybeArray<T> = T | T[] | null | undefined

export type LookupName = { name?: string | null } | null
export type CapacityRange = { capacity_label?: string | null } | null
export type OrderLocation = {
  location_id?: string | null
  customer_id?: string | null
  full_address?: string | null
  house_number?: string | null
  city?: string | null
} | null
export type AcUnitForJob = {
  ac_unit_id?: string | null
  customer_id?: string | null
  location_id?: string | null
  brand?: string | null
  brand_id?: string | null
  model_number?: string | null
  serial_number?: string | null
  installation_date?: string | null
  ac_type?: string | null
  unit_type_id?: string | null
  capacity_id?: string | null
  room_location?: string | null
  floor_level?: string | null
  position_detail?: string | null
  ac_brands?: MaybeArray<LookupName>
  unit_types?: MaybeArray<LookupName>
  capacity_ranges?: MaybeArray<CapacityRange>
  locations?: MaybeArray<OrderLocation>
} | null
export type OrderItemForJob = {
  order_item_id?: string | null
  ac_unit_id?: string | null
  location_id?: string | null
  unit_type_id?: string | null
  capacity_id?: string | null
  brand_id?: string | null
  service_type_id?: string | null
  catalog_id?: string | null
  msn_code?: string | null
  service_type?: string | null
  quantity?: number | null
  description?: string | null
  estimated_price?: number | null
  locations?: MaybeArray<OrderLocation>
  ac_units?: MaybeArray<AcUnitForJob>
  unit_types?: MaybeArray<LookupName>
  capacity_ranges?: MaybeArray<CapacityRange>
  ac_brands?: MaybeArray<LookupName>
  service_catalog?: MaybeArray<{
    catalog_id?: string | null
    msn_code?: string | null
    service_name?: string | null
    base_price?: number | null
    unit_type_id?: string | null
    capacity_id?: string | null
    service_type_id?: string | null
    unit_types?: MaybeArray<LookupName>
    capacity_ranges?: MaybeArray<CapacityRange>
  } | null>
}
export type OrderForJob = {
  customer_id?: string | null
  order_items?: OrderItemForJob[] | null
}

export const log = logger.child('technician-job-route')

export function first<T>(value: MaybeArray<T>): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

export function normalizeJobOrderItems(order: OrderForJob) {
  const orderItems = Array.isArray(order.order_items) ? order.order_items : []

  return orderItems.map((item) => {
    const location = first(item.locations)
    const acUnit = first(item.ac_units)
    const catalog = first(item.service_catalog)

    if (item.ac_unit_id && !acUnit?.ac_unit_id) {
      throw new Error(`AC unit ${item.ac_unit_id} is not accessible for order item ${item.order_item_id}`)
    }

    if (acUnit?.customer_id && order.customer_id && acUnit.customer_id !== order.customer_id) {
      throw new Error(`AC unit ${acUnit.ac_unit_id} belongs to a different customer`)
    }

    if (acUnit?.location_id && item.location_id && acUnit.location_id !== item.location_id) {
      throw new Error(`AC unit ${acUnit.ac_unit_id} belongs to a different location`)
    }

    const acLocation = first(acUnit?.locations)
    const brandName = first(acUnit?.ac_brands)?.name ?? acUnit?.brand ?? null
    const unitTypeName = first(acUnit?.unit_types)?.name ?? acUnit?.ac_type ?? null
    const capacityLabel = first(acUnit?.capacity_ranges)?.capacity_label ?? null

    return {
      ...item,
      ac_unit_id: item.ac_unit_id ?? null,
      locations: location,
      service_catalog: catalog,
      unit_type_name: first(item.unit_types)?.name ?? first(catalog?.unit_types)?.name ?? null,
      capacity_label: first(item.capacity_ranges)?.capacity_label ?? first(catalog?.capacity_ranges)?.capacity_label ?? null,
      brand: first(item.ac_brands)?.name ?? null,
      ac_units: item.ac_unit_id
        ? {
            ...acUnit,
            ac_unit_id: acUnit?.ac_unit_id ?? item.ac_unit_id,
            brand_id: acUnit?.brand_id ?? null,
            brand: brandName,
            unit_type_id: acUnit?.unit_type_id ?? null,
            unit_type_name: unitTypeName,
            ac_type: acUnit?.ac_type ?? unitTypeName,
            capacity_id: acUnit?.capacity_id ?? null,
            capacity_label: capacityLabel,
            capacity_ranges: { capacity_label: capacityLabel },
            location_id: acUnit?.location_id ?? item.location_id ?? null,
            location: acLocation ?? location,
          }
        : null,
    }
  })
}

export function isKnownRpcValidationError(error: { code?: string; message?: string }) {
  return error.code === 'P0001' || error.code === '22P02'
}
