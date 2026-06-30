'use server'

import { createClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'
import { logger } from '@/lib/logger'
import type { ReminderRule } from '@/lib/reminder-utils'
import { READ_ROLES, WRITE_ROLES, requireRoles, toErrorMessage } from './reminders-types'
import type { ActionResult, ReminderRuleInput, ReminderRulePatch } from './reminders-types'

// =============================================================================
// Reminder rules CRUD
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
    if (input.name !== undefined) {
      const trimmed = input.name.trim()
      if (!trimmed) return { success: false, error: 'Name is required' }
      patch.name = trimmed
    }
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
      if (!input.message_template.trim()) return { success: false, error: 'Message template is required' }
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
