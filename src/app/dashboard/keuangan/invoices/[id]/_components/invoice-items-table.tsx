import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { MapPin, Trash2, Plus } from 'lucide-react'
import type { InvoiceItem } from '@/types/invoices'
import type { RevisionItemDraft } from '../_hooks/use-invoice-detail'

interface InvoiceItemsTableProps {
  items: InvoiceItem[]
  orderItemsDetailed: Record<string, unknown>[]
  isRevisionMode: boolean
  revisionItems?: RevisionItemDraft[]
  formatCurrency: (amount: number) => string
  onUpdateRevisionItem?: (index: number, patch: Partial<RevisionItemDraft>) => void
  onAddRevisionItem?: () => void
  onRemoveRevisionItem?: (index: number) => void
}

export function InvoiceItemsTable({
  items,
  orderItemsDetailed,
  isRevisionMode,
  revisionItems,
  formatCurrency,
  onUpdateRevisionItem,
  onAddRevisionItem,
  onRemoveRevisionItem,
}: InvoiceItemsTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{isRevisionMode ? 'Items Invoice' : 'Service Details (Per AC Unit)'}</CardTitle>
        <CardDescription>
          {isRevisionMode
            ? 'Edit, tambah, atau hapus item invoice. Subtotal dihitung otomatis di server.'
            : 'Breakdown by AC unit and location'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isRevisionMode && revisionItems && onUpdateRevisionItem && (
          <div className="space-y-3" data-testid="invoice-revision-items">
            {revisionItems.map((item, idx) => (
              <div key={item.item_id ?? `new-${idx}`} className="rounded-lg border p-3 space-y-3">
                <div className="grid gap-3 grid-cols-1 md:grid-cols-12">
                  <div className="space-y-1 md:col-span-6">
                    <Label htmlFor={`rev-item-desc-${idx}`}>Deskripsi</Label>
                    <Input
                      id={`rev-item-desc-${idx}`}
                      value={item.description}
                      onChange={(e) => onUpdateRevisionItem(idx, { description: e.target.value })}
                      placeholder="Deskripsi item"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3 md:contents">
                    <div className="space-y-1 md:col-span-2">
                      <Label htmlFor={`rev-item-qty-${idx}`}>Qty</Label>
                      <Input
                        id={`rev-item-qty-${idx}`}
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) =>
                          onUpdateRevisionItem(idx, { quantity: parseInt(e.target.value, 10) || 0 })
                        }
                      />
                    </div>
                    <div className="space-y-1 md:col-span-3 col-span-2">
                      <Label htmlFor={`rev-item-price-${idx}`}>Harga Satuan</Label>
                      <Input
                        id={`rev-item-price-${idx}`}
                        type="number"
                        min="0"
                        value={item.unit_price}
                        onChange={(e) =>
                          onUpdateRevisionItem(idx, { unit_price: parseFloat(e.target.value) || 0 })
                        }
                      />
                    </div>
                  </div>
                  <div className="md:col-span-1 flex md:items-end justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => onRemoveRevisionItem?.(idx)}
                      disabled={(revisionItems?.length ?? 0) <= 1}
                      aria-label="Hapus item"
                      className="min-h-[44px] min-w-[44px]"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                <div className="text-right text-sm text-muted-foreground">
                  Subtotal item: {formatCurrency((Number(item.quantity) || 0) * (Number(item.unit_price) || 0))}
                </div>
              </div>
            ))}
            <Button type="button" variant="outline" onClick={onAddRevisionItem} className="w-full min-h-[44px]">
              <Plus className="mr-2 h-4 w-4" />
              Tambah Item
            </Button>
          </div>
        )}

        {!isRevisionMode && orderItemsDetailed.length > 0 && (
          <>
            {(() => {
              type LocationGroup = { location: Record<string, unknown>; items: Record<string, unknown>[] }
              const groupedByLocation = orderItemsDetailed.reduce((acc: Record<string, LocationGroup>, item: Record<string, unknown>) => {
                const locId = (item.location_id as string) || 'unknown'
                if (!acc[locId]) {
                  acc[locId] = { location: item.locations as Record<string, unknown>, items: [] }
                }
                acc[locId].items.push(item)
                return acc
              }, {})

              return Object.values(groupedByLocation).map((g, locIdx: number) => (
                <div key={locIdx} className="border rounded-lg p-4 space-y-3">
                  <div className="font-semibold text-base border-b pb-2">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-primary" />
                      {(g.location?.building_name as string) || 'Unknown Location'}
                    </div>
                    <div className="text-sm text-muted-foreground font-normal mt-1 pl-6">
                      Floor {g.location?.floor as number}, Room {g.location?.room_number as string}
                    </div>
                  </div>
                  <div className="space-y-2">
                    {g.items.map((item: Record<string, unknown>, itemIdx: number) => {
                      const subtotal = ((item.estimated_price as number) || (item.actual_price as number) || 0) * ((item.quantity as number) || 1)
                      const acUnits = item.ac_units as Record<string, unknown> | undefined
                      return (
                        <div key={itemIdx} className="bg-muted/30 rounded-lg p-3 space-y-2">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-medium text-sm">
                                {acUnits ? (
                                  <>{acUnits.brand as string} {acUnits.model_number as string}</>
                                ) : (
                                  `New AC Unit ${(item.quantity as number) > 1 ? `(${item.quantity}x)` : ''}`
                                )}
                              </div>
                              {acUnits && (acUnits.serial_number as string) && (
                                <div className="text-xs text-muted-foreground">S/N: {acUnits.serial_number as string}</div>
                              )}
                            </div>
                            <Badge variant="outline" className="text-xs">{item.service_type as string}</Badge>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                            <div className="text-muted-foreground">{(item.description as string) || 'Service'}</div>
                            <div className="font-semibold">{formatCurrency(subtotal)}</div>
                          </div>
                          {(item.quantity as number) > 1 && (
                            <div className="text-xs text-muted-foreground">
                              {formatCurrency((item.estimated_price as number) || (item.actual_price as number) || 0)} × {item.quantity as number}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t font-semibold">
                    <span className="text-sm">Location Subtotal:</span>
                    <span>{formatCurrency(g.items.reduce((sum: number, item: Record<string, unknown>) =>
                      sum + (((item.estimated_price as number) || (item.actual_price as number) || 0) * ((item.quantity as number) || 1)), 0
                    ))}</span>
                  </div>
                </div>
              ))
            })()}
          </>
        )}

        {!isRevisionMode && orderItemsDetailed.length === 0 && (
          <div className="data-table-container -mx-2 overflow-x-auto sm:mx-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.item_id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{item.description}</p>
                        <Badge variant="outline" className="text-xs">{item.item_type}</Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">{formatCurrency(item.unit_price)}</TableCell>
                    <TableCell className="text-right font-semibold whitespace-nowrap">{formatCurrency(item.total_price)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
