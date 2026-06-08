'use client'

import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Trash2 } from 'lucide-react'

import { formatCurrency } from './format'
import type { LineItemEditorProps } from './types'

export function LineItemEditor({ lineItems, onRemoveItem }: LineItemEditorProps) {
  if (lineItems.length === 0) return null

  return (
    <>
      <div className="md:hidden space-y-2">
        {lineItems.map((item, index) => (
          <div key={index} className="rounded-lg border p-3 space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <div className="font-medium text-sm flex-1 min-w-0 break-words">
                {item.description}
              </div>
              {item.type === 'ADDON' && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemoveItem(index)}
                  className="shrink-0 min-h-[44px] min-w-[44px]"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                {item.quantity} × {formatCurrency(item.unitPrice)}
              </span>
              <span className="font-semibold text-foreground">
                {formatCurrency(item.total)}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="hidden md:block data-table-container">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead>Harga</TableHead>
              <TableHead>Total</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lineItems.map((item, index) => (
              <TableRow key={index}>
                <TableCell>{item.description}</TableCell>
                <TableCell>{item.quantity}</TableCell>
                <TableCell className="whitespace-nowrap">{formatCurrency(item.unitPrice)}</TableCell>
                <TableCell className="font-semibold whitespace-nowrap">
                  {formatCurrency(item.total)}
                </TableCell>
                <TableCell>
                  {item.type === 'ADDON' && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemoveItem(index)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  )
}
