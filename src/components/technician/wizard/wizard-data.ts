import type { AcUnitReportItem } from '@/app/api/schemas/technician'
import type { LocalJobSnapshot } from '@/lib/offline/snapshot'
import type { JobContext, JobSummary } from './wizard-types'

function selectString(value: string | null | undefined): string {
  return value ?? ''
}

export function extractAcUnits(jobContext: JobContext): AcUnitReportItem[] {
  const units: AcUnitReportItem[] = []
  if (!jobContext.order_items || !Array.isArray(jobContext.order_items)) return units

  jobContext.order_items.forEach((item) => {
    if (item.ac_unit_id) {
      units.push(acUnitFromExistingItem(item))
      return
    }

    const qty = item.quantity || 1
    const hasAdminIdentity = Boolean(item.unit_type_id || item.capacity_id)
    for (let i = 0; i < qty; i++) {
      units.push(hasAdminIdentity ? acUnitFromOrderItem(item) : emptyAcUnit())
    }
  })

  return units
}

function acUnitFromExistingItem(item: NonNullable<JobContext['order_items']>[number]): AcUnitReportItem {
  const acUnitData = item.ac_units
  const rawCapRange = acUnitData?.capacity_ranges
  const capLabel = rawCapRange
    ? (Array.isArray(rawCapRange) ? rawCapRange[0]?.capacity_label : rawCapRange.capacity_label)
    : null

  return {
    ac_unit_id: item.ac_unit_id,
    brand: item.brand || acUnitData?.brand || '',
    brand_id: selectString(acUnitData?.brand_id) || selectString(item.brand_id),
    ac_type: item.unit_type_name || acUnitData?.ac_type || '',
    unit_type_id: selectString(item.unit_type_id) || selectString(acUnitData?.unit_type_id),
    capacity_id: selectString(item.capacity_id) || selectString(acUnitData?.capacity_id),
    capacity_label: item.capacity_label || (capLabel ? selectString(capLabel) : ''),
    model_number: acUnitData?.model_number || '',
    serial_number: acUnitData?.serial_number || '',
    room_location: acUnitData?.room_location || '',
    floor_level: acUnitData?.floor_level || '',
    position_detail: acUnitData?.position_detail || '',
    skipped: false,
    skip_reason: '',
    photos_before: [],
    photos_after: [],
    notes: '',
    materials_used: [],
  }
}

function acUnitFromOrderItem(item: NonNullable<JobContext['order_items']>[number]): AcUnitReportItem {
  return {
    ac_unit_id: '',
    brand: item.brand || '',
    brand_id: selectString(item.brand_id),
    ac_type: item.unit_type_name || '',
    unit_type_id: selectString(item.unit_type_id),
    capacity_id: selectString(item.capacity_id),
    capacity_label: selectString(item.capacity_label),
    model_number: '',
    serial_number: '',
    room_location: '',
    floor_level: '',
    position_detail: '',
    skipped: false,
    skip_reason: '',
    photos_before: [],
    photos_after: [],
    notes: '',
    materials_used: [],
  }
}

function emptyAcUnit(): AcUnitReportItem {
  return {
    ac_unit_id: '',
    brand: '',
    brand_id: '',
    ac_type: '',
    unit_type_id: '',
    capacity_id: '',
    capacity_label: '',
    model_number: '',
    serial_number: '',
    room_location: '',
    floor_level: '',
    position_detail: '',
    skipped: false,
    skip_reason: '',
    photos_before: [],
    photos_after: [],
    notes: '',
    materials_used: [],
  }
}

export function snapshotToJobContext(snapshot: LocalJobSnapshot): JobContext {
  return {
    order_id: snapshot.orderId,
    status: snapshot.status,
    canonical_status: snapshot.status,
    has_report: false,
    report_id: null,
    scheduled_visit_date: snapshot.scheduledDate,
    customers: { customer_name: snapshot.customer.name },
    order_items: snapshot.orderItems.map((item) => ({
      order_item_id: item.id,
      ac_unit_id: item.acUnitId,
      service_type: item.serviceType,
      quantity: 1,
      unit_type_id: item.unitTypeId ?? null,
      capacity_id: item.capacityId ?? null,
      brand_id: item.brandId ?? null,
      unit_type_name: item.unitTypeName ?? null,
      capacity_label: item.capacityLabel ?? null,
      brand: item.brandName ?? null,
      locations: { full_address: snapshot.customer.address },
      ac_units: item.acUnit ? snapshotAcUnit(item) : null,
    })),
    order_technicians: snapshot.technicianId
      ? [{ id: snapshot.technicianId, technician_id: snapshot.technicianId, role: 'lead' }]
      : [],
  }
}

function snapshotAcUnit(item: LocalJobSnapshot['orderItems'][number]) {
  const acUnit = item.acUnit
  if (!acUnit) return null
  return {
    ac_unit_id: acUnit.id ?? item.acUnitId ?? '',
    brand: acUnit.brand,
    brand_id: selectString(acUnit.brandId),
    model_number: acUnit.modelNumber,
    serial_number: acUnit.serialNumber,
    installation_date: acUnit.installationDate,
    ac_type: acUnit.acType,
    unit_type_id: selectString(acUnit.unitTypeId),
    capacity_id: selectString(acUnit.capacityId),
    room_location: acUnit.roomLocation,
    floor_level: acUnit.floorLevel,
    position_detail: acUnit.positionDetail,
    capacity_ranges: acUnit.capacityLabel ? { capacity_label: selectString(acUnit.capacityLabel) } : null,
  }
}

export function buildJobSummary(jobData: JobContext): JobSummary {
  const customerName = jobData.customers?.customer_name || 'Pelanggan'
  const address = jobData.order_items?.[0]?.locations?.full_address || 'Tidak ada alamat'
  const serviceTypes = jobData.order_items?.map((item) => item.service_type).filter((t): t is string => Boolean(t))
  const serviceType = serviceTypes?.[0] || 'Servis AC'

  return { customerName, address, serviceType }
}
