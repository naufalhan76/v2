'use client'

import { useCallback } from 'react'
import { Plus, Trash2, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

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

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function MaterialInput({ value, onChange, disabled = false }: MaterialInputProps) {
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

      // Recalculate total
      row.total = row.qty * row.unit_price
      updated[index] = row
      onChange(updated)
    },
    [onChange, value]
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Material &amp; Sparepart</label>
        {!disabled && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addRow}
            className="h-8 text-xs"
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Tambah
          </Button>
        )}
      </div>

      {value.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 text-center border rounded-lg border-dashed">
          <Package className="h-8 w-8 text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">Belum ada material</p>
          {!disabled && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={addRow}
              className="mt-2 h-9 text-xs"
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Tambah Material
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {value.map((item, index) => (
            <div
              key={index}
              className="rounded-lg border bg-card p-3 space-y-2"
            >
              {/* Row 1: Name + delete */}
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Nama material"
                  value={item.name}
                  onChange={(e) => updateRow(index, 'name', e.target.value)}
                  disabled={disabled}
                  className="h-10 flex-1 text-sm"
                />
                {!disabled && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeRow(index)}
                    className="h-10 w-10 shrink-0 text-destructive hover:text-destructive"
                    aria-label={`Hapus material ${index + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

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
    </div>
  )
}
