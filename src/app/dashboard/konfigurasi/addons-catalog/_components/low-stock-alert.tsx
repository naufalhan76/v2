import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle } from 'lucide-react'
import type { Addon } from '@/lib/actions/addons'

interface LowStockAlertProps {
  addons: Addon[]
}

export function LowStockAlert({ addons }: LowStockAlertProps) {
  if (addons.length === 0) return null

  return (
    <Card className="rounded-xl border border-border/50 shadow-sm bg-status-pending-bg dark:bg-status-pending-bg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg font-semibold text-warning dark:text-warning">
          <AlertTriangle className="h-5 w-5" />
          Stok Rendah
        </CardTitle>
        <CardDescription>
          {addons.length} item memiliki stok di bawah minimum
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {addons.slice(0, 3).map((addon) => (
            <div key={addon.addon_id} className="flex items-center justify-between text-sm">
              <span className="font-medium">{addon.item_name}</span>
              <span className="text-muted-foreground">
                Stok: {addon.stock_quantity} / Min: {addon.minimum_stock}
              </span>
            </div>
          ))}
          {addons.length > 3 && (
            <p className="text-sm text-muted-foreground">
              +{addons.length - 3} item lainnya
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
