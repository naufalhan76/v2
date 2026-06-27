'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Plus, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { useToast } from '@/hooks/use-toast'
import { AddressPicker } from '@/components/address/address-picker'
import type { CustomerSearchResult } from '@/types/orders'

type CustomerSuggestion = {
  customer_id: string
  customer_name: string
  phone_number: string
  email: string | null
}

type CustomerSearchStepProps = {
  customer: CustomerSearchResult | null
  searchQuery: string
  onSearchQueryChange: (q: string) => void
  showNewCustomerForm: boolean
  onShowNewCustomerFormChange: (show: boolean) => void
  customerSuggestions: CustomerSuggestion[]
  searchingCustomers: boolean
  onPickCustomer: (suggestion: CustomerSuggestion) => void
  onCreateCustomer: (values: NewCustomerInput) => Promise<void>
}

const newCustomerSchema = z.object({
  customer_name: z.string().min(2, 'Nama minimal 2 karakter'),
  primary_contact_person: z.string().optional(),
  phone_number: z
    .string()
    .min(8, 'Nomor telepon minimal 8 digit')
    .regex(/^[0-9+]+$/, 'Hanya angka dan +'),
  email: z.string().email('Email tidak valid').optional().or(z.literal('')),
  billing_address: z.string().optional(),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
})

export type NewCustomerInput = z.infer<typeof newCustomerSchema>

export function CustomerSearchStep({
  customer,
  searchQuery,
  onSearchQueryChange,
  showNewCustomerForm,
  onShowNewCustomerFormChange,
  customerSuggestions,
  searchingCustomers,
  onPickCustomer,
  onCreateCustomer,
}: CustomerSearchStepProps) {
  if (customer) {
    return (
      <div className="space-y-4 pt-2">
        <div className="rounded-md border bg-muted/30 p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-semibold">{customer.customer_name}</p>
              <p className="text-sm text-muted-foreground">{customer.phone_number}</p>
              {customer.email && (
                <p className="text-sm text-muted-foreground">{customer.email}</p>
              )}
              {customer.billing_address && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {customer.billing_address}
                </p>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onShowNewCustomerFormChange(false)}
            >
              <X className="mr-1 h-4 w-4" />
              Ganti
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (showNewCustomerForm) {
    return (
      <div className="space-y-4 pt-2">
        <NewCustomerForm
          onSubmit={onCreateCustomer}
          onCancel={() => onShowNewCustomerFormChange(false)}
        />
      </div>
    )
  }

  return (
    <div className="space-y-4 pt-2">
      <div>
        <Label>Cari Customer (nama atau nomor telepon)</Label>
        <Command className="rounded-md border">
          <CommandInput
            placeholder="Ketik minimal 2 karakter..."
            value={searchQuery}
            onValueChange={onSearchQueryChange}
          />
          {searchQuery.length >= 2 && (
            <CommandList>
              {searchingCustomers ? (
                <div className="p-3 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  Mencari...
                </div>
              ) : customerSuggestions.length === 0 ? (
                <CommandEmpty>Tidak ada customer ditemukan</CommandEmpty>
              ) : (
                <CommandGroup>
                  {customerSuggestions.map((c) => (
                    <CommandItem
                      key={c.customer_id}
                      value={`${c.customer_name} ${c.phone_number}`}
                      onSelect={() => onPickCustomer(c)}
                    >
                      <div className="flex flex-col">
                        <span className="font-medium">{c.customer_name}</span>
                        <span className="text-xs text-muted-foreground">
                          {c.phone_number}
                          {c.email ? ` • ${c.email}` : ''}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          )}
        </Command>
      </div>
      <div className="text-center">
        <span className="text-xs text-muted-foreground">atau</span>
      </div>
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={() => onShowNewCustomerFormChange(true)}
      >
        <Plus className="mr-2 h-4 w-4" />
        Buat Customer Baru
      </Button>
    </div>
  )
}

function NewCustomerForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (values: NewCustomerInput) => Promise<void>
  onCancel: () => void
}) {
  const [submitting, setSubmitting] = useState(false)
  const form = useForm<NewCustomerInput>({
    resolver: zodResolver(newCustomerSchema),
    defaultValues: {
      customer_name: '',
      primary_contact_person: '',
      phone_number: '',
      email: '',
      billing_address: '',
      lat: null,
      lng: null,
    },
  })

  const handle = async (values: NewCustomerInput) => {
    setSubmitting(true)
    try {
      await onSubmit(values)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={form.handleSubmit(handle)} className="space-y-3 rounded-md border bg-muted/30 p-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <Label>Nama Customer *</Label>
          <Input {...form.register('customer_name')} placeholder="PT. Sumber Sejahtera" />
          {form.formState.errors.customer_name && (
            <p className="mt-1 text-xs text-destructive">{form.formState.errors.customer_name.message}</p>
          )}
        </div>
        <div>
          <Label>Kontak Person</Label>
          <Input {...form.register('primary_contact_person')} placeholder="Pak Budi" />
        </div>
        <div>
          <Label>Nomor Telepon *</Label>
          <Input {...form.register('phone_number')} placeholder="6281234567890" />
          {form.formState.errors.phone_number && (
            <p className="mt-1 text-xs text-destructive">{form.formState.errors.phone_number.message}</p>
          )}
        </div>
        <div>
          <Label>Email</Label>
          <Input {...form.register('email')} placeholder="customer@example.com" />
          {form.formState.errors.email && (
            <p className="mt-1 text-xs text-destructive">{form.formState.errors.email.message}</p>
          )}
        </div>
        <div className="md:col-span-2">
          <Label>Alamat Billing</Label>
          <Textarea
            rows={2}
            {...form.register('billing_address')}
            placeholder="Alamat untuk penagihan / invoice"
          />
        </div>
        <div className="md:col-span-2 pt-2">
          <Label>Titik Lokasi Peta (Opsional)</Label>
          <AddressPicker
            value={{ lat: form.watch('lat') ?? null, lng: form.watch('lng') ?? null }}
            onChange={(coords) => {
              form.setValue('lat', coords.lat, { shouldDirty: true })
              form.setValue('lng', coords.lng, { shouldDirty: true })
            }}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Pin lokasi akan digunakan untuk navigasi teknisi. Opsional.
          </p>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
          Batal
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Simpan Customer
        </Button>
      </div>
    </form>
  )
}
