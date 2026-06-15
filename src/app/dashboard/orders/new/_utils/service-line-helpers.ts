/** Pure helper functions for service line management (no React dependency). */

type SelectedAcLine = {
  line_id: string
  unit_instance_id: string
  location_id: string
  ac_unit_id: string
  ac_label: string
  location_label: string
  service_type_id: string
  service_type_code: string
  service_name: string
  estimated_price: number
  manual_price: boolean
  description?: string
  quantity: number
  unit_type_id?: string
  capacity_id?: string
  catalog_id?: string
  msn_code?: string
}

export function findCatalogMatch(
  catalog: Array<Record<string, unknown>>,
  serviceTypeId: string,
  unitTypeId: string,
  capacityId: string,
): Record<string, unknown> | null {
  return (
    catalog.find(
      (c) =>
        c.is_active !== false &&
        c.service_type_id === serviceTypeId &&
        c.unit_type_id === unitTypeId &&
        c.capacity_id === capacityId,
    ) || null
  )
}

export function calcPriceFromCatalog(
  catalog: Array<Record<string, unknown>>,
  serviceTypeId: string,
  unitTypeId: string,
  capacityId: string,
): { price: number; catalogId: string; msnCode: string; found: boolean } {
  if (!serviceTypeId || !unitTypeId || !capacityId) {
    return { price: 0, catalogId: '', msnCode: '', found: false }
  }
  const match = findCatalogMatch(catalog, serviceTypeId, unitTypeId, capacityId)
  if (!match) return { price: 0, catalogId: '', msnCode: '', found: false }
  return {
    price: Number(match.base_price) || 0,
    catalogId: (match.catalog_id as string) || '',
    msnCode: (match.msn_code as string) || '',
    found: true,
  }
}

export function getAvailableServiceTypes(
  serviceCatalog: Array<Record<string, unknown>>,
  serviceTypes: Array<Record<string, unknown>>,
  unitTypeId: string,
  capacityId: string,
): Array<{ id: string; label: string }> {
  if (!unitTypeId || !capacityId) return []

  const availableTypeIds = new Set(
    serviceCatalog
      .filter(
        (c) =>
          c.is_active !== false &&
          c.unit_type_id === unitTypeId &&
          c.capacity_id === capacityId,
      )
      .map((c) => c.service_type_id as string),
  )

  const orderedTypeIds = serviceTypes
    .map((st) => st.service_type_id as string)
    .filter((stId) => availableTypeIds.has(stId))

  const seen = new Set<string>()
  return orderedTypeIds
    .filter((stId) => {
      if (seen.has(stId)) return false
      seen.add(stId)
      return true
    })
    .map((stId) => {
      const st = serviceTypes.find((item) => item.service_type_id === stId)
      return { id: stId, label: String(st?.name || st?.code || stId) }
    })
}

export type { SelectedAcLine }
