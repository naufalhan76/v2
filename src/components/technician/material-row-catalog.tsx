import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AddonSearchInput, formatCurrency } from './addon-search-input'
import type { MaterialItem } from './material-types'
import type { AddonOption } from './addon-search-input'

interface MaterialRowCatalogProps {
  item: MaterialItem
  index: number
  addons: AddonOption[]
  disabled: boolean
  onAddonSelect: (index: number, addon: AddonOption) => void
  onRemove: (index: number) => void
  onUpdate: <K extends keyof MaterialItem>(index: number, field: K, fieldValue: string | number | boolean) => void
}

export function MaterialRowCatalog({
  item,
  index,
  addons,
  disabled,
  onAddonSelect,
  onRemove,
  onUpdate,
}: MaterialRowCatalogProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {addons.length > 0 && !disabled ? (
          <AddonSearchInput
            value={item.name}
            addons={addons}
            onSelect={(addon) => onAddonSelect(index, addon)}
            disabled={disabled}
            placeholder="Cari material dari katalog..."
          />
        ) : (
          <Input
            placeholder="Nama material"
            value={item.name}
            onChange={(e) => onUpdate(index, 'name', e.target.value)}
            disabled={disabled}
            className="h-11 sm:h-10 flex-1 text-sm focus-visible:ring-primary font-medium"
          />
        )}
        {!disabled && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onRemove(index)}
            className="h-11 w-11 sm:h-10 sm:w-10 shrink-0 text-destructive hover:text-destructive hover:bg-status-cancelled-bg dark:hover:bg-status-cancelled-bg active:scale-[0.96] transition-transform"
            aria-label={`Hapus material ${index + 1}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      <p className="text-[10px] text-brand-600 dark:text-brand-200 font-medium flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
        Katalog: {item.category || 'PARTS'} ({formatCurrency(item.unit_price)}/{item.unit_of_measure || 'pcs'})
      </p>
      {!item.addon_id && !disabled && (
        <p className="text-xs text-destructive">
          Pilih material aktif dari katalog sebelum mengirim laporan.
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-muted-foreground mb-0.5 block">Qty</label>
          <Input
            type="number"
            inputMode="decimal"
            min="0.1"
            step="0.1"
            value={item.qty}
            onChange={(e) => onUpdate(index, 'qty', e.target.value)}
            disabled={disabled}
            className="h-10 text-sm font-medium"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-0.5 block">Harga Satuan</label>
          <Input
            type="text"
            value={formatCurrency(item.unit_price)}
            disabled
            className="h-10 text-sm bg-surface-muted font-medium"
          />
        </div>
      </div>
    </div>
  )
}
