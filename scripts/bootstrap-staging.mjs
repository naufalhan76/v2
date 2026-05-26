#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * MSN ERP V2 Staging — Bootstrap script
 * Creates storage buckets, test auth users, and seeds reference data.
 *
 * Run: node scripts/bootstrap-staging.mjs
 *
 * Requires env vars in shell or .env.staging:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

// Load .env.staging if present
const envPath = resolve(process.cwd(), '.env.staging')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '')
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const log = (msg) => console.log(`\x1b[36m==>\x1b[0m ${msg}`)
const ok = (msg) => console.log(`\x1b[32m✓\x1b[0m  ${msg}`)
const warn = (msg) => console.log(`\x1b[33m!\x1b[0m  ${msg}`)
const err = (msg) => console.error(`\x1b[31m✗\x1b[0m  ${msg}`)

// =============================================================================
// 1. STORAGE BUCKETS
// =============================================================================
async function setupBuckets() {
  log('Setting up storage buckets...')

  const buckets = [
    {
      id: 'service-photos',
      public: true,
      fileSizeLimit: 5 * 1024 * 1024,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    },
    {
      id: 'signatures',
      public: false,
      fileSizeLimit: 1 * 1024 * 1024,
      allowedMimeTypes: ['image/png'],
    },
  ]

  for (const b of buckets) {
    const { data: existing } = await sb.storage.getBucket(b.id)
    if (existing) {
      ok(`bucket "${b.id}" already exists`)
      continue
    }
    const { error } = await sb.storage.createBucket(b.id, b)
    if (error) {
      err(`failed to create bucket "${b.id}": ${error.message}`)
    } else {
      ok(`bucket "${b.id}" created (public=${b.public})`)
    }
  }
}

// =============================================================================
// 2. TEST USERS
// =============================================================================
const TEST_USERS = [
  { email: 'superadmin@test.com', password: 'Test1234!', full_name: 'Super Admin', role: 'SUPERADMIN' },
  { email: 'admin@test.com', password: 'Test1234!', full_name: 'Admin User', role: 'ADMIN' },
  { email: 'finance@test.com', password: 'Test1234!', full_name: 'Finance User', role: 'FINANCE' },
  { email: 'teknisi1@test.com', password: 'Test1234!', full_name: 'Budi Teknisi', role: 'TECHNICIAN', tech: { contact: '081234567001', company: 'In-house' } },
  { email: 'teknisi2@test.com', password: 'Test1234!', full_name: 'Andi Teknisi', role: 'TECHNICIAN', tech: { contact: '081234567002', company: 'In-house' } },
]

async function setupUsers() {
  log('Creating test users...')

  for (const u of TEST_USERS) {
    // Check if auth user already exists
    const { data: list } = await sb.auth.admin.listUsers()
    let authUser = list?.users?.find((x) => x.email === u.email)

    if (!authUser) {
      const { data, error } = await sb.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
        user_metadata: { full_name: u.full_name },
      })
      if (error) {
        err(`failed to create ${u.email}: ${error.message}`)
        continue
      }
      authUser = data.user
      ok(`auth user created: ${u.email}`)
    } else {
      ok(`auth user already exists: ${u.email}`)
    }

    // Upsert into user_management
    const { error: umErr } = await sb.from('user_management').upsert(
      {
        full_name: u.full_name,
        email: u.email,
        role: u.role,
        is_active: true,
        auth_user_id: authUser.id,
      },
      { onConflict: 'auth_user_id' },
    )
    if (umErr) err(`user_management upsert failed for ${u.email}: ${umErr.message}`)
    else ok(`user_management linked: ${u.email} as ${u.role}`)

    // Technician row if role is TECHNICIAN
    if (u.role === 'TECHNICIAN') {
      // Check existing technician with this auth_user_id
      const { data: existingTech } = await sb
        .from('technicians')
        .select('technician_id')
        .eq('auth_user_id', authUser.id)
        .maybeSingle()

      if (!existingTech) {
        const { error: tErr } = await sb.from('technicians').insert({
          technician_name: u.full_name,
          email: u.email,
          contact_number: u.tech.contact,
          company: u.tech.company,
          auth_user_id: authUser.id,
        })
        if (tErr) err(`technician insert failed for ${u.email}: ${tErr.message}`)
        else ok(`technician profile created for ${u.email}`)
      } else {
        ok(`technician profile already exists for ${u.email}`)
      }
    }
  }
}

