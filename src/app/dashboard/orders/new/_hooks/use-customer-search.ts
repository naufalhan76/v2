'use client'

import { useState, useEffect, useCallback } from 'react'
import { useToast } from '@/hooks/use-toast'
import { searchCustomers, getCustomerWithLocationsById, createCustomer as createCustomerAction } from '@/lib/actions/orders'
import type { CustomerSearchResult } from '@/types/orders'

type CustomerSuggestion = {
  customer_id: string
  customer_name: string
  phone_number: string
  email: string | null
}

export type { CustomerSuggestion }

export function useCustomerSearch() {
  const { toast } = useToast()
  const [customer, setCustomer] = useState<CustomerSearchResult | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false)
  const [customerSuggestions, setCustomerSuggestions] = useState<CustomerSuggestion[]>([])
  const [searchingCustomers, setSearchingCustomers] = useState(false)

  // Debounced customer search
  useEffect(() => {
    const q = searchQuery.trim()
    if (q.length < 2) {
      setCustomerSuggestions([])
      return
    }
    const timer = setTimeout(async () => {
      setSearchingCustomers(true)
      try {
        const res = await searchCustomers(q)
        if (res.success && res.data) setCustomerSuggestions(res.data)
      } finally {
        setSearchingCustomers(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const handlePickCustomerSuggestion = useCallback(async (suggestion: CustomerSuggestion) => {
    const res = await getCustomerWithLocationsById(suggestion.customer_id)
    if (!res.success || !res.data) {
      toast({
        title: 'Gagal memuat customer',
        description: res.error || '',
        variant: 'destructive',
      })
      return
    }
    setCustomer(res.data)
    setSearchQuery('')
    setCustomerSuggestions([])
    setShowNewCustomerForm(false)
  }, [toast])

  const handleCustomerCreated = useCallback((newCustomer: CustomerSearchResult) => {
    setCustomer(newCustomer)
    setShowNewCustomerForm(false)
  }, [])

  const clearCustomer = useCallback(() => {
    setCustomer(null)
    setSearchQuery('')
    setCustomerSuggestions([])
  }, [])

  const updateCustomer = useCallback((updater: (prev: CustomerSearchResult) => CustomerSearchResult) => {
    setCustomer((prev) => (prev ? updater(prev) : prev))
  }, [])

  return {
    customer,
    setCustomer,
    searchQuery,
    setSearchQuery,
    showNewCustomerForm,
    setShowNewCustomerForm,
    customerSuggestions,
    searchingCustomers,
    handlePickCustomerSuggestion,
    handleCustomerCreated,
    clearCustomer,
    updateCustomer,
    async createNewCustomer(values: {
      customer_name: string
      phone_number: string
      email?: string
      primary_contact_person?: string
      billing_address?: string
    }) {
      setSearchingCustomers(true)
      try {
        const res = await createCustomerAction({
          customer_name: values.customer_name,
          phone_number: values.phone_number,
          email: values.email || undefined,
          primary_contact_person: values.primary_contact_person || values.customer_name,
          billing_address: values.billing_address || undefined,
        })
        if (!res.success || !res.data) {
          toast({
            title: 'Gagal membuat customer',
            description: res.error || 'Terjadi kesalahan',
            variant: 'destructive',
          })
          return null
        }
        const detail = await getCustomerWithLocationsById(res.data.customer_id)
        if (!detail.success || !detail.data) {
          toast({ title: 'Customer dibuat tapi gagal memuat data', variant: 'destructive' })
          return null
        }
        toast({ title: 'Customer baru tersimpan' })
        handleCustomerCreated(detail.data)
        return detail.data
      } finally {
        setSearchingCustomers(false)
      }
    },
  }
}
