'use server'

import { createClient } from '@/lib/supabase-server'
import { updateInvoiceStatus } from './invoices'

export interface InvoiceCommunication {
  communication_id: string
  invoice_id: string
  communication_type: 'EMAIL' | 'WHATSAPP'
  recipient: string
  status: string
  sent_by: string | null
  sent_at: string
  external_id: string | null
  error_message: string | null
}

/**
 * Log invoice communication (email or WhatsApp)
 */
export async function logInvoiceCommunication(data: {
  invoiceId: string
  type: 'EMAIL' | 'WHATSAPP'
  recipient: string
  externalId?: string
  status?: string
}): Promise<void> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { error } = await supabase.from('invoice_communications').insert({
    invoice_id: data.invoiceId,
    communication_type: data.type,
    recipient: data.recipient,
    external_id: data.externalId || null,
    status: data.status || 'sent',
    sent_by: user?.id || null,
  })

  if (error) {
    console.error('Error logging communication:', error)
    throw new Error('Failed to log communication')
  }

  // Auto-update invoice status to SENT if currently DRAFT
  const { data: invoice } = await supabase
    .from('invoices')
    .select('status')
    .eq('invoice_id', data.invoiceId)
    .single()

  if (invoice?.status === 'DRAFT') {
    await updateInvoiceStatus(data.invoiceId, 'SENT')
  }
}

/**
 * Get communication history for an invoice
 */
export async function getInvoiceCommunications(
  invoiceId: string
): Promise<InvoiceCommunication[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('invoice_communications')
    .select('*')
    .eq('invoice_id', invoiceId)
    .order('sent_at', { ascending: false })

  if (error) {
    console.error('Error fetching communications:', error)
    throw new Error('Failed to fetch communications')
  }

  return data || []
}

/**
 * Get communication stats for an invoice
 */
export async function getInvoiceCommunicationStats(invoiceId: string): Promise<{
  totalSent: number
  emailSent: number
  whatsappSent: number
  lastSentAt: string | null
  lastSentType: string | null
}> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('invoice_communications')
    .select('communication_type, sent_at')
    .eq('invoice_id', invoiceId)
    .order('sent_at', { ascending: false })

  if (error) {
    console.error('Error fetching communication stats:', error)
    return {
      totalSent: 0,
      emailSent: 0,
      whatsappSent: 0,
      lastSentAt: null,
      lastSentType: null,
    }
  }

  const emailCount = data?.filter((c) => c.communication_type === 'EMAIL').length || 0
  const whatsappCount =
    data?.filter((c) => c.communication_type === 'WHATSAPP').length || 0

  return {
    totalSent: data?.length || 0,
    emailSent: emailCount,
    whatsappSent: whatsappCount,
    lastSentAt: data?.[0]?.sent_at || null,
    lastSentType: data?.[0]?.communication_type || null,
  }
}
