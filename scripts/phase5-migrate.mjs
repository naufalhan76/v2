#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * MSN ERP V2 — Phase 5 Data Migration
 *
 * Migrates V1 legacy data into V2 canonical shape:
 *   1. orders.status / order_items.status → 8 canonical states
 *      (workshop states are archived as CANCELLED with a note)
 *   2. service_records → service_reports (one report per order_id)
 *   3. ac_units.next_service_due_date backfilled from last_service_date + 90d
 *
 * Idempotent — safe to re-run. Skips rows already on the V2 shape.
 *
 * Usage:
 *   node scripts/phase5-migrate.mjs --dry-run   # show what would change, no writes
 *   node scripts/phase5-migrate.mjs             # apply changes
 *
 * Reads `.env.staging` for credentials (same loader as bootstrap-staging.mjs).
 *
 * Requires:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY  (service role — bypasses RLS)
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

// =============================================================================
// ENV LOADER (mirrors scripts/bootstrap-staging.mjs)
// =============================================================================
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

const DRY_RUN = process.argv.includes('--dry-run')

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const log = (msg) => console.log(`\x1b[36m==>\x1b[0m ${msg}`)
const ok = (msg) => console.log(`\x1b[32m✓\x1b[0m  ${msg}`)
const warn = (msg) => console.log(`\x1b[33m!\x1b[0m  ${msg}`)
const err = (msg) => console.error(`\x1b[31m✗\x1b[0m  ${msg}`)
const dim = (msg) => console.log(`\x1b[2m   ${msg}\x1b[0m`)

const stats = {
  ordersUpdated: 0,
  orderItemsUpdated: 0,
  ordersWorkshopArchived: 0,
  serviceReportsMigrated: 0,
  serviceReportsSkipped: 0,
  acUnitsBackfilled: 0,
}

// =============================================================================
// LEGACY → CANONICAL STATUS MAP
// =============================================================================
// Direct re-labels (legacy value → canonical value)
const DIRECT_MAP = {
  NEW: 'PENDING',
  ACCEPTED: 'PENDING',
  ARRIVED: 'IN_PROGRESS',
  DONE: 'COMPLETED',
  CLOSED: 'PAID',
  'EN ROUTE': 'EN_ROUTE',
  RESCHEDULE: 'PENDING',
}

// Workshop flow values — archive as CANCELLED with audit note
const WORKSHOP_STATES = ['TO_WORKSHOP', 'IN_WORKSHOP', 'READY_TO_RETURN', 'DELIVERED']

// Helper: query rows matching a status value, but tolerate enum-cast errors
// (when the V2 enum no longer contains the legacy value, Postgres throws
// "invalid input value for enum" — we treat that as "no rows match").
async function safeFindByStatus(table, status) {
  const { data, error } = await sb
    .from(table)
    .select(table === 'orders' ? 'order_id, status' : 'order_item_id, order_id, status')
    .eq('status', status)

  if (error) {
    if (/invalid input value for enum/i.test(error.message)) return []
    throw new Error(`${table} query for status='${status}' failed: ${error.message}`)
  }
  return data ?? []
}

