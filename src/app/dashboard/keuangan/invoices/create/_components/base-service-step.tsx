'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, ArrowRight } from 'lucide-react'

import { getBaseServiceItems } from '../line-items'
import { formatCurrency } from './format'
import type { BaseServiceStepProps } from './types'

export function BaseServiceStep({
  baseService,
  lineItems,
  onUpdateQuantity,
  onUpdatePrice,
  onPrevious,
  onNext,
}: BaseServiceStepProps) {
  const bs = baseService as Record<string, unknown> | null
  const baseServiceItems = getBaseServiceItems(lineItems)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 2: Base Service</CardTitle>
        <CardDescription>Konfirmasi harga base service</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!bs && baseServiceItems.length === 0 ? (
          <div className="text-sm text-muted-foreground italic">
            Memuat base service...
          </div>
        ) : (
          <div className="space-y-4">
            {bs && (
              <div className="rounded-lg border p-4 space-y-2">
                <h3 className="font-semibold">{bs.service_type as string} Service</h3>
                <p className="text-sm text-muted-foreground">{bs.description as string}</p>
                <Separator className="my-2" />
                <div className="flex justify-between items-center">
                  <span className="text-sm">Harga Base Service:</span>
                  <span className="text-lg font-bold">
                    {formatCurrency(bs.base_price as number)}
                  </span>
                </div>
              </div>
            )}

            {baseServiceItems.length === 0 ? (
              <div className="text-sm text-muted-foreground italic">
                Tidak ada base service item.
              </div>
            ) : (
              <div className="space-y-3">
                {baseServiceItems.map(({ item, index }) => (
                  <div key={index} className="rounded-lg border p-3 space-y-2">
                    <div className="text-sm font-medium">{item.description}</div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <Label>Quantity</Label>
                        <Input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => onUpdateQuantity(index, parseInt(e.target.value) || 1)}
                          min="1"
                        />
                      </div>
                      <div>
                        <Label>Harga Satuan (Edit jika perlu)</Label>
                        <Input
                          type="number"
                          value={item.unitPrice}
                          onChange={(e) => onUpdatePrice(index, parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div>
                        <Label>Total</Label>
                        <Input value={formatCurrency(item.total)} disabled />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

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
