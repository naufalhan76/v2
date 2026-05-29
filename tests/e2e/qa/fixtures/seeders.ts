/**
 * Test data seeders for the QA suite.
 *
 * Every seeder returns an ids object plus a `cleanup` callback that the spec
 * registers in `test.afterAll(...)` — the prefix-based purge in cleanup.ts
 * is the safety net, but per-test cleanup keeps staging tidy in real time.
 */

import { getSupabaseAdmin } from './env'
import { purgeByPrefix } from './cleanup'
import type { SeedScenario, SeedScenarioOpts } from './types'
import { makePrefix } from './env'

/**
 * Seed a customer + location + N AC units.
 * Order is NOT created here — specs create orders to exercise the full flow.
 */
export async function seedFullScenario(
  scenarioId: string,
  opts: SeedScenarioOpts = {}
): Promise<SeedScenario> {
  const prefix = makePrefix(scenarioId)
  const supabase = getSupabaseAdmin()
  const acUnitsCount = opts.acUnits ?? 2

  // 1. Customer — `customer_id` is TEXT PK; we embed prefix to make purge easy.
  const customerId = `CUST-${prefix}`
  await supabase.from('customers').insert({
    customer_id: customerId,
    customer_name: `QA ${opts.label ?? 'Customer'} ${prefix.slice(-6)}`,
    primary_contact_person: 'QA Tester',
    phone_number: '+62811000000',
    email: `qa-${prefix.slice(-6).toLowerCase()}@example.com`,
    billing_address: 'Jl. QA No. 1',
    notes: `[seed:${prefix}]`,
  })

  // 2. Location
  const locationId = `LOC-${prefix}`
  await supabase.from('locations').insert({
    location_id: locationId,
    customer_id: customerId,
    full_address: 'Jl. QA No. 1, Lantai 1',
    city: 'Jakarta',
    landmarks: '[seed]',
  })

  // 3. AC units
  const acUnitIds: string[] = []
  for (let i = 0; i < acUnitsCount; i++) {
    const acId = `AC-${prefix}-${i}`
    await supabase.from('ac_units').insert({
      ac_unit_id: acId,
      location_id: locationId,
      brand: i === 0 ? 'Daikin' : 'Panasonic',
      model_number: `QA-MODEL-${i}`,
      serial_number: `${prefix}-SN-${i}`,
      ac_type: 'Split',
      capacity_btu: 9000,
      status: 'ACTIVE',
    })
    acUnitIds.push(acId)
  }

  return {
    prefix,
    customerId,
    locationId,
    acUnitIds,
    catalogId: null, // service_catalog uses existing rows; specs that need it look up by service_type
    cleanup: () => purgeByPrefix(prefix),
  }
}

/**
 * Create an order via the admin client. Returns the orderId + item ids.
 * Use this when a spec needs an existing order quickly without exercising
 * the create-order UI.
 */
export async function seedOrder(params: {
  prefix: string
  customerId: string
  locationId: string
  acUnitIds: string[]
  serviceType?: string
  scheduledVisitDate?: string
}): Promise<{ orderId: string; itemIds: string[] }> {
  const supabase = getSupabaseAdmin()
  // order_id format embeds prefix so purge picks it up.
  const orderId = `ORD-${params.prefix}`
  await supabase.from('orders').insert({
    order_id: orderId,
    customer_id: params.customerId,
    location_id: params.locationId,
    order_type: params.serviceType ?? 'CLEANING',
    description: `[seed:${params.prefix}]`,
    status: 'PENDING',
    req_visit_date: params.scheduledVisitDate ?? new Date().toISOString().slice(0, 10),
    scheduled_visit_date: params.scheduledVisitDate ?? new Date().toISOString().slice(0, 10),
  })

  const itemIds: string[] = []
  for (const acId of params.acUnitIds) {
    const { data } = await supabase
      .from('order_items')
      .insert({
        order_id: orderId,
        location_id: params.locationId,
        ac_unit_id: acId,
        service_type: params.serviceType ?? 'CLEANING',
        quantity: 1,
        estimated_price: 150_000,
        status: 'PENDING',
      })
      .select('order_item_id')
      .single()
    if (data?.order_item_id) itemIds.push(data.order_item_id)
  }

  return { orderId, itemIds }
}

/**
 * Helper: assign a lead technician to an order (admin client, bypasses RLS).
 */
export async function assignLeadTechnician(
  orderId: string,
  technicianId: string
): Promise<void> {
  const supabase = getSupabaseAdmin()
  await supabase.from('order_technicians').insert({
    order_id: orderId,
    technician_id: technicianId,
    role: 'lead',
  })
  await supabase
    .from('orders')
    .update({ status: 'ASSIGNED', assigned_technician_id: technicianId })
    .eq('order_id', orderId)
}

/**
 * Look up the `technicians.technician_id` for a given email.
 */
export async function getTechnicianIdByEmail(
  email: string
): Promise<string | null> {
  const supabase = getSupabaseAdmin()
  // technicians.email is populated at seed time, so resolve directly. (Both
  // technicians and user_management carry their own auth_user_id UUID; the
  // previous two-hop join compared the MSN TEXT user_id against the auth UUID
  // and never matched.)
  const { data: tech } = await supabase
    .from('technicians')
    .select('technician_id')
    .eq('email', email)
    .maybeSingle()
  return tech?.technician_id ?? null
}