// =============================================================================
// STEP 1 — ORDER STATUS MIGRATION
// =============================================================================
async function migrateOrderStatuses() {
  log('Step 1: migrate orders.status & order_items.status to canonical')

  // 1a) orders — direct re-labels
  for (const [legacy, canonical] of Object.entries(DIRECT_MAP)) {
    const rows = await safeFindByStatus('orders', legacy)
    if (rows.length === 0) {
      dim(`orders status='${legacy}': 0 rows`)
      continue
    }
    log(`orders status='${legacy}' → '${canonical}': ${rows.length} rows`)
    rows.forEach((r) => dim(`  ${r.order_id}`))

    if (!DRY_RUN) {
      const { error: upErr } = await sb
        .from('orders')
        .update({ status: canonical })
        .eq('status', legacy)
      if (upErr) {
        err(`update failed: ${upErr.message}`)
        continue
      }
    }
    stats.ordersUpdated += rows.length
  }

  // 1b) orders — workshop states → CANCELLED + transition audit row
  for (const ws of WORKSHOP_STATES) {
    const rows = await safeFindByStatus('orders', ws)
    if (rows.length === 0) {
      dim(`orders status='${ws}': 0 rows`)
      continue
    }
    log(`orders status='${ws}' → CANCELLED (archive): ${rows.length} rows`)
    rows.forEach((r) => dim(`  ${r.order_id}`))

    if (!DRY_RUN) {
      const ids = rows.map((r) => r.order_id)
      const { error: upErr } = await sb
        .from('orders')
        .update({ status: 'CANCELLED' })
        .in('order_id', ids)
      if (upErr) {
        err(`workshop archive update failed: ${upErr.message}`)
        continue
      }

      // Audit trail. from_status must be a valid V2 enum value, so we can't
      // store the legacy value there — record it in the notes field instead.
      const transitions = ids.map((order_id) => ({
        order_id,
        from_status: 'PENDING',
        to_status: 'CANCELLED',
        notes: `Migrated from workshop flow (V1 legacy: ${ws})`,
      }))
      const { error: trErr } = await sb.from('order_status_transitions').insert(transitions)
      if (trErr) warn(`audit trail insert failed: ${trErr.message}`)
    }
    stats.ordersWorkshopArchived += rows.length
  }

  // 1c) order_items — same direct mapping (only IN_PROGRESS / COMPLETED targets
  // typically appear here, but apply the full map for safety)
  for (const [legacy, canonical] of Object.entries(DIRECT_MAP)) {
    const rows = await safeFindByStatus('order_items', legacy)
    if (rows.length === 0) {
      dim(`order_items status='${legacy}': 0 rows`)
      continue
    }
    log(`order_items status='${legacy}' → '${canonical}': ${rows.length} rows`)
    rows.forEach((r) => dim(`  ${r.order_item_id} (order ${r.order_id})`))

    if (!DRY_RUN) {
      const { error: upErr } = await sb
        .from('order_items')
        .update({ status: canonical })
        .eq('status', legacy)
      if (upErr) {
        err(`order_items update failed: ${upErr.message}`)
        continue
      }
    }
    stats.orderItemsUpdated += rows.length
  }

  // 1d) order_items — workshop states → CANCELLED
  for (const ws of WORKSHOP_STATES) {
    const rows = await safeFindByStatus('order_items', ws)
    if (rows.length === 0) {
      dim(`order_items status='${ws}': 0 rows`)
      continue
    }
    log(`order_items status='${ws}' → CANCELLED: ${rows.length} rows`)
    rows.forEach((r) => dim(`  ${r.order_item_id} (order ${r.order_id})`))

    if (!DRY_RUN) {
      const { error: upErr } = await sb
        .from('order_items')
        .update({ status: 'CANCELLED' })
        .eq('status', ws)
      if (upErr) {
        err(`order_items workshop update failed: ${upErr.message}`)
        continue
      }
    }
    stats.orderItemsUpdated += rows.length
  }
}

// =============================================================================
// STEP 2 — service_records → service_reports
// =============================================================================
async function migrateServiceRecords() {
  log('Step 2: migrate service_records → service_reports')

  // Pull all service_records that are tied to an order
  const { data: records, error } = await sb
    .from('service_records')
    .select('service_id, order_id, technician_id, service_date, cost, created_at')
    .not('order_id', 'is', null)

  if (error) {
    err(`failed to query service_records: ${error.message}`)
    return
  }

  if (!records || records.length === 0) {
    ok('no service_records with order_id — nothing to migrate')
    return
  }

  log(`found ${records.length} service_records with order_id`)

  for (const rec of records) {
    // Skip if a service_reports row already exists for this order_id
    const { data: existing, error: existErr } = await sb
      .from('service_reports')
      .select('report_id')
      .eq('order_id', rec.order_id)
      .is('deleted_at', null)
      .limit(1)

    if (existErr) {
      err(`existence check failed for order ${rec.order_id}: ${existErr.message}`)
      continue
    }

    if (existing && existing.length > 0) {
      stats.serviceReportsSkipped++
      dim(`skip ${rec.service_id} (order ${rec.order_id}) — service_report exists`)
      continue
    }

    // Resolve technician — prefer the order's lead from order_technicians,
    // fall back to the record's own technician_id
    let technicianId = null
    const { data: lead } = await sb
      .from('order_technicians')
      .select('technician_id')
      .eq('order_id', rec.order_id)
      .eq('role', 'lead')
      .maybeSingle()

    technicianId = lead?.technician_id ?? rec.technician_id ?? null

    if (!technicianId) {
      // Last-ditch: any assigned technician on the order_technicians table
      const { data: any } = await sb
        .from('order_technicians')
        .select('technician_id')
        .eq('order_id', rec.order_id)
        .limit(1)
      technicianId = any?.[0]?.technician_id ?? null
    }

    if (!technicianId) {
      warn(`skip ${rec.service_id} (order ${rec.order_id}) — no technician resolvable`)
      stats.serviceReportsSkipped++
      continue
    }

    const payload = {
      order_id: rec.order_id,
      technician_id: technicianId,
      // actual_total_price is NOT NULL — coerce nulls to 0
      actual_total_price: rec.cost ?? 0,
      work_completed_at: rec.service_date
        ? new Date(rec.service_date + 'T00:00:00Z').toISOString()
        : null,
      submitted_at: rec.created_at ?? new Date().toISOString(),
      notes: 'Migrated from service_records (V1)',
    }

    log(`migrate ${rec.service_id} → service_reports (order ${rec.order_id}, tech ${technicianId})`)

    if (!DRY_RUN) {
      const { error: insErr } = await sb.from('service_reports').insert(payload)
      if (insErr) {
        err(`insert failed for ${rec.service_id}: ${insErr.message}`)
        continue
      }
    }
    stats.serviceReportsMigrated++
  }
}

