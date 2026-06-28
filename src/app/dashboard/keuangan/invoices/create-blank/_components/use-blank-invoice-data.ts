import { useState, useEffect } from 'react'
import { logger } from '@/lib/logger'
import { getCustomers } from '@/lib/actions/customers'
import { getInvoiceConfig } from '@/lib/actions/invoice-config'
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
            lat: (c.lat as number | null) ?? null,
            lng: (c.lng as number | null) ?? null,
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
        const config = await getInvoiceConfig()
        if (cancelled) return
        if (!config) throw new Error('Invoice config not found')
        setBankAccounts(parseBankAccounts(config.bank_accounts))
      } catch (error) { logger.error('Error loading bank accounts:', error) }
    }
    load()
    return () => { cancelled = true }
  }, [])

  return { customers, bankAccounts }
}
