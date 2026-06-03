'use client'

import { useCallback, useEffect, useState, useMemo, useRef } from 'react'
import { Plus, Trash2, Package, Search, FilePlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { getActiveAddons } from '@/lib/actions/addons'
import { createAddonRequest } from '@/lib/actions/addon-requests'
import { useToast } from '@/hooks/use-toast'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

export interface MaterialItem {
  addon_id?: string | null
  name: string
  qty: number
  unit_price: number
  total: number
}

interface MaterialInputProps {
  value: MaterialItem[]
  onChange: (materials: MaterialItem[]) => void
  disabled?: boolean
}

interface AddonOption {
  addon_id: string
  item_name: string
  category: string
  unit_price: number
  unit_of_measure: string
}

const CATEGORIES = ['PARTS', 'FREON', 'LABOR', 'TRANSPORTATION', 'OTHER'] as const
const UNITS = ['pcs', 'kg', 'hour', 'visit', 'meter', 'set', 'unit', 'liter'] as const

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function AddonSearchInput({
  value,
  addons,
  onSelect,
  disabled,
  placeholder,
}: {
  value: string
  addons: AddonOption[]
  onSelect: (addon: AddonOption) => void
  disabled?: boolean
  placeholder?: string
}) {
  const [query, setQuery] = useState(value)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setQuery(value)
  }, [value])

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const grouped = useMemo(() => {
    if (!query.trim()) return {} as Record<string, AddonOption[]>
    const q = query.toLowerCase()
    const filtered = addons.filter(
      (a) =>
        a.item_name.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q)
    )
    const groups: Record<string, AddonOption[]> = {}
    filtered.forEach((a) => {
      if (!groups[a.category]) groups[a.category] = []
      groups[a.category].push(a)
    })
    return groups
  }, [addons, query])

  const totalMatches = Object.values(grouped).reduce((s, arr) => s + arr.length, 0)

  return (
    <div ref={ref} className="relative flex-1">
      <Input
        placeholder={placeholder || 'Nama material'}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => { if (query.trim()) setOpen(true) }}
        disabled={disabled}
        className="h-10 flex-1 text-sm pr-8"
      />
      <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />

      {open && totalMatches > 0 && !disabled && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-card border rounded-lg shadow-lg max-h-56 overflow-y-auto">
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category}>
              <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted/50 sticky top-0">
                {category}
              </div>
              {items.map((addon) => (
                <button
                  key={addon.addon_id}
                  type="button"
                  onClick={() => {
                    onSelect(addon)
                    setQuery(addon.item_name)
                    setOpen(false)
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-muted/70 transition-colors flex items-center justify-between gap-2"
                >
                  <span className="font-medium">{addon.item_name}</span>
                  <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                    {formatCurrency(addon.unit_price)}/{addon.unit_of_measure}
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function MaterialInput({ value, onChange, disabled = false }: MaterialInputProps) {
  const [addons, setAddons] = useState<AddonOption[]>([])
  const [addonsLoading, setAddonsLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [requestCategory, setRequestCategory] = useState<string>('PARTS')
  const [requestName, setRequestName] = useState('')
  const [requestUnit, setRequestUnit] = useState<string>('pcs')
  const [requestPrice, setRequestPrice] = useState('')
  const [requestDescription, setRequestDescription] = useState('')
  const [requestSubmitting, setRequestSubmitting] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    getActiveAddons()
      .then((data) => {
        setAddons(data.map((a) => ({
          addon_id: a.addon_id,
          item_name: a.item_name,
          category: a.category,
          unit_price: a.unit_price,
          unit_of_measure: a.unit_of_measure,
        })))
      })
      .catch(() => {
        // Silently fail — free-form input still works
      })
      .finally(() => setAddonsLoading(false))
  }, [])

  const grandTotal = value.reduce((sum, item) => sum + item.total, 0)

  const addRow = useCallback(() => {
    onChange([...value, { addon_id: null, name: '', qty: 1, unit_price: 0, total: 0 }])
  }, [onChange, value])

  const removeRow = useCallback(
    (index: number) => {
      onChange(value.filter((_, i) => i !== index))
    },
    [onChange, value]
  )

  const updateRow = useCallback(
    (index: number, field: keyof MaterialItem, fieldValue: string | number) => {
      const updated = [...value]
      const row = { ...updated[index] }

      if (field === 'name') {
        row.name = fieldValue as string
      } else if (field === 'qty') {
        row.qty = Math.max(1, Number(fieldValue) || 1)
      } else if (field === 'unit_price') {
        row.unit_price = Math.max(0, Number(fieldValue) || 0)
      }

      row.total = row.qty * row.unit_price
      updated[index] = row
      onChange(updated)
    },
    [onChange, value]
  )

  const handleAddonSelect = useCallback(
    (index: number, addon: AddonOption) => {
      const updated = [...value]
      updated[index] = {
        addon_id: addon.addon_id,
        name: addon.item_name,
        qty: Math.max(value[index]?.qty || 1),
        unit_price: addon.unit_price,
        total: (value[index]?.qty || 1) * addon.unit_price,
      }
      onChange(updated)
    },
    [onChange, value]
  )

  const handleRequestSubmit = async () => {
    if (!requestName.trim()) return
    setRequestSubmitting(true)
    const result = await createAddonRequest({
      category: requestCategory,
      item_name: requestName.trim(),
      unit_of_measure: requestUnit,
      proposed_unit_price: requestPrice ? Number(requestPrice) : null,
      description: requestDescription.trim() || null,
    })
    setRequestSubmitting(false)
    if (result.success) {
      toast({
        title: 'Berhasil',
        description: 'Permintaan part dikirim. Menunggu persetujuan admin.',
      })
      setRequestCategory('PARTS')
      setRequestName('')
      setRequestUnit('pcs')
      setRequestPrice('')
      setRequestDescription('')
      setDialogOpen(false)
    } else {
      toast({
        variant: 'destructive',
        title: 'Gagal',
        description: result.error || 'Gagal mengajukan part',
      })
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Material &amp; Sparepart</label>
        {!disabled && (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setDialogOpen(true)}
              className="h-10 px-3 text-xs sm:text-sm transition-colors active:bg-muted/80"
            >
              <FilePlus className="mr-1.5 h-4 w-4" />
              Request Part
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addRow}
              className="h-10 px-3 text-xs sm:text-sm transition-all duration-200 active:scale-[0.96]"
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Tambah
            </Button>
          </div>
        )}
      </div>

      {addonsLoading && value.length === 0 && (
        <div className="flex items-center justify-center py-6 text-center border rounded-lg border-dashed">
          <div className="flex flex-col items-center gap-2">
            <div className="h-5 w-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">Memuat katalog material...</p>
          </div>
        </div>
      )}

      {!addonsLoading && value.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-center border rounded-xl border-dashed bg-muted/10">
          <Package className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium text-foreground">Belum ada material</p>
          {addons.length > 0 && (
            <p className="text-xs text-muted-foreground/70 mt-1 max-w-[200px]">
              Cari dari katalog atau ketik nama material secara manual
            </p>
          )}
          {!disabled && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={addRow}
              className="mt-4 h-10 px-4 text-sm font-medium transition-all duration-200 active:scale-[0.96]"
            >
              <Plus className="mr-2 h-4 w-4" />
              Tambah Material
            </Button>
          )}
        </div>
      )}

      {value.length > 0 && (
        <div className="space-y-2">
          {value.map((item, index) => (
            <div
              key={index}
              className="rounded-xl border bg-card/90 shadow-sm p-4 space-y-3"
            >
              {/* Row 1: Name (with addon search) + delete */}
              <div className="flex items-center gap-2">
                {addons.length > 0 && !disabled ? (
                  <AddonSearchInput
                    value={item.name}
                    addons={addons}
                    onSelect={(addon) => handleAddonSelect(index, addon)}
                    disabled={disabled}
                    placeholder="Cari material dari katalog..."
                  />
                ) : (
                  <Input
                    placeholder="Nama material"
                    value={item.name}
                    onChange={(e) => updateRow(index, 'name', e.target.value)}
                    disabled={disabled}
                    className="h-11 sm:h-10 flex-1 text-sm focus-visible:ring-primary"
                  />
                )}
                {!disabled && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeRow(index)}
                    className="h-11 w-11 sm:h-10 sm:w-10 shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10 active:scale-[0.96] transition-transform"
                    aria-label={`Hapus material ${index + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {item.addon_id && (
                <p className="text-[10px] text-primary/70 font-medium">
                  Dari katalog — harga otomatis
                </p>
              )}

              {/* Row 2: Qty + Unit Price */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground mb-0.5 block">Qty</label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={item.qty}
                    onChange={(e) => updateRow(index, 'qty', e.target.value)}
                    disabled={disabled}
                    className="h-10 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-0.5 block">Harga Satuan</label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={1000}
                    value={item.unit_price}
                    onChange={(e) => updateRow(index, 'unit_price', e.target.value)}
                    disabled={disabled}
                    className="h-10 text-sm"
                  />
                </div>
              </div>

              {/* Row 3: Subtotal */}
              <div className="text-right text-sm">
                <span className="text-muted-foreground">Subtotal: </span>
                <span className="font-medium">{formatCurrency(item.total)}</span>
              </div>
            </div>
          ))}

          {/* Grand total */}
          <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
            <span className="text-sm font-medium">Total Material</span>
            <span className="text-sm font-bold">{formatCurrency(grandTotal)}</span>
          </div>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request Part Baru</DialogTitle>
            <DialogDescription>
              Ajukan part yang belum ada di katalog untuk disetujui admin.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="req-category">Kategori</Label>
              <Select value={requestCategory} onValueChange={setRequestCategory}>
                <SelectTrigger id="req-category" className="h-10 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="req-name">Nama Item</Label>
              <Input
                id="req-name"
                placeholder="Nama part / material"
                value={requestName}
                onChange={(e) => setRequestName(e.target.value)}
                className="h-10 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="req-unit">Satuan</Label>
              <Select value={requestUnit} onValueChange={setRequestUnit}>
                <SelectTrigger id="req-unit" className="h-10 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNITS.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="req-price">Perkiraan Harga Satuan (opsional)</Label>
              <Input
                id="req-price"
                type="number"
                inputMode="numeric"
                min={0}
                step={1000}
                placeholder="0"
                value={requestPrice}
                onChange={(e) => setRequestPrice(e.target.value)}
                className="h-10 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="req-desc">Deskripsi (opsional)</Label>
              <Textarea
                id="req-desc"
                placeholder="Spesifikasi atau catatan tambahan"
                value={requestDescription}
                onChange={(e) => setRequestDescription(e.target.value)}
                className="min-h-[80px] text-sm"
              />
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Part yang diajukan akan masuk katalog setelah disetujui admin. Untuk sekarang kamu tetap bisa mengetik material manual di form.
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDialogOpen(false)}
              disabled={requestSubmitting}
              className="h-9 text-sm"
            >
              Batal
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleRequestSubmit}
              disabled={requestSubmitting || !requestName.trim()}
              className="h-9 text-sm"
            >
              {requestSubmitting ? 'Mengirim...' : 'Kirim Permintaan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
