'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { ArrowLeft, ArrowRight, Plus } from 'lucide-react'

import { formatCurrency } from './format'
import { LineItemEditor } from './line-item-editor'
import type { AddOnsStepProps } from './types'

export function AddOnsStep({
  addons,
  selectedAddon,
  addonQuantity,
  lineItems,
  onSelectedAddonChange,
  onAddonQuantityChange,
  onAddAddon,
  onRemoveItem,
  onPrevious,
  onNext,
}: AddOnsStepProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 3: Tambah Add-ons</CardTitle>
        <CardDescription>Tambahkan parts, freon, atau add-ons lainnya</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
          <div className="flex-1">
            <Label>Add-on</Label>
            {addons.length > 3 ? (
              <SearchableSelect
                options={addons.map((addon) => ({
                  id: addon.addon_id,
                  label: addon.item_name,
                  secondaryLabel: formatCurrency(addon.unit_price),
                }))}
                value={selectedAddon}
                onValueChange={onSelectedAddonChange}
                placeholder="Pilih add-on"
                searchPlaceholder="Cari add-on..."
              />
            ) : (
              <Select value={selectedAddon} onValueChange={onSelectedAddonChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih add-on" />
                </SelectTrigger>
                <SelectContent>
                  {addons.map((addon) => (
                    <SelectItem key={addon.addon_id} value={addon.addon_id}>
                      {addon.item_name} - {formatCurrency(addon.unit_price)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="flex gap-2 sm:gap-4 sm:items-end">
            <div className="flex-1 sm:w-32">
              <Label>Quantity</Label>
              <Input
                type="number"
                value={addonQuantity}
                onChange={(e) => onAddonQuantityChange(parseInt(e.target.value) || 1)}
                min="1"
              />
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                onClick={onAddAddon}
                disabled={!selectedAddon}
                className="min-h-[44px] min-w-[44px]"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <LineItemEditor lineItems={lineItems} onRemoveItem={onRemoveItem} />

        <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-2">
          <Button type="button" variant="outline" onClick={onPrevious} className="min-h-[44px]">
            <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
          </Button>
          <Button type="button" onClick={onNext} className="min-h-[44px]">
            Lanjut <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
