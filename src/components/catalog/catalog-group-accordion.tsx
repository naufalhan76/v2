'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Search, AlertCircle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { useToast } from '@/hooks/use-toast'
import {
  getCatalogGrouped,
  getCatalogLookups,
  createCatalogEntry,
  updateCatalogEntry,
  type ServiceCatalogEntry,
} from '@/lib/actions/service-catalog'
import { CatalogGroupTable, useCatalogToggleMutation } from './catalog-group-table'
import { CatalogAccordionList } from './catalog-accordion-list'
import { CatalogEditSheet, type CatalogFormValues, defaultFormValues } from './catalog-edit-sheet'

// ============================================================
// MAIN COMPONENT
// ============================================================

interface CatalogGroupAccordionProps {
  defaultExpandedTypes?: string[]
}

export function CatalogGroupAccordion({ defaultExpandedTypes }: CatalogGroupAccordionProps) {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState<ServiceCatalogEntry | null>(null)
  const [expandedItems, setExpandedItems] = useState<string[]>(defaultExpandedTypes ?? [])

  const form = useForm<CatalogFormValues>({
    resolver: zodResolver(z.object({
      msn_code: z.string().min(1, 'MSN Code wajib diisi').max(64),
      service_name: z.string().min(1, 'Nama service wajib diisi'),
      unit_type_id: z.string().uuid('Pilih unit type'),
      capacity_id: z.string().uuid('Pilih kapasitas'),
      service_type_id: z.string().uuid('Pilih service type'),
      base_price: z.coerce.number().min(0, 'Harga tidak boleh negatif'),
      duration_minutes: z.coerce.number().int().min(0).optional().nullable(),
      includes_text: z.string().optional(),
      description: z.string().optional(),
      is_active: z.boolean().default(true),
    })),
    defaultValues: defaultFormValues,
  })

  const lookupsQuery = useQuery({
    queryKey: ['catalog-lookups'],
    queryFn: async () => {
      const res = await getCatalogLookups()
      if (!res.success) throw new Error(res.error || 'Gagal memuat data master')
      return res.data!
    },
    staleTime: 5 * 60 * 1000,
  })

  const groupedQuery = useQuery({
    queryKey: ['service-catalog-grouped', { search }],
    queryFn: async () => {
      const res = await getCatalogGrouped({ search: search || undefined })
      if (!res.success) throw new Error(res.error || 'Gagal memuat catalog')
      return res.data!
    },
  })

  const parseIncludes = (text?: string): string[] | null => {
    if (!text) return null
    const arr = text.split(',').flatMap((s) => { const t = s.trim(); return t ? [t] : [] })
    return arr.length > 0 ? arr : null
  }

  const createMutation = useMutation({
    mutationFn: async (values: CatalogFormValues) => {
      const res = await createCatalogEntry({
        msn_code: values.msn_code.trim(), service_name: values.service_name.trim(),
        unit_type_id: values.unit_type_id, capacity_id: values.capacity_id,
        service_type_id: values.service_type_id, base_price: values.base_price,
        duration_minutes: values.duration_minutes ?? null,
        includes: parseIncludes(values.includes_text),
        description: values.description?.trim() || null, is_active: values.is_active,
      })
      if (!res.success) throw new Error(res.error || 'Gagal menyimpan catalog')
      return res.data!
    },
    onSuccess: () => {
      toast({ title: 'Berhasil', description: 'Catalog entry ditambahkan.' })
      queryClient.invalidateQueries({ queryKey: ['service-catalog-grouped'] })
      closeSheet()
    },
    onError: (err: Error) => {
      toast({ variant: 'destructive', title: 'Gagal', description: err.message })
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: CatalogFormValues }) => {
      const res = await updateCatalogEntry(id, {
        msn_code: values.msn_code.trim(), service_name: values.service_name.trim(),
        unit_type_id: values.unit_type_id, capacity_id: values.capacity_id,
        service_type_id: values.service_type_id, base_price: values.base_price,
        duration_minutes: values.duration_minutes ?? null,
        includes: parseIncludes(values.includes_text),
        description: values.description?.trim() || null, is_active: values.is_active,
      })
      if (!res.success) throw new Error(res.error || 'Gagal memperbarui catalog')
      return res.data!
    },
    onSuccess: () => {
      toast({ title: 'Berhasil', description: 'Catalog entry diperbarui.' })
      queryClient.invalidateQueries({ queryKey: ['service-catalog-grouped'] })
      closeSheet()
    },
    onError: (err: Error) => {
      toast({ variant: 'destructive', title: 'Gagal', description: err.message })
    },
  })

  const toggleMutation = useCatalogToggleMutation()

  const openEdit = (entry: ServiceCatalogEntry) => {
    setEditingEntry(entry)
    form.reset({
      msn_code: entry.msn_code, service_name: entry.service_name,
      unit_type_id: entry.unit_type_id, capacity_id: entry.capacity_id,
      service_type_id: entry.service_type_id, base_price: entry.base_price,
      duration_minutes: entry.duration_minutes ?? null,
      includes_text: (entry.includes ?? []).join(', '),
      description: entry.description ?? '', is_active: entry.is_active,
    })
    setIsSheetOpen(true)
  }

  const closeSheet = () => { setIsSheetOpen(false); setEditingEntry(null); form.reset(defaultFormValues) }
  const onSubmit = (values: CatalogFormValues) => {
    if (editingEntry) updateMutation.mutate({ id: editingEntry.catalog_id, values })
    else createMutation.mutate(values)
  }
  const handleSearchSubmit = (e: React.FormEvent) => { e.preventDefault(); setSearch(searchInput.trim()) }

  const groupedData = groupedQuery.data ?? {}
  const groupKeys = Object.keys(groupedData).sort()

  if (groupedQuery.isLoading) {
    return <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => (<div key={i} className="h-12 animate-pulse rounded-lg bg-surface-muted" />))}</div>
  }
  if (groupedQuery.isError) {
    return <EmptyState icon={AlertCircle} title="Gagal memuat catalog" description={(groupedQuery.error as Error)?.message || 'Terjadi kesalahan'} action={{ label: 'Coba lagi', onClick: () => groupedQuery.refetch() }} />
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending
  const lookups = lookupsQuery.data

  return (
    <div className="space-y-4">
      <form onSubmit={handleSearchSubmit} className="w-full sm:max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
            onBlur={() => setSearch(searchInput.trim())} placeholder="Cari MSN Code atau Nama Service..." className="h-10 pl-10" />
        </div>
      </form>

      <CatalogAccordionList groupedData={groupedData} groupKeys={groupKeys}
        expandedItems={expandedItems} onValueChange={setExpandedItems}
        toggleMutation={toggleMutation} onEdit={openEdit} />

      <CatalogEditSheet isOpen={isSheetOpen} editingEntry={editingEntry} form={form}
        lookups={lookups} isSubmitting={isSubmitting} onClose={closeSheet} onSubmit={onSubmit} />
    </div>
  )
}

export default CatalogGroupAccordion
