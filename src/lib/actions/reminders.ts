'use server'

import { createClient } from '@/lib/supabase-server'
import { getUser, getUserRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { logger } from '@/lib/logger'
import {
  formatReminderMessage,
  type CustomerReminder,
  type ReminderChannel,
  type ReminderRule,
  type ReminderTemplateContext,
} from '@/lib/reminder-utils'

// =============================================================================
// Types
// =============================================================================

export type ActionResult<T = void> =
  | { success: true; data: T; error?: undefined }
  | { success: true; error?: undefined }
  | { success: false; error: string; data?: undefined }

export interface ReminderRuleInput {
  name: string
  days_before_due: number
  channel: ReminderChannel
  message_template: string
  is_active?: boolean
  auto_send?: boolean
}

export type ReminderRulePatch = Partial<ReminderRuleInput>

export interface CustomerReminderFilters {
  status?: string
  customer_id?: string
  date_from?: string // ISO date — filters by due_date >= date_from
  date_to?: string // ISO date — filters by due_date <= date_to
  page?: number
  limit?: number
}

// =============================================================================
// Auth helpers
// =============================================================================

const WRITE_ROLES = ['SUPERADMIN', 'ADMIN'] as const
const READ_ROLES = ['SUPERADMIN', 'ADMIN', 'FINANCE'] as const

async function requireRoles(
  allowed: readonly string[]
): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const user = await getUser()
  if (!user) return { ok: false, error: 'Not authenticated' }

  const role = await getUserRole()
  if (!role || !allowed.includes(role)) {
    return { ok: false, error: 'Forbidden: insufficient role' }
  }

  return { ok: true, userId: user.id }
}

function toErrorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback
}

// =============================================================================
// Reminder rules
// =============================================================================

/**
 * List all reminder rules (active and inactive), newest first.
 */
export async function getReminderRules(): Promise<
  ActionResult<ReminderRule[]>
> {
  try {
    const auth = await requireRoles(READ_ROLES)
    if (!auth.ok) return { success: false, error: auth.error }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('reminder_rules')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    return { success: true, data: (data ?? []) as ReminderRule[] }
  } catch (err) {
    logger.error('getReminderRules failed:', err)
    return {
      success: false,
      error: toErrorMessage(err, 'Failed to fetch reminder rules'),
    }
  }
}

/**
 * Create a new reminder rule.
 */
export async function createReminderRule(
  input: ReminderRuleInput
): Promise<ActionResult<ReminderRule>> {
  try {
    const auth = await requireRoles(WRITE_ROLES)
    if (!auth.ok) return { success: false, error: auth.error }

    if (!input.name?.trim()) {
      return { success: false, error: 'Name is required' }
    }
    if (!input.message_template?.trim()) {
      return { success: false, error: 'Message template is required' }
    }
    if (
      !Number.isFinite(input.days_before_due) ||
      input.days_before_due < 0
    ) {
      return { success: false, error: 'days_before_due must be >= 0' }
    }
    if (input.channel !== 'WHATSAPP' && input.channel !== 'EMAIL') {
      return { success: false, error: 'channel must be WHATSAPP or EMAIL' }
    }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('reminder_rules')
      .insert({
        name: input.name.trim(),
        days_before_due: input.days_before_due,
        channel: input.channel,
        message_template: input.message_template,
        is_active: input.is_active ?? true,
        auto_send: input.auto_send ?? false,
      })
      .select('*')
      .single()

    if (error) throw error

    revalidatePath('/dashboard/settings/reminders')
    return { success: true, data: data as ReminderRule }
  } catch (err) {
    logger.error('createReminderRule failed:', err)
    return {
      success: false,
      error: toErrorMessage(err, 'Failed to create reminder rule'),
    }
  }
}

/**
 * Patch an existing reminder rule. Only provided fields are updated.
 */