// =============================================================================
// 3. REFERENCE DATA SEED
// =============================================================================
async function seedReferenceData() {
  log('Seeding reference data...')

  // unit_types
  const unitTypes = [
    { name: 'Split', display_order: 1 },
    { name: 'Cassette', display_order: 2 },
    { name: 'Floor Standing', display_order: 3 },
    { name: 'Window', display_order: 4 },
  ]
  await sb.from('unit_types').upsert(unitTypes, { onConflict: 'name' })
  const { data: utData } = await sb.from('unit_types').select('unit_type_id, name')
  ok(`unit_types: ${utData?.length} rows`)

  const splitId = utData?.find((u) => u.name === 'Split')?.unit_type_id

  // capacity_ranges (only for Split, kept simple for staging)
  // Check existing first to avoid duplicates (no unique constraint on label)
  const { data: existingCaps } = await sb.from('capacity_ranges').select('capacity_label').eq('unit_type_id', splitId)
  const existingLabels = new Set((existingCaps ?? []).map((c) => c.capacity_label))
  const capacities = [
    { unit_type_id: splitId, capacity_label: '0.5 PK', display_order: 1 },
    { unit_type_id: splitId, capacity_label: '1 PK', display_order: 2 },
    { unit_type_id: splitId, capacity_label: '1.5 PK', display_order: 3 },
    { unit_type_id: splitId, capacity_label: '2 PK', display_order: 4 },
  ].filter((c) => !existingLabels.has(c.capacity_label))
  if (capacities.length > 0) {
    const { error: capErr } = await sb.from('capacity_ranges').insert(capacities)
    if (capErr) err(`capacity_ranges insert: ${capErr.message}`)
  }
  ok(`capacity_ranges seeded`)

  // ac_brands
  const brands = [
    { name: 'Daikin' },
    { name: 'Panasonic' },
    { name: 'LG' },
    { name: 'Samsung' },
    { name: 'Sharp' },
  ]
  await sb.from('ac_brands').upsert(brands, { onConflict: 'name' })
  ok(`ac_brands: ${brands.length} rows`)

  // service_types
  const serviceTypes = [
    { code: 'CLEANING', name: 'Cuci AC', display_order: 1 },
    { code: 'REFILL_FREON', name: 'Refill Freon', display_order: 2 },
    { code: 'REPAIR', name: 'Repair', display_order: 3 },
    { code: 'INSTALLATION', name: 'Installation', display_order: 4 },
    { code: 'INSPECTION', name: 'Inspection', display_order: 5 },
    { code: 'MAINTENANCE', name: 'Maintenance', display_order: 6 },
  ]
  await sb.from('service_types').upsert(serviceTypes, { onConflict: 'code' })
  ok(`service_types: ${serviceTypes.length} rows`)

  // service_pricing (simple flat pricing)
  const servicePricing = [
    { service_type: 'CLEANING', service_name: 'Cuci AC', base_price: 150000, duration_minutes: 60, includes: 'Cuci unit indoor + outdoor' },
    { service_type: 'REFILL_FREON', service_name: 'Refill Freon', base_price: 350000, duration_minutes: 90, includes: 'Refill freon hingga full' },
    { service_type: 'REPAIR', service_name: 'Repair AC', base_price: 250000, duration_minutes: 120, includes: 'Diagnosis + perbaikan ringan (parts billed separately)' },
    { service_type: 'INSTALLATION', service_name: 'Pasang AC Baru', base_price: 500000, duration_minutes: 180, includes: 'Pasang unit indoor + outdoor + bracket' },
    { service_type: 'INSPECTION', service_name: 'Inspeksi AC', base_price: 100000, duration_minutes: 30, includes: 'Cek kondisi unit + rekomendasi' },
    { service_type: 'MAINTENANCE', service_name: 'Maintenance Berkala', base_price: 200000, duration_minutes: 90, includes: 'Cuci + cek + tune-up' },
  ]
  await sb.from('service_pricing').upsert(servicePricing, { onConflict: 'service_type' })
  ok(`service_pricing: ${servicePricing.length} rows`)

  // addon_catalog
  const addons = [
    { category: 'FREON', item_name: 'Freon R32', item_code: 'FRN-R32', unit_of_measure: 'kg', unit_price: 250000 },
    { category: 'FREON', item_name: 'Freon R410A', item_code: 'FRN-R410', unit_of_measure: 'kg', unit_price: 280000 },
    { category: 'PARTS', item_name: 'Bracket Outdoor', item_code: 'BRK-OUT', unit_of_measure: 'pcs', unit_price: 150000 },
    { category: 'PARTS', item_name: 'Pipa Tembaga 1/4 inch', item_code: 'PIP-14', unit_of_measure: 'meter', unit_price: 75000 },
    { category: 'PARTS', item_name: 'Kapasitor', item_code: 'CAP-001', unit_of_measure: 'pcs', unit_price: 85000 },
    { category: 'LABOR', item_name: 'Tambahan Jam Kerja', item_code: 'LAB-OT', unit_of_measure: 'jam', unit_price: 50000 },
    { category: 'TRANSPORTATION', item_name: 'Biaya Transport Luar Kota', item_code: 'TRP-OOT', unit_of_measure: 'trip', unit_price: 100000 },
  ]
  await sb.from('addon_catalog').upsert(addons, { onConflict: 'item_code' })
  ok(`addon_catalog: ${addons.length} rows`)

  // invoice_configuration (single row)
  const { data: configExists } = await sb.from('invoice_configuration').select('config_id').limit(1)
  if (!configExists || configExists.length === 0) {
    await sb.from('invoice_configuration').insert({
      company_name: 'MSN AC Service',
      company_address: 'Jl. Test No. 1, Jakarta',
      company_phone: '021-555-1000',
      company_email: 'admin@nufnh.my.id',
      default_due_days: 30,
      default_tax_percentage: 11,
      invoice_prefix: 'INV',
      invoice_notes_template: 'Terima kasih atas kerja samanya.',
      terms_conditions_template: 'Pembayaran dapat dilakukan via transfer bank.',
      is_active: true,
    })
    ok(`invoice_configuration created`)
  } else {
    ok(`invoice_configuration already exists`)
  }

  // Sample customers (2 dummy B2B)
  const customers = [
    { customer_id: 'CS-DEMO1', customer_name: 'PT Alpha Demo', primary_contact_person: 'Pak Budi', email: 'alpha@demo.test', phone_number: '021-555-2001', billing_address: 'Jl. Sudirman No. 100, Jakarta' },
    { customer_id: 'CS-DEMO2', customer_name: 'CV Beta Sample', primary_contact_person: 'Bu Sari', email: 'beta@demo.test', phone_number: '021-555-2002', billing_address: 'Jl. Gatot Subroto No. 200, Jakarta' },
  ]
  await sb.from('customers').upsert(customers, { onConflict: 'customer_id' })
  ok(`customers: ${customers.length} demo rows`)

  // Sample locations
  const locations = [
    { location_id: 'LOC-DEMO1', customer_id: 'CS-DEMO1', full_address: 'Jl. Sudirman No. 100', house_number: '100', city: 'Jakarta' },
    { location_id: 'LOC-DEMO2', customer_id: 'CS-DEMO2', full_address: 'Jl. Gatot Subroto No. 200', house_number: '200', city: 'Jakarta' },
  ]
  await sb.from('locations').upsert(locations, { onConflict: 'location_id' })
  ok(`locations: ${locations.length} demo rows`)

  // Sample AC units
  const acUnits = [
    { ac_unit_id: 'AC-D001', location_id: 'LOC-DEMO1', brand: 'Daikin', model_number: 'FTV35', serial_number: 'DK-FTV35-001', ac_type: 'Split', capacity_btu: 12000, status: 'ACTIVE' },
    { ac_unit_id: 'AC-D002', location_id: 'LOC-DEMO1', brand: 'Daikin', model_number: 'FTV35', serial_number: 'DK-FTV35-002', ac_type: 'Split', capacity_btu: 12000, status: 'ACTIVE' },
    { ac_unit_id: 'AC-D003', location_id: 'LOC-DEMO2', brand: 'Panasonic', model_number: 'CS-XN9', serial_number: 'PN-CSXN9-001', ac_type: 'Split', capacity_btu: 9000, status: 'ACTIVE' },
  ]
  await sb.from('ac_units').upsert(acUnits, { onConflict: 'ac_unit_id' })
  ok(`ac_units: ${acUnits.length} demo rows`)
}

// =============================================================================
// MAIN
// =============================================================================
async function main() {
  console.log('\x1b[1mMSN ERP V2 — Staging Bootstrap\x1b[0m')
  console.log(`URL: ${SUPABASE_URL}\n`)

  try {
    await setupBuckets()
    console.log()
    await setupUsers()
    console.log()
    await seedReferenceData()
    console.log()
    ok('All done. Test login credentials:')
    for (const u of TEST_USERS) {
      console.log(`  ${u.role.padEnd(11)} ${u.email}  /  ${u.password}`)
    }
  } catch (e) {
    err(`Bootstrap failed: ${e.message}`)
    console.error(e)
    process.exit(1)
  }
}

main()
