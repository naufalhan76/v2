import { useState, useEffect } from 'react'
import { logger } from '@/lib/logger'
import { getCustomers } from '@/lib/actions/customers'
import { parseBankAccounts, type BankAccount } from '@/lib/bank-accounts'
import type { CustomerOption } from './types'

export function useBlankInvoiceData() {
  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const result = await getCustomers({ limit: 200 })
        if (cancelled) return
        if (result.success && Array.isArray(result.data)) {
          setCustomers(result.data.map((c: Record<string, unknown>) => ({
            customer_id: c.customer_id as string, customer_name: c.customer_name as string,
            phone_number: (c.phone_number as string | null) ?? null,
            email: (c.email as string | null) ?? null, billing_address: (c.billing_address as string | null) ?? null,
          })))
        }
      } catch (error) { logger.error('Error loading customers:', error) }
    }
    load()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const { createClient } = await import('@/lib/supabase-browser')
        const supabase = createClient()
        const { data, error } = await supabase.from('invoice_configuration').select('bank_accounts').eq('is_active', true).single()
        if (cancelled) return
        if (error) throw error
        setBankAccounts(parseBankAccounts(data?.bank_accounts))
      } catch (error) { logger.error('Error loading bank accounts:', error) }
    }
    load()
    return () => { cancelled = true }
  }, [])

  return { customers, bankAccounts }
}
