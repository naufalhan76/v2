// src/lib/reminder-utils.ts
// Types, template rendering, and status color tokens for the reminder system.
// Pure utilities — safe to import from both server and client modules.

/**
 * Channels supported for sending reminders to customers.
 */
export type ReminderChannel = 'WHATSAPP' | 'EMAIL'

/**
 * Lifecycle states for a queued customer reminder.
 *
 * - PENDING: created, not yet sent
 * - SENT: successfully delivered (or marked sent manually)
 * - FAILED: send attempt failed; error_message captured
 * - CANCELLED: cancelled programmatically (e.g. service rescheduled)
 * - DISMISSED: manually dismissed by an operator
 */
export type ReminderStatus =
  | 'PENDING'
  | 'SENT'
  | 'FAILED'
  | 'CANCELLED'
  | 'DISMISSED'

/**
 * Configurable rule that drives when reminders are generated and how the
 * outgoing message looks.
 */
export interface ReminderRule {
  rule_id: string
  name: string
  days_before_due: number
  channel: ReminderChannel
  message_template: string
  is_active: boolean
  auto_send: boolean
  created_at: string
  updated_at: string
}

/**
 * A single reminder queued for a customer + AC unit + due date.
 */
export interface CustomerReminder {
  reminder_id: string
  customer_id: string | null
  ac_unit_id: string | null
  service_report_id: string | null
  rule_id: string | null
  due_date: string
  channel: ReminderChannel
  recipient: string
  message: string
  status: ReminderStatus
  sent_at: string | null
  sent_by: string | null
  external_id: string | null
  error_message: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

/**
 * Variables available to a reminder template.
 *
 * `due_date` should be pre-formatted (e.g. "27 Mei 2026") by the caller.
 */
export interface ReminderTemplateContext {
  customer_name?: string | null
  ac_brand?: string | null
  ac_model?: string | null
  location?: string | null
  due_date?: string | null
}

const TEMPLATE_VAR_PATTERN = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g

/**
 * Replace `{{var}}` placeholders in a template with values from `ctx`.
 * Unknown placeholders are left as-is so they're easy to spot in QA.
 * `null`/`undefined` values render as an empty string.
 */
export function formatReminderMessage(
  template: string,
  ctx: ReminderTemplateContext
): string {
  if (!template) return ''
  return template.replace(TEMPLATE_VAR_PATTERN, (match, key: string) => {
    if (Object.prototype.hasOwnProperty.call(ctx, key)) {
      const value = (ctx as Record<string, unknown>)[key]
      if (value === null || value === undefined) return ''
      return String(value)
    }
    return match
  })
}

/** Token classes; values resolve via CSS vars. See DESIGN.md. */
export const REMINDER_STATUS_COLORS: Record<
  ReminderStatus,
  { bg: string; text: string; border: string }
> = {
  PENDING: {
    bg: 'bg-status-pending-bg',
    text: 'text-status-pending',
    border: 'border-status-pending/30',
  },
  SENT: {
    bg: 'bg-status-completed-bg',
    text: 'text-status-completed',
    border: 'border-status-completed/30',
  },
  FAILED: {
    bg: 'bg-status-cancelled-bg',
    text: 'text-status-cancelled',
    border: 'border-status-cancelled/30',
  },
  CANCELLED: {
    bg: 'bg-muted',
    text: 'text-muted-foreground',
    border: 'border-border',
  },
  DISMISSED: {
    bg: 'bg-muted',
    text: 'text-foreground',
    border: 'border-border',
  },
}

/**
 * Human-readable labels for reminder statuses (Indonesian).
 */
export const REMINDER_STATUS_LABELS: Record<ReminderStatus, string> = {
  PENDING: 'Menunggu',
  SENT: 'Terkirim',
  FAILED: 'Gagal',
  CANCELLED: 'Dibatalkan',
  DISMISSED: 'Diabaikan',
}

/**
 * Human-readable labels for reminder channels.
 */
export const REMINDER_CHANNEL_LABELS: Record<ReminderChannel, string> = {
  WHATSAPP: 'WhatsApp',
  EMAIL: 'Email',
}
