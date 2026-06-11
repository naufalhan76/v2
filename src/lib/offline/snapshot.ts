import { getDb, type LocalJobSnapshot } from './db'

export type { LocalJobSnapshot } from './db'

type ApiJob = {
  order_id?: string | null
  status?: string | null
  canonical_status?: string | null
  scheduled_visit_date?: string | null
  customers?: {
    customer_name?: string | null
  } | null
  order_items?: Array<{
    order_item_id?: string | null
    ac_unit_id?: string | null
    service_type?: string | null
    locations?: {
      full_address?: string | null
      city?: string | null
    } | null
    ac_units?: {
      ac_unit_id?: string | null
      brand?: string | null
      brand_id?: string | null
      model_number?: string | null
      serial_number?: string | null
      installation_date?: string | null
      ac_type?: string | null
      unit_type_id?: string | null
      capacity_id?: string | null
      capacity_label?: string | null
      capacity_ranges?:
        | { capacity_label?: string | null }
        | Array<{ capacity_label?: string | null }>
        | null
      room_location?: string | null
      floor_level?: string | null
      position_detail?: string | null
    } | null
  }> | null
  order_technicians?: Array<{
    technician_id?: string | null
    role?: string | null
  }> | null
}

function readCapacityLabel(acUnit: NonNullable<NonNullable<ApiJob['order_items']>[number]['ac_units']>) {
  if (acUnit.capacity_label) return acUnit.capacity_label
  const ranges = acUnit.capacity_ranges
  if (Array.isArray(ranges)) return ranges[0]?.capacity_label ?? null
  return ranges?.capacity_label ?? null
}

export function jobToSnapshot(job: ApiJob): LocalJobSnapshot | null {
  if (!job.order_id) return null

  const firstLocation = job.order_items?.find((item) => item.locations)?.locations ?? null
  const address = firstLocation
    ? [firstLocation.full_address, firstLocation.city].filter(Boolean).join(', ')
    : null
  const leadTech = job.order_technicians?.find((tech) => tech.role === 'lead')

  return {
    orderId: job.order_id,
    status: job.canonical_status ?? job.status ?? '',
    customer: {
      name: job.customers?.customer_name ?? null,
      address,
    },
    scheduledDate: job.scheduled_visit_date ?? null,
    orderItems: (job.order_items ?? []).map((item, idx) => {
      const acUnit = item.ac_units ?? null
      return {
        id: item.order_item_id ?? `${job.order_id}:${idx}`,
        serviceType: item.service_type ?? null,
        acUnitId: item.ac_unit_id ?? null,
        acUnit: acUnit
          ? {
              id: acUnit.ac_unit_id ?? item.ac_unit_id ?? null,
              brand: acUnit.brand ?? null,
              brandId: acUnit.brand_id ?? null,
              modelNumber: acUnit.model_number ?? null,
              serialNumber: acUnit.serial_number ?? null,
              installationDate: acUnit.installation_date ?? null,
              acType: acUnit.ac_type ?? null,
              unitTypeId: acUnit.unit_type_id ?? null,
              capacityId: acUnit.capacity_id ?? null,
              capacityLabel: readCapacityLabel(acUnit),
              roomLocation: acUnit.room_location ?? null,
              floorLevel: acUnit.floor_level ?? null,
              positionDetail: acUnit.position_detail ?? null,
            }
          : null,
      }
    }),
    technicianId: leadTech?.technician_id ?? null,
    syncedAt: Date.now(),
    locked: false,
  }
}

export async function saveJobSnapshot(snapshot: LocalJobSnapshot): Promise<void> {
  const db = await getDb()
  const existing = await db.get('jobSnapshots', snapshot.orderId)
  await db.put('jobSnapshots', {
    ...snapshot,
    locked: existing?.locked ?? snapshot.locked,
  })
}

export async function getJobSnapshot(orderId: string): Promise<LocalJobSnapshot | undefined> {
  const db = await getDb()
  return db.get('jobSnapshots', orderId)
}

export async function lockJobSnapshot(orderId: string): Promise<LocalJobSnapshot | undefined> {
  const db = await getDb()
  const tx = db.transaction('jobSnapshots', 'readwrite')
  const existing = await tx.store.get(orderId)
  if (!existing) {
    await tx.done
    return undefined
  }
  const locked = { ...existing, locked: true }
  await tx.store.put(locked)
  await tx.done
  return locked
}