export async function updateReminderRule(
  ruleId: string,
  input: ReminderRulePatch
): Promise<ActionResult<ReminderRule>> {
  try {
    const auth = await requireRoles(WRITE_ROLES)
    if (!auth.ok) return { success: false, error: auth.error }

    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }
    if (input.name !== undefined) patch.name = input.name.trim()
    if (input.days_before_due !== undefined) {
      if (!Number.isFinite(input.days_before_due) || input.days_before_due < 0) {
        return { success: false, error: 'days_before_due must be >= 0' }
      }
      patch.days_before_due = input.days_before_due
    }
    if (input.channel !== undefined) {
      if (input.channel !== 'WHATSAPP' && input.channel !== 'EMAIL') {
        return { success: false, error: 'channel must be WHATSAPP or EMAIL' }
      }
      patch.channel = input.channel
    }
    if (input.message_template !== undefined) {
      patch.message_template = input.message_template
    }
    if (input.is_active !== undefined) patch.is_active = input.is_active
    if (input.auto_send !== undefined) patch.auto_send = input.auto_send

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('reminder_rules')
      .update(patch)
      .eq('rule_id', ruleId)
      .select('*')
      .single()

    if (error) throw error

    revalidatePath('/dashboard/settings/reminders')
    return { success: true, data: data as ReminderRule }
  } catch (err) {
    logger.error('updateReminderRule failed:', err)
    return {
      success: false,
      error: toErrorMessage(err, 'Failed to update reminder rule'),
    }
  }
}

/**
 * Soft-delete a reminder rule by flipping `is_active` to false.
 */
export async function deleteReminderRule(
  ruleId: string
): Promise<ActionResult> {
  try {
    const auth = await requireRoles(WRITE_ROLES)
    if (!auth.ok) return { success: false, error: auth.error }

    const supabase = await createClient()
    const { error } = await supabase
      .from('reminder_rules')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('rule_id', ruleId)

    if (error) throw error

    revalidatePath('/dashboard/settings/reminders')
    return { success: true }
  } catch (err) {
    logger.error('deleteReminderRule failed:', err)
    return {
      success: false,
      error: toErrorMessage(err, 'Failed to delete reminder rule'),
    }
  }
}

// =============================================================================
// Customer reminders
// =============================================================================

/**
 * List customer reminders with optional filtering. Returns up to `limit` rows
 * (default 50) ordered by due_date ascending.
 */
export async function getCustomerReminders(
  filters?: CustomerReminderFilters
): Promise<
  ActionResult<{
    reminders: CustomerReminder[]
    pagination: { total: number; page: number; limit: number; totalPages: number }
  }>
> {
  try {
    const auth = await requireRoles(READ_ROLES)
    if (!auth.ok) return { success: false, error: auth.error }

    const page = filters?.page ?? 1
    const limit = filters?.limit ?? 50
    const from = (page - 1) * limit
    const to = from + limit - 1

    const supabase = await createClient()
    let query = supabase
      .from('customer_reminders')
      .select(
        `
          *,
          customers ( customer_id, customer_name, phone_number, email ),
          ac_units ( ac_unit_id, brand, model_number, location_id, locations ( full_address, city ) ),
          reminder_rules ( rule_id, name, days_before_due )
        `,
        { count: 'exact' }
      )
      .order('due_date', { ascending: true })
      .range(from, to)

    if (filters?.status) query = query.eq('status', filters.status)
    if (filters?.customer_id) query = query.eq('customer_id', filters.customer_id)
    if (filters?.date_from) query = query.gte('due_date', filters.date_from)
    if (filters?.date_to) query = query.lte('due_date', filters.date_to)

    const { data, error, count } = await query
    if (error) throw error

    return {
      success: true,
      data: {
        reminders: (data ?? []) as unknown as CustomerReminder[],
        pagination: {
          total: count ?? 0,
          page,
          limit,
          totalPages: Math.ceil((count ?? 0) / limit),
        },
      },
    }
  } catch (err) {
    logger.error('getCustomerReminders failed:', err)
    return {
      success: false,
      error: toErrorMessage(err, 'Failed to fetch customer reminders'),
    }
  }
}

/**
 * Mark a reminder as successfully sent. `externalId` is the message id from the
 * upstream provider (WhatsApp Business / Resend).
 */
