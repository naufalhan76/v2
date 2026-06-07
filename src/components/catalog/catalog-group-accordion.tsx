'use client'

import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { AlertCircle, Pencil, Search, Wrench } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { EmptyState } from '@/components/ui/empty-state'
import { useToast } from '@/hooks/use-toast'

import {
  getCatalogGrouped,
  getCatalogLookups,
  createCatalogEntry,
  updateCatalogEntry,
  toggleCatalogActive,
  type ServiceCatalogEntry,
} from '@/lib/actions/service-catalog'

// ============================================================
// VALIDATION
// ============================================================

const catalogFormSchema = z.object({
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
})

type CatalogFormValues = z.infer<typeof catalogFormSchema>

const defaultFormValues: CatalogFormValues = {
  msn_code: '',
  service_name: '',
  unit_type_id: '',
  capacity_id: '',
  service_type_id: '',
  base_price: 0,
  duration_minutes: null,
  includes_text: '',
  description: '',
  is_active: true,
}

// ============================================================
// HELPERS
// ============================================================

const formatIDR = (value: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(value || 0)

const parseIncludes = (text?: string): string[] | null => {
  if (!text) return null
  const arr = text
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return arr.length > 0 ? arr : null
}

// ============================================================
// PROPS
// ============================================================

interface CatalogGroupAccordionProps {
  defaultExpandedTypes?: string[]
}

// ============================================================
// GROUP TABLE
// ============================================================

interface GroupTableProps {
  data: ServiceCatalogEntry[]
  onEdit: (entry: ServiceCatalogEntry) => void
  toggleMutation: ReturnType<typeof useToggleMutation>
}

function GroupTable({ data, onEdit, toggleMutation }: GroupTableProps) {
  const columns = useMemo<ColumnDef<ServiceCatalogEntry>[]>(
    () => [
      {
        accessorKey: 'msn_code',
        header: 'MSN Code',
        cell: ({ row }) => (
          <span className="font-mono text-lg text-foreground">
            {row.original.msn_code}
          </span>
        ),
      },
      {
        accessorKey: 'service_name',
        header: 'Nama Service',
        cell: ({ row }) => <span className="text-lg text-foreground">{row.original.service_name}</span>,
      },
      {
        id: 'capacity',
        header: 'Kapasitas',
        accessorFn: (row) => row.capacity_ranges?.capacity_label ?? '-',
        cell: ({ getValue }) => (
          <span className="text-lg text-foreground">{getValue<string>()}</span>
        ),
      },
      {
        id: 'service_type',
        header: 'Service Type',
        accessorFn: (row) => row.service_types?.code ?? '-',
        cell: ({ getValue }) => (
            <Badge variant="outline" className="font-normal bg-canvas-soft text-foreground border-hairline">
              {getValue<string>()}
            </Badge>
        ),
      },
      {
        accessorKey: 'base_price',
        header: () => <div className="text-right">Harga Base</div>,
        cell: ({ row }) => (
          <div className="text-right font-bold text-xl tabular-nums text-foreground">
            {formatIDR(row.original.base_price)}
          </div>
        ),
      },
      {
        accessorKey: 'is_active',
        header: 'Status',
        cell: ({ row }) =>
          row.original.is_active ? (
            <Badge className="bg-status-completed/10 text-status-completed border-status-completed/20 hover:bg-status-completed/10">
              Aktif
            </Badge>
          ) : (
            <Badge variant="outline" className="text-ink-mute border-hairline">
              Nonaktif
            </Badge>
          ),
      },
      {
        id: 'actions',
        header: () => <div className="text-right">Aksi</div>,
        cell: ({ row }) => {
          const entry = row.original
          const isToggling =
            toggleMutation.isPending && toggleMutation.variables?.id === entry.catalog_id
          return (
            <div className="flex items-center justify-end gap-2">
              <Switch
                checked={entry.is_active}
                disabled={isToggling}
                onCheckedChange={(checked) =>
                  toggleMutation.mutate({ id: entry.catalog_id, isActive: checked })
                }
                aria-label="Toggle aktif"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(entry)}
                aria-label="Edit"
                className="min-h-[44px] min-w-[44px] sm:min-h-9 sm:min-w-9"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
          )
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [toggleMutation.isPending, toggleMutation.variables?.id, onEdit]
  )

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="overflow-x-auto rounded-lg border border-hairline">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((h) => {
                const meta = h.column.columnDef.meta as
                  | { className?: string }
                  | undefined
                return (
                  <TableHead key={h.id} className={meta?.className}>
                    {h.isPlaceholder
                      ? null
                      : flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                )
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id} className="hover:bg-canvas-soft">
              {row.getVisibleCells().map((cell) => {
                const meta = cell.column.columnDef.meta as
                  | { className?: string }
                  | undefined
                return (
                  <TableCell key={cell.id} className={meta?.className}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                )
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

// ============================================================
// TOGGLE MUTATION HOOK (type helper)
// ============================================================

function useToggleMutation() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await toggleCatalogActive(id, isActive)
      if (!res.success) throw new Error(res.error || 'Gagal mengubah status')
      return res.data!
    },
    onSuccess: (_, vars) => {
      toast({
        title: 'Status diperbarui',
        description: vars.isActive ? 'Catalog diaktifkan.' : 'Catalog dinonaktifkan.',
      })
      queryClient.invalidateQueries({ queryKey: ['service-catalog-grouped'] })
    },
    onError: (err: Error) => {
      toast({ variant: 'destructive', title: 'Gagal', description: err.message })
    },
  })
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export function CatalogGroupAccordion({ defaultExpandedTypes }: CatalogGroupAccordionProps) {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  // Search
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')

  // Sheet
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState<ServiceCatalogEntry | null>(null)

  // Accordion state
  const [expandedItems, setExpandedItems] = useState<string[]>(defaultExpandedTypes ?? [])

  const form = useForm<CatalogFormValues>({
    resolver: zodResolver(catalogFormSchema),
    defaultValues: defaultFormValues,
  })

  // Lookups
  const lookupsQuery = useQuery({
    queryKey: ['catalog-lookups'],
    queryFn: async () => {
      const res = await getCatalogLookups()
      if (!res.success) throw new Error(res.error || 'Gagal memuat data master')
      return res.data!
    },
    staleTime: 5 * 60 * 1000,
  })

  // Grouped catalog
  const groupedQuery = useQuery({
    queryKey: ['service-catalog-grouped', { search }],
    queryFn: async () => {
      const res = await getCatalogGrouped({
        search: search || undefined,
      })
      if (!res.success) throw new Error(res.error || 'Gagal memuat catalog')
      return res.data!
    },
  })

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (values: CatalogFormValues) => {
      const res = await createCatalogEntry({
        msn_code: values.msn_code.trim(),
        service_name: values.service_name.trim(),
        unit_type_id: values.unit_type_id,
        capacity_id: values.capacity_id,
        service_type_id: values.service_type_id,
        base_price: values.base_price,
        duration_minutes: values.duration_minutes ?? null,
        includes: parseIncludes(values.includes_text),
        description: values.description?.trim() || null,
        is_active: values.is_active,
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
        msn_code: values.msn_code.trim(),
        service_name: values.service_name.trim(),
        unit_type_id: values.unit_type_id,
        capacity_id: values.capacity_id,
        service_type_id: values.service_type_id,
        base_price: values.base_price,
        duration_minutes: values.duration_minutes ?? null,
        includes: parseIncludes(values.includes_text),
        description: values.description?.trim() || null,
        is_active: values.is_active,
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

  const toggleMutation = useToggleMutation()

  // Handlers
  const openEdit = (entry: ServiceCatalogEntry) => {
    setEditingEntry(entry)
    form.reset({
      msn_code: entry.msn_code,
      service_name: entry.service_name,
      unit_type_id: entry.unit_type_id,
      capacity_id: entry.capacity_id,
      service_type_id: entry.service_type_id,
      base_price: entry.base_price,
      duration_minutes: entry.duration_minutes ?? null,
      includes_text: (entry.includes ?? []).join(', '),
      description: entry.description ?? '',
      is_active: entry.is_active,
    })
    setIsSheetOpen(true)
  }

  const closeSheet = () => {
    setIsSheetOpen(false)
    setEditingEntry(null)
    form.reset(defaultFormValues)
  }

  const onSubmit = (values: CatalogFormValues) => {
    if (editingEntry) {
      updateMutation.mutate({ id: editingEntry.catalog_id, values })
    } else {
      createMutation.mutate(values)
    }
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSearch(searchInput.trim())
  }

  // Filtered capacities by selected unit type in form
  const watchedUnitTypeId = form.watch('unit_type_id')
  const formCapacities = useMemo(() => {
    if (!lookupsQuery.data) return []
    return lookupsQuery.data.capacityRanges.filter(
      (c) => c.unit_type_id === watchedUnitTypeId
    )
  }, [lookupsQuery.data, watchedUnitTypeId])

  // Data
  const groupedData = groupedQuery.data ?? {}
  const groupKeys = Object.keys(groupedData).sort()

  // ============================================================
  // RENDER
  // ============================================================

  if (groupedQuery.isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-lg bg-canvas-soft" />
        ))}
      </div>
    )
  }

  if (groupedQuery.isError) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Gagal memuat catalog"
        description={(groupedQuery.error as Error)?.message || 'Terjadi kesalahan'}
        action={{ label: 'Coba lagi', onClick: () => groupedQuery.refetch() }}
      />
    )
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending
  const lookups = lookupsQuery.data

  return (
    <div className="space-y-4">
      {/* SEARCH */}
      <form onSubmit={handleSearchSubmit} className="w-full sm:max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onBlur={() => setSearch(searchInput.trim())}
            placeholder="Cari MSN Code atau Nama Service..."
            className="h-10 pl-10"
          />
        </div>
      </form>

      {/* EMPTY STATE */}
      {groupKeys.length === 0 && (
        <EmptyState
          icon={Wrench}
          title="Tidak ada catalog entry"
          description={
            search
              ? 'Tidak ada hasil untuk pencarian saat ini.'
              : 'Belum ada data catalog.'
          }
        />
      )}

      {/* ACCORDION */}
      <Accordion
        type="multiple"
        value={expandedItems}
        onValueChange={setExpandedItems}
        className="space-y-2"
      >
        {groupKeys.map((groupName) => {
          const entries = groupedData[groupName]
          const entryCount = entries?.length ?? 0

          return (
            <AccordionItem
              key={groupName}
              value={groupName}
              className="rounded-xl border border-hairline shadow-sm"
            >
              <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-canvas-soft rounded-t-xl [&[data-state=open]]:border-b [&[data-state=open]]:border-hairline">
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-[460]">{groupName}</span>
                  <Badge variant="secondary" className="text-sm font-mono">
                    {entryCount}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 py-2">
                <GroupTable
                  data={entries}
                  onEdit={openEdit}
                  toggleMutation={toggleMutation}
                />
              </AccordionContent>
            </AccordionItem>
          )
        })}
      </Accordion>

      {/* ============================================================
          EDIT SHEET
          ============================================================ */}
      <Sheet
        open={isSheetOpen}
        onOpenChange={(open) => {
          if (!open) closeSheet()
          else setIsSheetOpen(true)
        }}
      >
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto p-4 sm:p-6">
          <SheetHeader>
            <SheetTitle>Edit Catalog Entry</SheetTitle>
            <SheetDescription>
              Lengkapi detail layanan. MSN Code harus unik.
            </SheetDescription>
          </SheetHeader>

          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4 py-6"
            id="catalog-group-accordion-form"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>MSN Code *</Label>
                <Input
                  {...form.register('msn_code')}
                  placeholder="CARERA001"
                  className="h-10 font-mono"
                />
                {form.formState.errors.msn_code && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.msn_code.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Base Price (IDR) *</Label>
                <Input
                  type="number"
                  min={0}
                  step={1000}
                  {...form.register('base_price')}
                  placeholder="150000"
                  className="h-10"
                />
                {form.formState.errors.base_price && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.base_price.message}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Nama Service *</Label>
              <Input
                {...form.register('service_name')}
                placeholder="Jasa Service Room Air (Checking)"
                className="h-10"
              />
              {form.formState.errors.service_name && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.service_name.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Unit Type *</Label>
                <Select
                  value={form.watch('unit_type_id')}
                  onValueChange={(v) => {
                    form.setValue('unit_type_id', v, { shouldValidate: true })
                    form.setValue('capacity_id', '')
                  }}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Pilih" />
                  </SelectTrigger>
                  <SelectContent>
                    {lookups?.unitTypes.map((u) => (
                      <SelectItem key={u.unit_type_id} value={u.unit_type_id}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.unit_type_id && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.unit_type_id.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Kapasitas *</Label>
                <Select
                  value={form.watch('capacity_id')}
                  onValueChange={(v) =>
                    form.setValue('capacity_id', v, { shouldValidate: true })
                  }
                  disabled={!watchedUnitTypeId}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Pilih" />
                  </SelectTrigger>
                  <SelectContent>
                    {formCapacities.map((c) => (
                      <SelectItem key={c.capacity_id} value={c.capacity_id}>
                        {c.capacity_label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.capacity_id && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.capacity_id.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Service Type *</Label>
                <Select
                  value={form.watch('service_type_id')}
                  onValueChange={(v) =>
                    form.setValue('service_type_id', v, { shouldValidate: true })
                  }
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Pilih" />
                  </SelectTrigger>
                  <SelectContent>
                    {lookups?.serviceTypes.map((s) => (
                      <SelectItem key={s.service_type_id} value={s.service_type_id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.service_type_id && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.service_type_id.message}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Durasi (menit)</Label>
              <Input
                type="number"
                min={0}
                {...form.register('duration_minutes')}
                placeholder="60"
                className="h-10"
              />
            </div>

            <div className="space-y-2">
              <Label>Includes</Label>
              <Input
                {...form.register('includes_text')}
                placeholder="Cek freon, bersihkan filter, test kebocoran"
                className="h-10"
              />
              <p className="text-xs text-ink-mute">
                Pisahkan dengan koma untuk multiple item.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Deskripsi</Label>
              <Textarea
                {...form.register('description')}
                placeholder="Keterangan tambahan..."
                rows={3}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-hairline p-3">
              <div>
                <Label className="text-sm">Status Aktif</Label>
                <p className="text-xs text-ink-mute">
                  Catalog nonaktif tidak akan muncul saat membuat order baru.
                </p>
              </div>
              <Switch
                checked={form.watch('is_active')}
                onCheckedChange={(c) => form.setValue('is_active', c)}
              />
            </div>
          </form>

          <SheetFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={closeSheet}
              className="w-full sm:w-auto"
            >
              Batal
            </Button>
            <Button
              type="submit"
              form="catalog-group-accordion-form"
              disabled={isSubmitting}
              className="w-full sm:w-auto"
            >
              {isSubmitting ? 'Menyimpan...' : 'Simpan Perubahan'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}

export default CatalogGroupAccordion
