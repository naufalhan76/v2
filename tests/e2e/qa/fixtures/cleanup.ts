/**
 * Cleanup utilities — purge every row created by a QA test run.
 *
 * Cascade order matters: payment_records → invoices → service_reports →
 * order_status_transitions → order_technicians → order_items → orders →
 * ac_units → locations → customers. We hard-delete in tests to keep staging
 * clean (the production app uses soft-delete; tests bypass that).
 *
 * The single entrypoint `purgeByPrefix(prefix)` removes everything whose ID
 * starts with the QA-E2E prefix. Customers/locations are matched by their
 * `notes` column carrying the prefix marker.
 */

import { getSupabaseAdmin } from './env'
import type { QaPrefix } from './types'

export async function purgeByPrefix(prefix: QaPrefix): Promise<void> {
  const supabase = getSupabaseAdmin()

  // Find every order whose ID contains the prefix.
  const { data: orders } = await supabase
    .from('orders')
    .select('order_id')
    .ilike('order_id', `%${prefix}%`)
  const orderIds = (orders ?? []).map((o) => o.order_id)

  if (orderIds.length > 0) {
    // Find invoice ids first so we can purge payment_records explicitly.
    const { data: invoices } = await supabase
      .from('invoices')
      .select('invoice_id')
      .in('order_id', orderIds)
    const invoiceIds = (invoices ?? []).map((i) => i.invoice_id)

    if (invoiceIds.length > 0) {
      await supabase.from('payment_records').delete().in('invoice_id', invoiceIds)
      await supabase.from('payments').delete().in('invoice_id', invoiceIds)
      await supabase.from('invoice_items').delete().in('invoice_id', invoiceIds)
      await supabase.from('invoice_communications').delete().in('invoice_id', invoiceIds)
      await supabase.from('invoices').delete().in('invoice_id', invoiceIds)
    }

    const { data: reports } = await supabase
      .from('service_reports')
      .select('report_id')
      .in('order_id', orderIds)
    const reportIds = (reports ?? []).map((r) => r.report_id)
    if (reportIds.length > 0) {
      await supabase.from('customer_reminders').delete().in('service_report_id', reportIds)
    }

    await supabase.from('service_reports').delete().in('order_id', orderIds)
    await supabase.from('order_status_transitions').delete().in('order_id', orderIds)
    await supabase.from('order_technicians').delete().in('order_id', orderIds)
    await supabase.from('order_addons').delete().in('order_id', orderIds)
    await supabase.from('order_items').delete().in('order_id', orderIds)
    await supabase.from('orders').delete().in('order_id', orderIds)
  }

  // AC units, locations, customers seeded for this prefix carry it in ID.
  await supabase.from('customer_reminders').delete().ilike('ac_unit_id', `%${prefix}%`)
  await supabase.from('ac_units').delete().ilike('ac_unit_id', `%${prefix}%`)
  await supabase.from('locations').delete().ilike('location_id', `%${prefix}%`)
  await supabase.from('customers').delete().ilike('customer_id', `%${prefix}%`)
}

/**
 * Nuke ALL QA-E2E rows in staging. Use sparingly — typically only via
 * `npm run test:qa:cleanup` between full suite runs, never inside a spec.
 */
export async function purgeAllQaData(): Promise<void> {
  const supabase = getSupabaseAdmin()
  const { data: orders } = await supabase
    .from('orders')
    .select('order_id')
    .ilike('order_id', '%QA-E2E-%')
  const orderIds = (orders ?? []).map((o) => o.order_id)

  if (orderIds.length > 0) {
    const { data: invoices } = await supabase
      .from('invoices')
      .select('invoice_id')
      .in('order_id', orderIds)
    const invoiceIds = (invoices ?? []).map((i) => i.invoice_id)

    if (invoiceIds.length > 0) {
      await supabase.from('payment_records').delete().in('invoice_id', invoiceIds)
      await supabase.from('payments').delete().in('invoice_id', invoiceIds)
      await supabase.from('invoice_items').delete().in('invoice_id', invoiceIds)
      await supabase.from('invoice_communications').delete().in('invoice_id', invoiceIds)
      await supabase.from('invoices').delete().in('invoice_id', invoiceIds)
    }

    const { data: reports } = await supabase
      .from('service_reports')
      .select('report_id')
      .in('order_id', orderIds)
    const reportIds = (reports ?? []).map((r) => r.report_id)
    if (reportIds.length > 0) {
      await supabase.from('customer_reminders').delete().in('service_report_id', reportIds)
    }

    await supabase.from('service_reports').delete().in('order_id', orderIds)
    await supabase.from('order_status_transitions').delete().in('order_id', orderIds)
    await supabase.from('order_technicians').delete().in('order_id', orderIds)
    await supabase.from('order_addons').delete().in('order_id', orderIds)
    await supabase.from('order_items').delete().in('order_id', orderIds)
    await supabase.from('orders').delete().in('order_id', orderIds)
  }

  await supabase.from('customer_reminders').delete().ilike('ac_unit_id', '%QA-E2E-%')
  await supabase.from('ac_units').delete().ilike('ac_unit_id', '%QA-E2E-%')
  await supabase.from('locations').delete().ilike('location_id', '%QA-E2E-%')
  await supabase.from('customers').delete().ilike('customer_id', '%QA-E2E-%')
}
