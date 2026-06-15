import { Trash2, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { MaterialItem } from './material-types'

const CATEGORIES = ['PARTS', 'FREON', 'LABOR', 'TRANSPORTATION', 'OTHER'] as const
const UNITS = ['pcs', 'kg', 'hour', 'visit', 'meter', 'set', 'unit', 'liter'] as const

interface MaterialRowManualProps {
  item: MaterialItem
  index: number
  disabled: boolean
  onRemove: (index: number) => void
  onUpdate: <K extends keyof MaterialItem>(index: number, field: K, fieldValue: string | number | boolean) => void
}

export function MaterialRowManual({
  item,
  index,
  disabled,
  onRemove,
  onUpdate,
}: MaterialRowManualProps) {
  return (
    <div className="space-y-3 border-l-2 border-status-pending pl-3">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-status-pending-bg dark:bg-status-pending-bg px-2.5 py-0.5 text-[10px] font-semibold text-status-pending dark:text-status-pending">
          <Clock className="h-3 w-3" aria-hidden="true" />
          Harga Menunggu Review Admin
        </span>
        {!disabled && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onRemove(index)}
            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-status-cancelled-bg dark:hover:bg-status-cancelled-bg transition-colors"
            aria-label={`Hapus material ${index + 1}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <div>
          <label className="text-xs text-muted-foreground mb-0.5 block">Kategori *</label>
          <Select
            value={item.category || 'PARTS'}
            onValueChange={(val) => onUpdate(index, 'category', val)}
            disabled={disabled}
          >
            <SelectTrigger className="h-10 text-sm">
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

        <div>
          <label className="text-xs text-muted-foreground mb-0.5 block">Nama Part/Material *</label>
          <Input
            placeholder="Nama material baru..."
            value={item.name}
            onChange={(e) => onUpdate(index, 'name', e.target.value)}
            disabled={disabled}
            className="h-10 text-sm font-medium"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground mb-0.5 block">Qty *</label>
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              value={item.qty}
              onChange={(e) => onUpdate(index, 'qty', e.target.value)}
              disabled={disabled}
              className="h-10 text-sm font-medium"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-0.5 block">Satuan *</label>
            <Select
              value={item.unit_of_measure || 'pcs'}
              onValueChange={(val) => onUpdate(index, 'unit_of_measure', val)}
              disabled={disabled}
            >
              <SelectTrigger className="h-10 text-sm">
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
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-0.5 block">Proposed Harga Satuan *</label>
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            step={1000}
            placeholder="Harga penawaran..."
            value={item.unit_price}
            onChange={(e) => onUpdate(index, 'unit_price', e.target.value)}
            disabled={disabled}
            className="h-10 text-sm font-medium"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="text-xs text-muted-foreground mb-0.5 block">Deskripsi/Spesifikasi (Opsional)</label>
          <Input
            placeholder="Keterangan tambahan..."
            value={item.description || ''}
            onChange={(e) => onUpdate(index, 'description', e.target.value)}
            disabled={disabled}
            className="h-10 text-sm"
          />
        </div>
      </div>
    </div>
  )
}
