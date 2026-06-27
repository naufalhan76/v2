'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/use-toast'
import { logger } from '@/lib/logger'
import type { Customer } from '@/types/customers'

export interface CustomerFormState {
  customer_name: string
  primary_contact_person: string
  phone_number: string
  email: string
  billing_address: string
  notes: string
  lat: number | null
  lng: number | null
}

export interface UseCustomerDetailReturn {
  customerForm: CustomerFormState
  isEditCustomerOpen: boolean
  isSavingCustomer: boolean
  selectedOrderId: string | null
  orderPanelOpen: boolean
  handleOpenEditCustomer: (customer: Customer | null) => void
  setIsEditCustomerOpen: (open: boolean) => void
  handleSaveCustomer: (
    e: React.FormEvent,
    customerId: string,
    form: CustomerFormState,
    customerQueryKey: readonly [string, string],
  ) => Promise<void>
  setSelectedOrderId: (id: string | null) => void
  setOrderPanelOpen: (open: boolean) => void
  setCustomerForm: React.Dispatch<React.SetStateAction<CustomerFormState>>
}

const initialCustomerForm = (): CustomerFormState => ({
  customer_name: '',
  primary_contact_person: '',
  phone_number: '',
  email: '',
  billing_address: '',
  notes: '',
  lat: null,
  lng: null,
})

export function useCustomerDetail(customerId: string): UseCustomerDetailReturn {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [isEditCustomerOpen, setIsEditCustomerOpen] = useState(false)
  const [customerForm, setCustomerForm] = useState<CustomerFormState>(initialCustomerForm())
  const [isSavingCustomer, setIsSavingCustomer] = useState(false)
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [orderPanelOpen, setOrderPanelOpen] = useState(false)

  const handleOpenEditCustomer = (customer: Customer | null) => {
    if (!customer) return
    setCustomerForm({
      customer_name: customer.customer_name ?? '',
      primary_contact_person: customer.primary_contact_person ?? '',
      phone_number: customer.phone_number ?? '',
      email: customer.email ?? '',
      billing_address: customer.billing_address ?? '',
      notes: customer.notes ?? '',
      lat: customer.lat ?? null,
      lng: customer.lng ?? null,
    })
    setIsEditCustomerOpen(true)
  }

  const handleSaveCustomer = async (
    e: React.FormEvent,
    id: string,
    form: CustomerFormState,
    customerQueryKey: readonly [string, string],
  ) => {
    e.preventDefault()
    setIsSavingCustomer(true)
    try {
      const res = await fetch(`/api/customers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const result = await res.json()
      if (result.success) {
        toast({ title: 'Berhasil', description: 'Customer berhasil diperbarui' })
        queryClient.invalidateQueries({ queryKey: customerQueryKey })
        queryClient.invalidateQueries({ queryKey: ['customers'] })
        setIsEditCustomerOpen(false)
      } else {
        toast({
          title: 'Gagal',
          description: result.error || 'Gagal memperbarui customer',
          variant: 'destructive',
        })
      }
    } catch (error) {
      logger.error('Error updating customer:', error)
      toast({
        title: 'Error',
        description: 'Terjadi kesalahan saat memperbarui customer',
        variant: 'destructive',
      })
    } finally {
      setIsSavingCustomer(false)
    }
  }

  return {
    customerForm,
    isEditCustomerOpen,
    isSavingCustomer,
    selectedOrderId,
    orderPanelOpen,
    handleOpenEditCustomer,
    setIsEditCustomerOpen,
    handleSaveCustomer,
    setCustomerForm,
    setSelectedOrderId,
    setOrderPanelOpen,
  }
}
