import { AlertTriangle } from 'lucide-react'
import type { Addon } from '@/lib/actions/addons'

export function isLowStock(addon: Addon) {
  return addon.stock_quantity < addon.minimum_stock
}

interface AddonStockBadgeProps {
  addon: Addon
}

export function AddonStockBadge({ addon }: AddonStockBadgeProps) {
  const lowStock = isLowStock(addon)

  return (
    <div className="flex items-center gap-2">
      <span
        className={
          lowStock
            ? 'text-warning font-semibold'
            : ''
        }
      >
        {addon.stock_quantity}
      </span>
      {lowStock && (
        <AlertTriangle className="h-4 w-4 text-warning" />
      )}
    </div>
  )
}