export async function markReminderSent(
  reminderId: string,
  externalId?: string
): Promise<ActionResult<CustomerReminder>> {
  try {
    const auth = await requireRoles(READ_ROLES)
    if (!auth.ok) return { success: false, error: auth.error }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('customer_reminders')
      .update({
        status: 'SENT',
        sent_at: new Date().toISOString(),
        sent_by: auth.userId,
        external_id: externalId ?? null,
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq('reminder_id', reminderId)
      .select('*')
      .single()

    if (error) throw error

    revalidatePath('/dashboard/reminders')
    return { success: true, data: data as CustomerReminder }
  } catch (err) {
    logger.error('markReminderSent failed:', err)
    return {
      success: false,
      error: toErrorMessage(err, 'Failed to mark reminder as sent'),
    }
  }
}

/**
 * Mark a reminder as failed and record the error message.
 */
export async function markReminderFailed(
  reminderId: string,
  errorText: string
): Promise<ActionResult<CustomerReminder>> {
  try {
    const auth = await requireRoles(READ_ROLES)
    if (!auth.ok) return { success: false, error: auth.error }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('customer_reminders')
      .update({
        status: 'FAILED',
        error_message: errorText.slice(0, 1000),
        updated_at: new Date().toISOString(),
      })
      .eq('reminder_id', reminderId)
      .select('*')
      .single()

    if (error) throw error

    revalidatePath('/dashboard/reminders')
    return { success: true, data: data as CustomerReminder }
  } catch (err) {
    logger.error('markReminderFailed failed:', err)
    return {
      success: false,
      error: toErrorMessage(err, 'Failed to mark reminder as failed'),
    }
  }
}

/**
 * Manually dismiss a pending reminder.
 */
export async function markReminderDismissed(
  reminderId: string
): Promise<ActionResult<CustomerReminder>> {
  try {
    const auth = await requireRoles(READ_ROLES)
    if (!auth.ok) return { success: false, error: auth.error }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('customer_reminders')
      .update({
        status: 'DISMISSED',
        updated_at: new Date().toISOString(),
      })
      .eq('reminder_id', reminderId)
      .select('*')
      .single()

    if (error) throw error

    revalidatePath('/dashboard/reminders')
    return { success: true, data: data as CustomerReminder }
  } catch (err) {
    logger.error('markReminderDismissed failed:', err)
    return {
      success: false,
      error: toErrorMessage(err, 'Failed to dismiss reminder'),
    }
  }
}

// =============================================================================
// Generation
// =============================================================================

interface AcUnitRow {
  ac_unit_id: string
  brand: string | null
  model_number: string | null
  next_service_due_date: string | null
  locations: {
    location_id: string
    full_address: string | null
    city: string | null
    customers: {
      customer_id: string
      customer_name: string | null
      phone_number: string | null
      email: string | null
    } | null
  } | null
}

const DATE_FMT = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

function formatDueDate(iso: string): string {
  // iso is YYYY-MM-DD; treat as local-date by appending T00:00 to avoid TZ drift
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return DATE_FMT.format(d)
}

function pickRecipient(
  channel: ReminderChannel,
  customer: AcUnitRow['locations'] extends infer L
    ? L extends { customers: infer C }
      ? C
      : never
    : never
): string | null {
  if (!customer) return null
  if (channel === 'WHATSAPP') return customer.phone_number || null
  return customer.email || null
}

/**
 * Scan AC units whose `next_service_due_date` falls within any active rule's
 * lead time and create matching `customer_reminders` rows. Idempotent:
 * (ac_unit_id, rule_id, due_date) is the dedup key.
 *
 * Returns a summary of what was created.
 */
export async function generateRemindersFromAcUnits(options?: {
  /**
   * Skip the cookie-session role check. Use only from trusted server-side
   * callers that have already authenticated the request (e.g. the
   * `/api/admin/reminders/run` route handles cron-secret and admin auth
   * before calling this).
   */
  asSystem?: boolean
}): Promise<
  ActionResult<{ created: number; skipped: number; rulesScanned: number }>
> {
  try {
    if (!options?.asSystem) {
      const auth = await requireRoles(WRITE_ROLES)
      if (!auth.ok) return { success: false, error: auth.error }
    }

    const supabase = await createClient()

    // 1. Active rules
    const { data: rulesData, error: rulesErr } = await supabase
      .from('reminder_rules')
      .select('*')
      .eq('is_active', true)

    if (rulesErr) throw rulesErr
    const rules = (rulesData ?? []) as ReminderRule[]
    if (rules.length === 0) {
      return { success: true, data: { created: 0, skipped: 0, rulesScanned: 0 } }
    }

    const maxLead = rules.reduce(
      (acc, r) => Math.max(acc, r.days_before_due),
      0
    )

    // 2. Cutoff = today + maxLead (UTC date string)
    const now = new Date()
    const cutoff = new Date(now.getTime() + maxLead * 24 * 60 * 60 * 1000)
    const cutoffIso = cutoff.toISOString().slice(0, 10)
    const todayIso = now.toISOString().slice(0, 10)

    // 3. AC units within window
    const { data: unitsData, error: unitsErr } = await supabase
      .from('ac_units')
      .select(
        `
          ac_unit_id,
          brand,
          model_number,
          next_service_due_date,
          locations (
            location_id,
            full_address,
            city,
            customers (
              customer_id,
              customer_name,
              phone_number,
              email
            )
          )
        `
      )
      .not('next_service_due_date', 'is', null)
      .lte('next_service_due_date', cutoffIso)
      .gte('next_service_due_date', todayIso)

    if (unitsErr) throw unitsErr
    const units = (unitsData ?? []) as unknown as AcUnitRow[]

    if (units.length === 0) {
      return {
        success: true,
        data: { created: 0, skipped: 0, rulesScanned: rules.length },
      }
    }

    // 4. Pull existing reminders for these (ac_unit, rule, due_date) combos to dedupe
    const acUnitIds = units.map((u) => u.ac_unit_id)
    const { data: existingData, error: existingErr } = await supabase
      .from('customer_reminders')
      .select('ac_unit_id, rule_id, due_date')
      .in('ac_unit_id', acUnitIds)

    if (existingErr) throw existingErr

    const existingKey = new Set<string>()
    for (const row of existingData ?? []) {
      const r = row as { ac_unit_id: string; rule_id: string; due_date: string }
      existingKey.add(`${r.ac_unit_id}|${r.rule_id}|${r.due_date}`)
    }

    // 5. Build inserts
    const inserts: Array<Record<string, unknown>> = []
    let skipped = 0

    for (const unit of units) {
      const dueIso = unit.next_service_due_date
      if (!dueIso) continue

      const customer = unit.locations?.customers ?? null
      const locationLabel =
        [unit.locations?.full_address, unit.locations?.city]
          .filter(Boolean)
          .join(', ') || null

      const ctx: ReminderTemplateContext = {
        customer_name: customer?.customer_name ?? null,
        ac_brand: unit.brand,
        ac_model: unit.model_number,
        location: locationLabel,
        due_date: formatDueDate(dueIso),
      }

      const dueTime = new Date(`${dueIso}T00:00:00`).getTime()

      for (const rule of rules) {
        // Threshold: due_date <= today + days_before_due
        const ruleCutoff =
          now.getTime() + rule.days_before_due * 24 * 60 * 60 * 1000
        if (dueTime > ruleCutoff) continue

        const dedupKey = `${unit.ac_unit_id}|${rule.rule_id}|${dueIso}`
        if (existingKey.has(dedupKey)) {
          skipped++
          continue
        }

        const recipient = pickRecipient(rule.channel, customer)
        if (!recipient) {
          skipped++
          continue
        }

        inserts.push({
          customer_id: customer?.customer_id ?? null,
          ac_unit_id: unit.ac_unit_id,
          rule_id: rule.rule_id,
          due_date: dueIso,
          channel: rule.channel,
          recipient,
          message: formatReminderMessage(rule.message_template, ctx),
          status: 'PENDING',
        })
        // Mark as scheduled so duplicates inside this same batch are skipped
        existingKey.add(dedupKey)
      }
    }

    let created = 0
    if (inserts.length > 0) {
      const { error: insertErr, count } = await supabase
        .from('customer_reminders')
        .insert(inserts, { count: 'exact' })

      if (insertErr) throw insertErr
      created = count ?? inserts.length
    }

    revalidatePath('/dashboard/reminders')
    return {
      success: true,
      data: { created, skipped, rulesScanned: rules.length },
    }
  } catch (err) {
    logger.error('generateRemindersFromAcUnits failed:', err)
    return {
      success: false,
      error: toErrorMessage(err, 'Failed to generate reminders'),
    }
  }
}

/**
 * Server action wrapper around `formatReminderMessage` for callers that need
 * a server-side render (e.g. previewing a template against live customer data).
 */
export async function renderTemplate(
  template: string,
  vars: ReminderTemplateContext
): Promise<ActionResult<string>> {
  try {
    return { success: true, data: formatReminderMessage(template, vars) }
  } catch (err) {
    return {
      success: false,
      error: toErrorMessage(err, 'Failed to render template'),
    }
  }
}
