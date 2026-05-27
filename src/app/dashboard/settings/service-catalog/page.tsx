'use client'

import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import {
  AlertCircle,
  Pencil,
  Plus,
  Search,
  Wrench,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { EmptyState } from '@/components/ui/empty-state'
import { TableSkeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'

import {
  getCatalog,
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
// PAGE
// ============================================================

export default function ServiceCatalogPage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  // Filters
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [unitTypeFilter, setUnitTypeFilter] = useState<string>('ALL')
  const [serviceTypeFilter, setServiceTypeFilter] = useState<string>('ALL')
  const [activeFilter, setActiveFilter] = useState<string>('ALL')

  // Sheet
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState<ServiceCatalogEntry | null>(null)

  // Table state
  const [sorting, setSorting] = useState<SortingState>([])

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

  // Catalog
  const catalogQuery = useQuery({
    queryKey: ['service-catalog', { search, unitTypeFilter, serviceTypeFilter, activeFilter }],
    queryFn: async () => {
      const res = await getCatalog({
        search: search || undefined,
        unitTypeId: unitTypeFilter !== 'ALL' ? unitTypeFilter : undefined,
        serviceTypeId: serviceTypeFilter !== 'ALL' ? serviceTypeFilter : undefined,
        isActive:
          activeFilter === 'ACTIVE' ? true : activeFilter === 'INACTIVE' ? false : undefined,
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
      queryClient.invalidateQueries({ queryKey: ['service-catalog'] })
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
      queryClient.invalidateQueries({ queryKey: ['service-catalog'] })
      closeSheet()
    },
    onError: (err: Error) => {
      toast({ variant: 'destructive', title: 'Gagal', description: err.message })
    },
  })

  const toggleMutation = useMutation({
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
      queryClient.invalidateQueries({ queryKey: ['service-catalog'] })
    },
    onError: (err: Error) => {
      toast({ variant: 'destructive', title: 'Gagal', description: err.message })
    },
  })

  // Handlers
  const openCreate = () => {
    setEditingEntry(null)
    form.reset(defaultFormValues)
    setIsSheetOpen(true)
  }

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

  // ============================================================
  // TABLE
  // ============================================================

  const data = catalogQuery.data ?? []

  const columns = useMemo<ColumnDef<ServiceCatalogEntry>[]>(
    () => [
      {
        accessorKey: 'msn_code',
        header: 'MSN Code',
        cell: ({ row }) => (
          <span className="font-mono text-sm font-semibold text-primary">
            {row.original.msn_code}
          </span>
        ),
      },
      {
        accessorKey: 'service_name',
        header: 'Nama Service',
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <div className="font-medium">{row.original.service_name}</div>
            {row.original.description && (
              <div className="text-xs text-muted-foreground line-clamp-1">
                {row.original.description}
              </div>
            )}
          </div>
        ),
      },
      {
        id: 'unit_type',
        header: 'Unit Type',
        accessorFn: (row) => row.unit_types?.name ?? '-',
        cell: ({ getValue }) => <span className="text-sm">{getValue<string>()}</span>,
        meta: { className: 'hidden lg:table-cell' },
      },
      {
        id: 'capacity',
        header: 'Kapasitas',
        accessorFn: (row) => row.capacity_ranges?.capacity_label ?? '-',
        cell: ({ getValue }) => <span className="text-sm">{getValue<string>()}</span>,
        meta: { className: 'hidden xl:table-cell' },
      },
      {
        id: 'service_type',
        header: 'Service Type',
        accessorFn: (row) => row.service_types?.name ?? '-',
        cell: ({ getValue }) => (
          <Badge variant="secondary" className="font-normal">
            {getValue<string>()}
          </Badge>
        ),
        meta: { className: 'hidden lg:table-cell' },
      },
      {
        accessorKey: 'base_price',
        header: () => <div className="text-right">Harga Base</div>,
        cell: ({ row }) => (
          <div className="text-right font-medium tabular-nums">
            {formatIDR(row.original.base_price)}
          </div>
        ),
      },
      {
        accessorKey: 'duration_minutes',
        header: () => <div className="text-right">Durasi</div>,
        cell: ({ row }) => (
          <div className="text-right text-sm tabular-nums text-muted-foreground">
            {row.original.duration_minutes != null
              ? `${row.original.duration_minutes} mnt`
              : '-'}
          </div>
        ),
        meta: { className: 'hidden xl:table-cell' },
      },
      {
        accessorKey: 'is_active',
        header: 'Status',
        cell: ({ row }) =>
          row.original.is_active ? (
            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300">
              Aktif
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
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
            <div className="flex items-center justify-end gap-2 sm:gap-3">
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
                onClick={() => openEdit(entry)}
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
    [toggleMutation.isPending, toggleMutation.variables?.id]
  )

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 15 } },
  })

  // ============================================================
  // RENDER
  // ============================================================

  const lookups = lookupsQuery.data
  const isSubmitting = createMutation.isPending || updateMutation.isPending

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-2xl font-bold">Service Catalog</h1>
          <p className="text-sm text-muted-foreground">
            Master data layanan: kombinasi MSN code, unit type, kapasitas, dan harga.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2 w-full sm:w-auto">
          <Plus className="h-4 w-4" />
          Tambah Catalog Entry
        </Button>
      </div>

      <Card className="border-amber-200 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/20">
        <CardContent className="pt-4 flex gap-2 items-start">
          <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-800 dark:text-amber-200">
            Halaman ini menggantikan <strong>Service Pricing</strong> dan{' '}
            <strong>Service Config</strong>. Seluruh data layanan kini terpusat di tabel{' '}
            <code className="rounded bg-amber-100 px-1 py-0.5 text-xs dark:bg-amber-900/40">
              service_catalog
            </code>
            .
          </p>
        </CardContent>
      </Card>

      <Card className="rounded-xl border-border/50 shadow-sm">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <form onSubmit={handleSearchSubmit} className="w-full sm:flex-1 sm:min-w-[240px] space-y-2">
              <Label className="text-xs font-medium">Cari (MSN Code / Nama Service)</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onBlur={() => setSearch(searchInput.trim())}
                  placeholder="Ketik untuk mencari..."
                  className="h-10 pl-10"
                />
              </div>
            </form>

            <div className="grid grid-cols-1 gap-3 sm:flex sm:gap-3">
              <div className="w-full sm:w-[200px] space-y-2">
                <Label className="text-xs font-medium">Unit Type</Label>
                <Select value={unitTypeFilter} onValueChange={setUnitTypeFilter}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Semua" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Semua Unit Type</SelectItem>
                    {lookups?.unitTypes.map((u) => (
                      <SelectItem key={u.unit_type_id} value={u.unit_type_id}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="w-full sm:w-[200px] space-y-2">
                <Label className="text-xs font-medium">Service Type</Label>
                <Select value={serviceTypeFilter} onValueChange={setServiceTypeFilter}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Semua" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Semua Service Type</SelectItem>
                    {lookups?.serviceTypes.map((s) => (
                      <SelectItem key={s.service_type_id} value={s.service_type_id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="w-full sm:w-[160px] space-y-2">
                <Label className="text-xs font-medium">Status</Label>
                <Select value={activeFilter} onValueChange={setActiveFilter}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Semua Status</SelectItem>
                    <SelectItem value="ACTIVE">Aktif</SelectItem>
                    <SelectItem value="INACTIVE">Nonaktif</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border-border/50 shadow-sm">
        <CardContent className="pt-6">
          {catalogQuery.isLoading ? (
            <TableSkeleton rows={8} columns={9} />
          ) : catalogQuery.isError ? (
            <EmptyState
              icon={AlertCircle}
              title="Gagal memuat catalog"
              description={(catalogQuery.error as Error)?.message || 'Terjadi kesalahan'}
              action={{ label: 'Coba lagi', onClick: () => catalogQuery.refetch() }}
            />
          ) : data.length === 0 ? (
            <EmptyState
              icon={Wrench}
              title="Belum ada catalog entry"
              description={
                search || unitTypeFilter !== 'ALL' || serviceTypeFilter !== 'ALL'
                  ? 'Tidak ada hasil untuk filter saat ini.'
                  : 'Tambahkan kombinasi service pertama untuk memulai.'
              }
              action={{ label: 'Tambah Catalog Entry', icon: Plus, onClick: openCreate }}
            />
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg border border-border/50">
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
                      <TableRow key={row.id} className="hover:bg-muted/40">
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

              <div className="flex flex-col items-stretch gap-3 pt-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                <span className="text-center sm:text-left">
                  Menampilkan {table.getRowModel().rows.length} dari {data.length} entry
                </span>
                <div className="flex items-center justify-center gap-2 sm:justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                    className="flex-1 sm:flex-none"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span className="hidden sm:inline">Sebelumnya</span>
                  </Button>
                  <span className="text-xs whitespace-nowrap">
                    Hal. {table.getState().pagination.pageIndex + 1} /{' '}
                    {table.getPageCount() || 1}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage()}
                    className="flex-1 sm:flex-none"
                  >
                    <span className="hidden sm:inline">Selanjutnya</span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ============================================================
          ADD / EDIT SHEET
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
            <SheetTitle>
              {editingEntry ? 'Edit Catalog Entry' : 'Tambah Catalog Entry'}
            </SheetTitle>
            <SheetDescription>
              Lengkapi detail layanan. MSN Code harus unik.
            </SheetDescription>
          </SheetHeader>

          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4 py-6"
            id="catalog-form"
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
              <p className="text-xs text-muted-foreground">
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

            <div className="flex items-center justify-between rounded-lg border border-border/50 p-3">
              <div>
                <Label className="text-sm">Status Aktif</Label>
                <p className="text-xs text-muted-foreground">
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
            <Button type="button" variant="outline" onClick={closeSheet} className="w-full sm:w-auto">
              Batal
            </Button>
            <Button type="submit" form="catalog-form" disabled={isSubmitting} className="w-full sm:w-auto">
              {isSubmitting ? 'Menyimpan...' : editingEntry ? 'Simpan Perubahan' : 'Tambah'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