// =============================================================================
// STEP 3 — backfill ac_units.next_service_due_date
// =============================================================================
async function backfillAcUnitsDueDate() {
  log('Step 3: backfill ac_units.next_service_due_date (= last_service_date + 90d)')

  const { data: units, error } = await sb
    .from('ac_units')
    .select('ac_unit_id, last_service_date, next_service_due_date')
    .not('last_service_date', 'is', null)
    .is('next_service_due_date', null)

  if (error) {
    err(`failed to query ac_units: ${error.message}`)
    return
  }

  if (!units || units.length === 0) {
    ok('no ac_units need backfill')
    return
  }

  log(`${units.length} ac_units need next_service_due_date`)

  for (const unit of units) {
    const last = new Date(unit.last_service_date + 'T00:00:00Z')
    last.setUTCDate(last.getUTCDate() + 90)
    const due = last.toISOString().slice(0, 10) // YYYY-MM-DD

    dim(`${unit.ac_unit_id}: last=${unit.last_service_date} → due=${due}`)

    if (!DRY_RUN) {
      const { error: upErr } = await sb
        .from('ac_units')
        .update({ next_service_due_date: due })
        .eq('ac_unit_id', unit.ac_unit_id)
      if (upErr) {
        err(`update failed for ${unit.ac_unit_id}: ${upErr.message}`)
        continue
      }
    }
    stats.acUnitsBackfilled++
  }
}

// =============================================================================
// MAIN
// =============================================================================
async function main() {
  console.log('\x1b[1mMSN ERP V2 — Phase 5 Data Migration\x1b[0m')
  console.log(`URL: ${SUPABASE_URL}`)
  console.log(`Mode: ${DRY_RUN ? '\x1b[33mDRY RUN (no writes)\x1b[0m' : '\x1b[31mAPPLY\x1b[0m'}\n`)

  try {
    await migrateOrderStatuses()
    console.log()
    await migrateServiceRecords()
    console.log()
    await backfillAcUnitsDueDate()
    console.log()

    console.log('\x1b[1mSummary\x1b[0m')
    console.log(`  orders re-labeled            : ${stats.ordersUpdated}`)
    console.log(`  orders archived (workshop)   : ${stats.ordersWorkshopArchived}`)
    console.log(`  order_items re-labeled       : ${stats.orderItemsUpdated}`)
    console.log(`  service_reports migrated     : ${stats.serviceReportsMigrated}`)
    console.log(`  service_reports skipped      : ${stats.serviceReportsSkipped}`)
    console.log(`  ac_units backfilled          : ${stats.acUnitsBackfilled}`)

    if (DRY_RUN) {
      console.log('\n\x1b[33mDry run only — no rows were modified.\x1b[0m')
      console.log('Re-run without --dry-run to apply.')
    } else {
      ok('migration complete')
    }
  } catch (e) {
    err(`migration failed: ${e.message}`)
    console.error(e)
    process.exit(1)
  }
}

main()
