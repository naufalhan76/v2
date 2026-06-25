'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus, Package, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getActiveAddons } from '@/lib/actions/addons'
import { MaterialRowCatalog } from './material-row-catalog'
import { MaterialRowManual } from './material-row-manual'
import { MaterialRequestDialog } from './material-request-dialog'
import type { MaterialItem } from './material-types'
import type { AddonOption } from './addon-search-input'

export type { MaterialItem } from './material-types'

interface MaterialInputProps {
  value: MaterialItem[]
  onChange: (materials: MaterialItem[]) => void
  disabled?: boolean
}

export function mergeCatalogAddonSelection(
  materials: MaterialItem[],
  index: number,
  addon: AddonOption
): MaterialItem[] {
  const currentQty = Math.max(materials[index]?.qty || 1, 1)
  const existingIndex = materials.findIndex(
    (item, itemIndex) => itemIndex !== index && !item.is_manual && item.addon_id === addon.addon_id,
  )
  if (existingIndex >= 0) {
    const updated = materials.filter((_, itemIndex) => itemIndex !== index)
    const targetIndex = existingIndex > index ? existingIndex - 1 : existingIndex
    const existing = updated[targetIndex]
    const qty = Math.max(existing.qty || 1, 1) + currentQty
    updated[targetIndex] = { ...existing, addon_id: addon.addon_id, name: addon.item_name, qty, unit_price: addon.unit_price, total: qty * addon.unit_price, category: addon.category, unit_of_measure: addon.unit_of_measure, description: null, is_manual: false }
    return updated
  }
  const updated = [...materials]
  updated[index] = { addon_id: addon.addon_id, name: addon.item_name, qty: currentQty, unit_price: addon.unit_price, total: currentQty * addon.unit_price, category: addon.category, unit_of_measure: addon.unit_of_measure, description: null, is_manual: false }
  return updated
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)
}

export function MaterialInput({ value, onChange, disabled = false }: MaterialInputProps) {
  const [addons, setAddons] = useState<AddonOption[]>([])
  const [addonsLoading, setAddonsLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)

  useEffect(() => {
    getActiveAddons().then((data) => {
      setAddons(data.map((a) => ({ addon_id: a.addon_id, item_name: a.item_name, category: a.category, unit_price: a.unit_price, unit_of_measure: a.unit_of_measure })))
    }).catch(() => { /* Silently fail */ }).finally(() => setAddonsLoading(false))
  }, [])

  const grandTotal = value.reduce((sum, item) => sum + item.total, 0)

  const addRow = useCallback(() => {
    onChange([...value, { addon_id: null, name: '', qty: 1, unit_price: 0, total: 0, category: 'PARTS', unit_of_measure: 'pcs', description: '', is_manual: true }])
  }, [onChange, value])

  const addCatalogRow = useCallback(() => {
    onChange([...value, { addon_id: null, name: '', qty: 1, unit_price: 0, total: 0, category: 'PARTS', unit_of_measure: 'pcs', description: '', is_manual: false }])
  }, [onChange, value])

  const removeRow = useCallback((index: number) => { onChange(value.filter((_, i) => i !== index)) }, [onChange, value])

  const updateRow = useCallback(
    <K extends keyof MaterialItem>(index: number, field: K, fieldValue: string | number | boolean) => {
      const updated = [...value]
      const row = { ...updated[index] }
      if (field === 'name') row.name = String(fieldValue)
      else if (field === 'qty') row.qty = Math.max(1, Number(fieldValue) || 1)
      else if (field === 'unit_price') row.unit_price = Math.max(0, Number(fieldValue) || 0)
      else if (field === 'category') row.category = String(fieldValue)
      else if (field === 'unit_of_measure') row.unit_of_measure = String(fieldValue)
      else if (field === 'description') row.description = String(fieldValue)
      else if (field === 'is_manual') row.is_manual = Boolean(fieldValue)
      row.total = row.qty * row.unit_price
      updated[index] = row
      onChange(updated)
    },
    [onChange, value],
  )

  const handleAddonSelect = useCallback((index: number, addon: AddonOption) => {
    onChange(mergeCatalogAddonSelection(value, index, addon))
  }, [onChange, value])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Material &amp; Sparepart</label>
        {!disabled && (
          <div className="flex items-center gap-2">
            <Button type="button" variant="default" size="sm" onClick={addCatalogRow} className="h-10 px-3 text-xs sm:text-sm transition-all duration-200 active:scale-[0.96]">
              <Search className="mr-1.5 h-4 w-4" /> Katalog
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={addRow} className="h-10 px-3 text-xs sm:text-sm transition-all duration-200 active:scale-[0.96]">
              <Plus className="mr-1.5 h-4 w-4" /> Manual
            </Button>
          </div>
        )}
      </div>

      {addonsLoading && value.length === 0 && (
        <div className="flex items-center justify-center py-6 text-center border rounded-lg border-dashed dark:border-border">
          <div className="flex flex-col items-center gap-2">
            <div className="h-5 w-5 border-2 border-brand-200 border-t-indigo-600 dark:border-primary dark:border-t-indigo-400 rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">Memuat katalog material...</p>
          </div>
        </div>
      )}

      {!addonsLoading && value.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-center border rounded-lg border-dashed border-border dark:border-border bg-surface-muted dark:bg-surface">
          <Package className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm font-medium text-foreground">Belum ada material</p>
          {addons.length > 0 && <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">Cari dari katalog atau tambah manual part penawaran</p>}
          {!disabled && (
            <div className="flex flex-col sm:flex-row gap-2 mt-4">
              <Button type="button" variant="default" size="sm" onClick={addCatalogRow} className="h-10 px-4 text-sm font-medium transition-all duration-200 active:scale-[0.96]">
                <Search className="mr-2 h-4 w-4" /> Dari Katalog
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={addRow} className="h-10 px-4 text-sm font-medium transition-all duration-200 active:scale-[0.96]">
                <Plus className="mr-2 h-4 w-4" /> Tambah Manual
              </Button>
            </div>
          )}
        </div>
      )}

      {value.length > 0 && (
        <div className="space-y-2">
          {value.map((item, index) => (
            <div key={index} className="rounded-lg border border-border bg-background p-4 space-y-3">
              {!item.is_manual ? (
                <MaterialRowCatalog item={item} index={index} addons={addons} disabled={disabled} onAddonSelect={handleAddonSelect} onRemove={removeRow} onUpdate={updateRow} />
              ) : (
                <MaterialRowManual item={item} index={index} disabled={disabled} onRemove={removeRow} onUpdate={updateRow} />
              )}
              <div className="text-right text-sm border-t pt-2 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Subtotal item {index + 1}:</span>
                <span className="font-semibold">{formatCurrency(item.total)}</span>
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between rounded-lg bg-surface-muted dark:bg-surface px-3 py-2">
            <span className="text-sm font-medium">Total Material</span>
            <span className="text-sm font-bold text-primary">{formatCurrency(grandTotal)}</span>
          </div>
        </div>
      )}

      <MaterialRequestDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  )
}
