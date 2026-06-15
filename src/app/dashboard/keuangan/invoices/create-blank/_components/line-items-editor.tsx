'use client'

import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { LineItemsEditorProps } from './types'

export function LineItemsEditor({
  fields,
  watchedItems,
  errors,
  register,
  setValue,
  watch,
  append,
  remove,
  formatCurrency,
}: LineItemsEditorProps) {
  return (
    <div className="space-y-4">
      {fields.length === 0 && (
        <p className="text-sm text-muted-foreground italic">
          Belum ada item. Klik &quot;Tambah Item&quot;.
        </p>
      )}

      {fields.map((field, index) => {
        const qty = Number(watchedItems?.[index]?.quantity) || 0
        const price = Number(watchedItems?.[index]?.unit_price) || 0
        const lineTotal = qty * price

        return (
          <div
            key={field.id}
            className="grid gap-3 rounded-lg border p-4 grid-cols-1 md:grid-cols-12"
          >
            <div className="space-y-1 md:col-span-2">
              <Label className="text-xs">Tipe</Label>
              <Select
                value={watch(`items.${index}.item_type`)}
                onValueChange={(value: 'BASE_SERVICE' | 'ADDON') =>
                  setValue(`items.${index}.item_type`, value, {
                    shouldValidate: true,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BASE_SERVICE">Layanan</SelectItem>
                  <SelectItem value="ADDON">Add-on</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1 md:col-span-5">
              <Label className="text-xs">Deskripsi</Label>
              <Input
                placeholder="Deskripsi item"
                {...register(`items.${index}.description` as const)}
              />
              {errors.items?.[index]?.description && (
                <p className="text-xs text-destructive">
                  {errors.items[index]?.description?.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3 md:contents">
              <div className="space-y-1 md:col-span-1">
                <Label className="text-xs">Qty</Label>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  {...register(`items.${index}.quantity` as const, {
                    valueAsNumber: true,
                  })}
                />
                {errors.items?.[index]?.quantity && (
                  <p className="text-xs text-destructive">
                    {errors.items[index]?.quantity?.message}
                  </p>
                )}
              </div>

              <div className="space-y-1 md:col-span-2">
                <Label className="text-xs">Harga Satuan</Label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  {...register(`items.${index}.unit_price` as const, {
                    valueAsNumber: true,
                  })}
                />
                {errors.items?.[index]?.unit_price && (
                  <p className="text-xs text-destructive">
                    {errors.items[index]?.unit_price?.message}
                  </p>
                )}
              </div>

              <div className="space-y-1 md:col-span-1">
                <Label className="text-xs">Subtotal</Label>
                <div className="flex h-9 items-center text-sm font-medium">
                  {formatCurrency(lineTotal)}
                </div>
              </div>
            </div>

            <div className="flex md:col-span-1 md:items-end justify-end">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => remove(index)}
                disabled={fields.length <= 1}
                aria-label="Hapus item"
                className="min-h-[44px] min-w-[44px]"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        )
      })}

      {errors.items && typeof errors.items.message === 'string' && (
        <p className="text-sm text-destructive">{errors.items.message}</p>
      )}
    </div>
  )
}
