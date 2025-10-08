'use server'

import { createClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'

export interface BankAccount {
  bank: string
  account_number: string
  account_name: string
}

export interface InvoiceConfig {
  config_id: string
  company_name: string
  company_address: string | null
  company_phone: string | null
  company_email: string | null
  company_website: string | null
  npwp: string | null
  tax_id: string | null
  bank_accounts: string | null // JSON string
  default_due_days: number
  default_tax_percentage: number
  invoice_prefix: string
  invoice_notes_template: string | null
  terms_conditions_template: string | null
  logo_url: string | null
  is_active: boolean
  updated_by: string | null
  updated_at: string
}

export interface UpdateInvoiceConfigInput {
  company_name: string
  company_address?: string
  company_phone?: string
  company_email?: string
  company_website?: string
  npwp?: string
  tax_id?: string
  bank_accounts?: BankAccount[] // Will be stringified
  default_due_days?: number
  default_tax_percentage?: number
  invoice_prefix?: string
  invoice_notes_template?: string
  terms_conditions_template?: string
  logo_url?: string
}

/**
 * Get invoice configuration (singleton)
 */
export async function getInvoiceConfig(): Promise<InvoiceConfig | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('invoice_configuration')
    .select('*')
    .eq('is_active', true)
    .single()

  if (error) {
    // If no config exists yet, return null
    if (error.code === 'PGRST116') {
      return null
    }
    console.error('Error fetching invoice config:', error)
    throw new Error('Gagal memuat konfigurasi invoice')
  }

  return data
}

/**
 * Update invoice configuration (upsert logic for singleton)
 */
export async function updateInvoiceConfig(
  input: UpdateInvoiceConfigInput
): Promise<InvoiceConfig> {
  const supabase = await createClient()

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  // Check if config exists
  const existingConfig = await getInvoiceConfig()

  const configData = {
    company_name: input.company_name,
    company_address: input.company_address || null,
    company_phone: input.company_phone || null,
    company_email: input.company_email || null,
    company_website: input.company_website || null,
    npwp: input.npwp || null,
    tax_id: input.tax_id || null,
    bank_accounts: input.bank_accounts ? JSON.stringify(input.bank_accounts) : null,
    default_due_days: input.default_due_days || 30,
    default_tax_percentage: input.default_tax_percentage || 11,
    invoice_prefix: input.invoice_prefix || 'INV',
    invoice_notes_template: input.invoice_notes_template || null,
    terms_conditions_template: input.terms_conditions_template || null,
    logo_url: input.logo_url || null,
    is_active: true,
    updated_at: new Date().toISOString(),
  }

  let data, error

  if (existingConfig) {
    // Update existing config
    const result = await supabase
      .from('invoice_configuration')
      .update({
        ...configData,
        updated_by: user.id,
      })
      .eq('config_id', existingConfig.config_id)
      .select()
      .single()

    data = result.data
    error = result.error
  } else {
    // Insert new config
    const result = await supabase
      .from('invoice_configuration')
      .insert({
        ...configData,
        updated_by: user.id,
      })
      .select()
      .single()

    data = result.data
    error = result.error
  }

  if (error) {
    console.error('Error updating invoice config:', error)
    throw new Error('Gagal menyimpan konfigurasi invoice')
  }

  revalidatePath('/dashboard/konfigurasi/invoice-config')
  return data
}

/**
 * Get tax rate from config
 */
export async function getTaxRate(): Promise<number> {
  const config = await getInvoiceConfig()
  return config?.default_tax_percentage || 11.0
}

/**
 * Get invoice prefix from config
 */
export async function getInvoicePrefix(): Promise<string> {
  const config = await getInvoiceConfig()
  return config?.invoice_prefix || 'INV'
}

/**
 * Get default due days from config
 */
export async function getDefaultDueDays(): Promise<number> {
  const config = await getInvoiceConfig()
  return config?.default_due_days || 30
}
