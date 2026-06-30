'use server'

import { createClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'
import { logger } from '@/lib/logger'
import { auditLog } from '@/lib/audit'
import { sendWhatsApp } from '@/lib/whatsapp'
import { sendReminderEmail } from '@/lib/email-reminder'
import { formatReminderMessage, type CustomerReminder, type ReminderRule, type ReminderChannel, type ReminderTemplateContext } from '@/lib/reminder-utils'
import { READ_ROLES, WRITE_ROLES, requireRoles, toErrorMessage } from './reminders-types'
import type {
  ActionResult,
  CustomerReminderFilters,
  ReminderAcUnitRow,
  RawServicedAcUnitRow,
  ServicedAcFilters,
  ServicedAcUnitRow,
} from './reminders-types'

// =============================================================================
// Helpers
// =============================================================================

const DATE_FMT = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
function formatDueDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`); if (Number.isNaN(d.getTime())) return iso; return DATE_FMT.format(d)
}
function pickRecipient(channel: ReminderChannel, customer: { customer_name: string | null; phone_number: string | null; email: string | null } | null): string | null {
  if (!customer) return null; return channel === 'WHATSAPP' ? (customer.phone_number || null) : (customer.email || null)
}

async function dispatchReminder(channel: string, recipient: string, message: string): Promise<{ ok: true; externalId: string | null } | { ok: false; error: string }> {
  if (channel === 'WHATSAPP') {
    const r = await sendWhatsApp(recipient, message)
    return r.ok ? { ok: true, externalId: r.messageId } : { ok: false, error: r.error }
  }
  if (channel === 'EMAIL') {
    const r = await sendReminderEmail(recipient, 'Reminder Servis AC', message)
    return r.ok ? { ok: true, externalId: r.messageId } : { ok: false, error: r.error }
  }
  return { ok: false, error: `Channel tidak dikenal: ${channel}` }
}

// =============================================================================
// Customer reminders (queue management)
// =============================================================================

export async function getCustomerReminders(filters?: CustomerReminderFilters): Promise<ActionResult<{ reminders: CustomerReminder[]; pagination: { total: number; page: number; limit: number; totalPages: number } }>> {
  try {
    const auth = await requireRoles(READ_ROLES); if (!auth.ok) return { success: false, error: auth.error }
    const page = filters?.page ?? 1, limit = filters?.limit ?? 50, from = (page - 1) * limit, to = from + limit - 1
    const supabase = await createClient()
    let query = supabase.from('customer_reminders').select(`*, customers ( customer_id, customer_name, phone_number, email ), ac_units ( ac_unit_id, brand, model_number, location_id, locations ( full_address, city ) ), reminder_rules ( rule_id, name, days_before_due )`, { count: 'exact' }).order('due_date', { ascending: true }).range(from, to)
    if (filters?.status) query = query.eq('status', filters.status)
    if (filters?.customer_id) query = query.eq('customer_id', filters.customer_id)
    if (filters?.date_from) query = query.gte('due_date', filters.date_from)
    if (filters?.date_to) query = query.lte('due_date', filters.date_to)
    const { data, error, count } = await query
    if (error) throw error
    return { success: true, data: { reminders: (data ?? []) as unknown as CustomerReminder[], pagination: { total: count ?? 0, page, limit, totalPages: Math.ceil((count ?? 0) / limit) } } }
  } catch (err) { logger.error('getCustomerReminders failed:', err); return { success: false, error: toErrorMessage(err, 'Failed to fetch customer reminders') } }
}

export async function markReminderSent(reminderId: string): Promise<ActionResult<CustomerReminder>> {
  try {
    const auth = await requireRoles(WRITE_ROLES); if (!auth.ok) return { success: false, error: auth.error }
    const supabase = await createClient()
    const { data: row, error: fetchErr } = await supabase.from('customer_reminders').select('reminder_id, channel, recipient, message, status').eq('reminder_id', reminderId).single()
    if (fetchErr) throw fetchErr
    const r = row as { reminder_id: string; channel: string; recipient: string; message: string; status: string }
    if (r.status !== 'PENDING') return { success: false, error: 'Reminder tidak dalam status PENDING' }
    const result = await dispatchReminder(r.channel, r.recipient, r.message)
    if (!result.ok) {
      await supabase.from('customer_reminders').update({ status: 'FAILED', error_message: result.error.slice(0, 1000), updated_at: new Date().toISOString() }).eq('reminder_id', reminderId)
      await auditLog('reminder.send_failed', 'customer_reminders', reminderId, { status: 'PENDING' }, { status: 'FAILED', error_message: result.error.slice(0, 1000) })
      revalidatePath('/dashboard/reminders')
      return { success: false, error: `Gagal mengirim via ${r.channel === 'WHATSAPP' ? 'WhatsApp' : 'Email'}: ${result.error}` }
    }
    const { data, error } = await supabase.from('customer_reminders').update({ status: 'SENT', sent_at: new Date().toISOString(), sent_by: auth.userId, external_id: result.externalId, error_message: null, updated_at: new Date().toISOString() }).eq('reminder_id', reminderId).eq('status', 'PENDING').select('*').single()
    if (error) throw error
    await auditLog('reminder.sent', 'customer_reminders', reminderId, { status: 'PENDING' }, { status: 'SENT', sent_by: auth.userId, external_id: result.externalId })
    revalidatePath('/dashboard/reminders'); return { success: true, data: data as CustomerReminder }
  } catch (err) { logger.error('markReminderSent failed:', err); return { success: false, error: toErrorMessage(err, 'Failed to send reminder') } }
}

export async function markReminderFailed(reminderId: string, errorText: string): Promise<ActionResult<CustomerReminder>> {
  try {
    const auth = await requireRoles(WRITE_ROLES); if (!auth.ok) return { success: false, error: auth.error }
    const supabase = await createClient()
    const { data, error } = await supabase.from('customer_reminders').update({ status: 'FAILED', error_message: errorText.slice(0, 1000), updated_at: new Date().toISOString() }).eq('reminder_id', reminderId).select('*').single()
    if (error) throw error
    await auditLog('reminder.failed', 'customer_reminders', reminderId, { status: 'PENDING' }, { status: 'FAILED', error_message: errorText.slice(0, 1000) })
    revalidatePath('/dashboard/reminders'); return { success: true, data: data as CustomerReminder }
  } catch (err) { logger.error('markReminderFailed failed:', err); return { success: false, error: toErrorMessage(err, 'Failed to mark reminder as failed') } }
}

export async function markReminderDismissed(reminderId: string): Promise<ActionResult<CustomerReminder>> {
  try {
    const auth = await requireRoles(WRITE_ROLES); if (!auth.ok) return { success: false, error: auth.error }
    const supabase = await createClient()
    const { data, error } = await supabase.from('customer_reminders').update({ status: 'DISMISSED', updated_at: new Date().toISOString() }).eq('reminder_id', reminderId).select('*').single()
    if (error) throw error
    await auditLog('reminder.dismissed', 'customer_reminders', reminderId, { status: 'PENDING' }, { status: 'DISMISSED' })
    revalidatePath('/dashboard/reminders'); return { success: true, data: data as CustomerReminder }
  } catch (err) { logger.error('markReminderDismissed failed:', err); return { success: false, error: toErrorMessage(err, 'Failed to dismiss reminder') } }
}

// =============================================================================
// Bulk
// =============================================================================

export async function markRemindersSent(reminderIds: string[]): Promise<ActionResult<{ updated: string[]; skipped: string[]; failed: string[] }>> {
  try {
    const auth = await requireRoles(WRITE_ROLES); if (!auth.ok) return { success: false, error: auth.error }
    const supabase = await createClient()
    const { data: rows, error: fetchErr } = await supabase.from('customer_reminders').select('reminder_id, channel, recipient, message').in('reminder_id', reminderIds).eq('status', 'PENDING')
    if (fetchErr) throw fetchErr
    const sent: string[] = [], failed: string[] = []
    for (const r of (rows ?? []) as Array<{ reminder_id: string; channel: string; recipient: string; message: string }>) {
      const result = await dispatchReminder(r.channel, r.recipient, r.message)
      if (result.ok) {
        await supabase.from('customer_reminders').update({ status: 'SENT', sent_at: new Date().toISOString(), sent_by: auth.userId, external_id: result.externalId, error_message: null, updated_at: new Date().toISOString() }).eq('reminder_id', r.reminder_id).eq('status', 'PENDING')
        await auditLog('reminder.bulk_sent', 'customer_reminders', r.reminder_id, undefined, { status: 'SENT', external_id: result.externalId })
        sent.push(r.reminder_id)
      } else {
        await supabase.from('customer_reminders').update({ status: 'FAILED', error_message: result.error.slice(0, 1000), updated_at: new Date().toISOString() }).eq('reminder_id', r.reminder_id)
        await auditLog('reminder.send_failed', 'customer_reminders', r.reminder_id, undefined, { status: 'FAILED', error_message: result.error.slice(0, 1000) })
        failed.push(r.reminder_id)
      }
    }
    const skipped = reminderIds.filter((id) => !sent.includes(id) && !failed.includes(id))
    revalidatePath('/dashboard/reminders')
    return { success: true, data: { updated: sent, skipped, failed } }
  } catch (err) { logger.error('markRemindersSent failed:', err); return { success: false, error: toErrorMessage(err, 'Failed to send reminders') } }
}

// =============================================================================
// Generation
// =============================================================================

export async function generateRemindersFromAcUnits(options?: { asSystem?: boolean }): Promise<ActionResult<{ created: number; skipped: number; rulesScanned: number }>> {
  try {
    if (!options?.asSystem) { const auth = await requireRoles(WRITE_ROLES); if (!auth.ok) return { success: false, error: auth.error } }
    const supabase = await createClient()
    const { data: rulesData, error: rulesErr } = await supabase.from('reminder_rules').select('*').eq('is_active', true)
    if (rulesErr) throw rulesErr; const rules = (rulesData ?? []) as ReminderRule[]
    if (rules.length === 0) return { success: true, data: { created: 0, skipped: 0, rulesScanned: 0 } }
    const maxLead = rules.reduce((acc, r) => Math.max(acc, r.days_before_due), 0)
    // ponytail: hardcoded WIB (UTC+7) — use timezone-aware approach if deploying outside Indonesia
    const wibNowMs = Date.now() + 7 * 3600_000
    const now = new Date(), cutoffIso = new Date(wibNowMs + maxLead * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), todayIso = new Date(wibNowMs).toISOString().slice(0, 10)
    const { data: unitsData, error: unitsErr } = await supabase.from('ac_units').select(`ac_unit_id, brand, model_number, next_service_due_date, locations ( location_id, full_address, city, customers ( customer_id, customer_name, phone_number, email ) )`).not('next_service_due_date', 'is', null).lte('next_service_due_date', cutoffIso).gte('next_service_due_date', todayIso)
    if (unitsErr) throw unitsErr; const units = (unitsData ?? []) as unknown as ReminderAcUnitRow[]
    if (units.length === 0) return { success: true, data: { created: 0, skipped: 0, rulesScanned: rules.length } }
    const acUnitIds = units.map((u) => u.ac_unit_id)
    const { data: existingData, error: existingErr } = await supabase.from('customer_reminders').select('ac_unit_id, rule_id, due_date').in('ac_unit_id', acUnitIds)
    if (existingErr) throw existingErr
    const existingKey = new Set<string>()
    for (const row of existingData ?? []) { const r = row as { ac_unit_id: string; rule_id: string; due_date: string }; existingKey.add(`${r.ac_unit_id}|${r.rule_id}|${r.due_date}`) }
    // Best-effort: link service_report_id via order_items -> service_reports (next_service_recommendation_date = next_service_due_date)
    const reportByKey = new Map<string, string>()
    try {
      const { data: oiRows } = await supabase
        .from('order_items')
        .select('ac_unit_id, orders!inner ( service_reports ( report_id, next_service_recommendation_date ) )')
        .in('ac_unit_id', acUnitIds)
      for (const oi of (oiRows ?? []) as Array<{ ac_unit_id: string | null; orders: { service_reports: { report_id: string; next_service_recommendation_date: string | null } | Array<{ report_id: string; next_service_recommendation_date: string | null }> | null } | Array<{ service_reports: { report_id: string; next_service_recommendation_date: string | null } | Array<{ report_id: string; next_service_recommendation_date: string | null }> | null }> | null }>) {
        if (!oi.ac_unit_id) continue
        const ord = Array.isArray(oi.orders) ? oi.orders[0] : oi.orders
        if (!ord) continue
        const srs = Array.isArray(ord.service_reports) ? ord.service_reports : ord.service_reports ? [ord.service_reports] : []
        for (const sr of srs) {
          if (sr?.next_service_recommendation_date) reportByKey.set(`${oi.ac_unit_id}|${sr.next_service_recommendation_date}`, sr.report_id)
        }
      }
    } catch (err) { logger.warn('service_report_id lookup (best-effort):', err) }
    const inserts: Array<Record<string, unknown>> = []; let skipped = 0
    for (const unit of units) {
      const dueIso = unit.next_service_due_date; if (!dueIso) continue
      const customer = unit.locations?.customers ?? null, locationLabel = [unit.locations?.full_address, unit.locations?.city].filter(Boolean).join(', ') || null
      const ctx: ReminderTemplateContext = { customer_name: customer?.customer_name ?? null, ac_brand: unit.brand, ac_model: unit.model_number, location: locationLabel, due_date: formatDueDate(dueIso) }
      const dueTime = new Date(`${dueIso}T00:00:00`).getTime()
      for (const rule of rules) {
        if (dueTime > now.getTime() + rule.days_before_due * 24 * 60 * 60 * 1000) continue
        const dedupKey = `${unit.ac_unit_id}|${rule.rule_id}|${dueIso}`
        if (existingKey.has(dedupKey)) { skipped++; continue }
        const recipient = pickRecipient(rule.channel, customer); if (!recipient) { skipped++; continue }
        inserts.push({ customer_id: customer?.customer_id ?? null, ac_unit_id: unit.ac_unit_id, rule_id: rule.rule_id, due_date: dueIso, channel: rule.channel, recipient, message: formatReminderMessage(rule.message_template, ctx), status: 'PENDING', service_report_id: reportByKey.get(`${unit.ac_unit_id}|${dueIso}`) ?? null })
        existingKey.add(dedupKey)
      }
    }
    let created = 0
    if (inserts.length > 0) { const { error: insertErr, count } = await supabase.from('customer_reminders').insert(inserts, { count: 'exact' }); if (insertErr) throw insertErr; created = count ?? inserts.length }
    await auditLog('reminder.generate', 'customer_reminders', undefined, undefined, { created, skipped, rulesScanned: rules.length })
    revalidatePath('/dashboard/reminders'); return { success: true, data: { created, skipped, rulesScanned: rules.length } }
  } catch (err) { logger.error('generateRemindersFromAcUnits failed:', err); return { success: false, error: toErrorMessage(err, 'Failed to generate reminders') } }
}

export async function createManualReminder(acUnitId: string, ruleId?: string): Promise<ActionResult<{ reminder_id: string }>> {
  try {
    const auth = await requireRoles(WRITE_ROLES); if (!auth.ok) return { success: false, error: auth.error }
    if (!acUnitId) return { success: false, error: 'acUnitId is required' }
    const supabase = await createClient()
    let rule: ReminderRule | null = null
    if (ruleId) { const { data: ruleData, error: ruleErr } = await supabase.from('reminder_rules').select('*').eq('rule_id', ruleId).single(); if (ruleErr) throw ruleErr; rule = ruleData as ReminderRule }
    else { const { data: ruleData, error: ruleErr } = await supabase.from('reminder_rules').select('*').eq('is_active', true).order('created_at', { ascending: true }).limit(1).maybeSingle(); if (ruleErr) throw ruleErr; rule = (ruleData as ReminderRule | null) ?? null }
    if (!rule) return { success: false, error: 'Tidak ada rule reminder aktif. Buat rule terlebih dahulu di Settings > Reminder Rules.' }
    const { data: unitData, error: unitErr } = await supabase.from('ac_units').select(`ac_unit_id, brand, model_number, next_service_due_date, locations ( location_id, full_address, city, customers ( customer_id, customer_name, phone_number, email ) )`).eq('ac_unit_id', acUnitId).single()
    if (unitErr) throw unitErr; const unit = unitData as unknown as ReminderAcUnitRow, customer = unit.locations?.customers ?? null
    if (!customer) return { success: false, error: 'Customer untuk AC unit ini tidak ditemukan.' }
    if (!unit.next_service_due_date) return { success: false, error: 'AC unit has no scheduled service date' }
    const recipient = pickRecipient(rule.channel, customer)
    if (!recipient) { const l = rule.channel === 'WHATSAPP' ? 'nomor WhatsApp' : 'email'; return { success: false, error: `Customer belum memiliki ${l} untuk channel rule ini.` } }
    const dueIso = unit.next_service_due_date
    const locationLabel = [unit.locations?.full_address, unit.locations?.city].filter(Boolean).join(', ') || null
    const ctx: ReminderTemplateContext = { customer_name: customer.customer_name ?? null, ac_brand: unit.brand, ac_model: unit.model_number, location: locationLabel, due_date: formatDueDate(dueIso) }
    const { data: insertData, error: insertErr } = await supabase.from('customer_reminders').insert({ customer_id: customer.customer_id, ac_unit_id: unit.ac_unit_id, rule_id: rule.rule_id, due_date: dueIso, channel: rule.channel, recipient, message: formatReminderMessage(rule.message_template, ctx), status: 'PENDING' }).select('reminder_id').single()
    if (insertErr) throw insertErr
    await auditLog('reminder.manual_create', 'customer_reminders', (insertData as { reminder_id: string }).reminder_id, undefined, { ac_unit_id: unit.ac_unit_id, rule_id: rule.rule_id, channel: rule.channel })
    revalidatePath('/dashboard/reminders'); return { success: true, data: { reminder_id: (insertData as { reminder_id: string }).reminder_id } }
  } catch (err) { logger.error('createManualReminder failed:', err); return { success: false, error: toErrorMessage(err, 'Failed to create reminder') } }
}

export async function renderTemplate(template: string, vars: ReminderTemplateContext): Promise<ActionResult<string>> {
  try { return { success: true, data: formatReminderMessage(template, vars) } }
  catch (err) { return { success: false, error: toErrorMessage(err, 'Failed to render template') } }
}

// =============================================================================
// Monitoring
// =============================================================================

export async function getServicedAcUnits(filters?: ServicedAcFilters): Promise<ActionResult<ServicedAcUnitRow[]>> {
  try {
    const auth = await requireRoles(READ_ROLES); if (!auth.ok) return { success: false, error: auth.error }
    const supabase = await createClient()
    let query = supabase.from('ac_units').select(`ac_unit_id, brand, model_number, ac_type, capacity_btu, last_service_date, next_service_due_date, location_id, ac_brands ( name ), unit_types ( name ), locations ( location_id, full_address, house_number, city, customers ( customer_id, customer_name, phone_number ) )`).order('next_service_due_date', { ascending: true, nullsFirst: false })
    if (filters?.date_from) query = query.gte('next_service_due_date', filters.date_from)
    if (filters?.date_to) query = query.lte('next_service_due_date', filters.date_to)
    const { data, error } = await query; if (error) throw error
    const rawUnits = (data ?? []) as unknown as RawServicedAcUnitRow[], unitIds = rawUnits.map((u) => u.ac_unit_id)
    const pendingSet = new Set<string>(), reminderCountMap = new Map<string, number>(), lastSentMap = new Map<string, string>()
    if (unitIds.length > 0) {
      const { data: rd, error: re } = await supabase.from('customer_reminders').select('ac_unit_id, status, sent_at').in('ac_unit_id', unitIds); if (re) throw re
      for (const row of (rd ?? []) as { ac_unit_id: string | null; status: string; sent_at: string | null }[]) {
        if (!row.ac_unit_id) continue
        if (row.status === 'PENDING') pendingSet.add(row.ac_unit_id)
        reminderCountMap.set(row.ac_unit_id, (reminderCountMap.get(row.ac_unit_id) ?? 0) + 1)
        if (row.sent_at) { const prev = lastSentMap.get(row.ac_unit_id); if (!prev || row.sent_at > prev) lastSentMap.set(row.ac_unit_id, row.sent_at) }
      }
    }
    const lom = new Map<string, { created_at: string; status: string | null; service_type: string | null; customer: { customer_id: string; customer_name: string | null; phone_number: string | null } | null }>()
    if (unitIds.length > 0) {
      const { data: od, error: oe } = await supabase.from('order_items').select(`ac_unit_id, service_type, status, service_types ( name, code ), orders ( status, order_type, created_at, customers ( customer_id, customer_name, phone_number ) )`).in('ac_unit_id', unitIds)
      if (oe) throw oe
      for (const row of (od ?? []) as unknown as Array<{ ac_unit_id: string | null; service_type: string | null; status: string | null; service_types: { name: string | null; code: string | null } | Array<{ name: string | null; code: string | null }> | null; orders: { status: string | null; order_type: string | null; created_at: string; customers: { customer_id: string; customer_name: string | null; phone_number: string | null } | Array<{ customer_id: string; customer_name: string | null; phone_number: string | null }> | null } | Array<{ status: string | null; order_type: string | null; created_at: string; customers: { customer_id: string; customer_name: string | null; phone_number: string | null } | Array<{ customer_id: string; customer_name: string | null; phone_number: string | null }> | null }> | null }>) {
        if (!row.ac_unit_id) continue
        const order = Array.isArray(row.orders) ? row.orders[0] : row.orders; if (!order) continue
        const st = Array.isArray(row.service_types) ? row.service_types[0] : row.service_types
        const cust = Array.isArray(order.customers) ? order.customers[0] : order.customers
        const prev = lom.get(row.ac_unit_id)
        if (!prev || order.created_at > prev.created_at) lom.set(row.ac_unit_id, { created_at: order.created_at, service_type: st?.name ?? st?.code ?? row.service_type ?? order.order_type ?? null, status: order.status ?? row.status ?? null, customer: cust ?? null })
      }
    }
    const today = new Date(); today.setHours(0, 0, 0, 0); const todayMs = today.getTime(), sevenDaysMs = 7 * 24 * 60 * 60 * 1000
    const mapped: ServicedAcUnitRow[] = rawUnits.map((u) => {
      const loc = Array.isArray(u.locations) ? u.locations[0] : u.locations
      const cust = Array.isArray(loc?.customers) ? loc.customers[0] : loc?.customers ?? null
      const latest = lom.get(u.ac_unit_id), resolved = cust ?? latest?.customer ?? null
      const fullAddr = [loc?.full_address, loc?.house_number, loc?.city].filter((s) => !!s && String(s).trim().length > 0).join(', ') || null
      return { ac_unit_id: u.ac_unit_id, customer_id: resolved?.customer_id ?? null, customer_name: resolved?.customer_name ?? null, customer_phone: resolved?.phone_number ?? null, location_id: loc?.location_id ?? u.location_id ?? null, location_address: fullAddr, brand: u.ac_brands?.name ?? u.brand ?? null, model_number: u.model_number, ac_type: u.ac_type ?? null, unit_type_name: u.unit_types?.name ?? null, capacity_btu: u.capacity_btu, last_service_date: u.last_service_date, next_service_due_date: u.next_service_due_date, has_pending_reminder: pendingSet.has(u.ac_unit_id), reminder_count: reminderCountMap.get(u.ac_unit_id) ?? 0, last_reminder_sent_at: lastSentMap.get(u.ac_unit_id) ?? null, latest_order_status: latest?.status ?? null, latest_service_type: latest?.service_type ?? null }
    })
    let result = mapped.filter((row) => row.last_service_date !== null || row.next_service_due_date !== null)
    if (filters?.status && filters.status !== 'all') {
      result = result.filter((row) => { const due = row.next_service_due_date; if (!due) return filters.status === 'no_date'; const d = new Date(`${due}T00:00:00`).getTime(); if (Number.isNaN(d)) return filters.status === 'no_date'; const diff = d - todayMs; return filters.status === 'overdue' ? diff < 0 : filters.status === 'due_soon' ? diff >= 0 && diff <= sevenDaysMs : filters.status === 'upcoming' ? diff > sevenDaysMs : false })
    }
    if (filters?.search) { const q = filters.search.trim().toLowerCase(); if (q) result = result.filter((row) => (row.customer_name?.toLowerCase() ?? '').includes(q) || (row.customer_phone?.toLowerCase() ?? '').includes(q) || (row.location_address?.toLowerCase() ?? '').includes(q) || (row.brand?.toLowerCase() ?? '').includes(q) || (row.model_number?.toLowerCase() ?? '').includes(q)) }
    return { success: true, data: result }
  } catch (err) { logger.error('getServicedAcUnits failed:', err); return { success: false, error: toErrorMessage(err, 'Failed to fetch serviced AC units') } }
}
