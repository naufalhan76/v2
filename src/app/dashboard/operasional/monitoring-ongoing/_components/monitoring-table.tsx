import { format } from 'date-fns'
import { Eye, MapPin, ChevronDown } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { SortableTableHead } from '@/components/ui/sortable-table-head'
import { cn } from '@/lib/utils'
import { StatusBadge } from '@/components/orders/status-badge'
import type { MonitoringOrderView } from '../monitoring-ongoing-utils'

interface MonitoringTableProps {
  filteredOrders: MonitoringOrderView[]
  isLoading: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sortConfig: any
  requestSort: (key: string) => void
  onViewOrder: (orderId: string) => void
}

export function MonitoringTable({ filteredOrders, isLoading, sortConfig, requestSort, onViewOrder }: MonitoringTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Orders ({filteredOrders.length})</CardTitle>
        <CardDescription>All ongoing orders</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading orders...</div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">No orders found</div>
        ) : (
          <div className="data-table-container">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead sortKey="order_id" currentSort={sortConfig} onSort={requestSort}>
                    Order ID
                  </SortableTableHead>
                  <SortableTableHead sortKey="customers.customer_name" currentSort={sortConfig} onSort={requestSort}>
                    Customer Name
                  </SortableTableHead>
                  <SortableTableHead sortKey="req_visit_date" currentSort={sortConfig} onSort={requestSort}>
                    Req Visit Date
                  </SortableTableHead>
                  <TableHead>Locations</TableHead>
                  <TableHead>Services</TableHead>
                  <SortableTableHead sortKey="order_type" currentSort={sortConfig} onSort={requestSort}>
                    Order Type
                  </SortableTableHead>
                  <SortableTableHead sortKey="status" currentSort={sortConfig} onSort={requestSort}>
                    Status
                  </SortableTableHead>
                  <SortableTableHead sortKey="assigned_technician_id" currentSort={sortConfig} onSort={requestSort}>
                    Assigned Technician
                  </SortableTableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((orderView) => {
                  const o = orderView.order as Record<string, unknown>
                  const { locationsSummary, servicesInfo, uniqueServiceLabels, helperTechnicianNames } = orderView

                  return (
                    <TableRow
                      key={o.order_id as string}
                      className={cn(
                        o.status === 'PENDING' && 'bg-status-pending-bg border-t-2 border-t-warning hover:bg-status-pending-bg'
                      )}
                    >
                      <TableCell className="font-mono text-sm">{o.order_id as string}</TableCell>
                      <TableCell className="font-medium">{(o.customers as Record<string, unknown>)?.customer_name as string || '-'}</TableCell>
                      <TableCell>
                        {o.req_visit_date ? format(new Date(o.req_visit_date as string), 'dd MMM yyyy') : '-'}
                      </TableCell>
                      <TableCell>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-auto py-1 px-2 font-normal">
                              <span className="flex items-center gap-1">
                                {locationsSummary.text}
                                {locationsSummary.count > 1 && <ChevronDown className="w-3 h-3 ml-1" />}
                              </span>
                            </Button>
                          </PopoverTrigger>
                          {locationsSummary.count > 1 && (
                            <PopoverContent className="w-80" align="start">
                              <div className="space-y-2">
                                <h4 className="font-semibold text-sm">All Locations ({locationsSummary.count})</h4>
                                <div className="space-y-1">
                                  {locationsSummary.locations.map((loc: string, idx: number) => (
                                    <div key={idx} className="text-sm p-2 bg-muted/50 rounded flex items-center gap-2">
                                      <MapPin className="w-3 h-3 text-muted-foreground" />
                                      {loc}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </PopoverContent>
                          )}
                        </Popover>
                      </TableCell>
                      <TableCell>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-auto py-1 px-2 font-normal">
                              <Badge variant="outline" className="cursor-pointer">
                                {servicesInfo.count} service{servicesInfo.count > 1 ? 's' : ''}
                                {Object.keys(servicesInfo.types).length > 0 && <ChevronDown className="w-3 h-3 ml-1" />}
                              </Badge>
                            </Button>
                          </PopoverTrigger>
                          {Object.keys(servicesInfo.types).length > 0 && (
                            <PopoverContent className="w-72" align="start">
                              <div className="space-y-2">
                                <h4 className="font-semibold text-sm">Service Breakdown</h4>
                                <div className="space-y-1">
                                  {Object.entries(servicesInfo.types).map(([key, count]) => (
                                    <div key={key} className="flex items-center justify-between text-sm p-2 bg-muted/50 rounded">
                                      <span className="font-mono text-xs font-medium">{key}</span>
                                      <Badge variant="secondary">{count as number}x</Badge>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </PopoverContent>
                          )}
                        </Popover>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {uniqueServiceLabels.map((label) => (
                            <Badge key={label} variant="outline" className="text-xs font-mono">
                              {label}
                            </Badge>
                          ))}
                          {uniqueServiceLabels.length === 0 && (
                            <Badge variant="outline">
                              {(o.order_type as string) || '-'}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={o.status as string} />
                      </TableCell>
                      <TableCell className="text-sm">
                        {o.order_technicians && (o.order_technicians as unknown[]).length > 0 ? (
                          <div className="space-y-1">
                            <div className="font-medium">
                              {orderView.leadTechnicianName ?? ((o.assigned_technician_id as string) || '-')}
                            </div>
                            {helperTechnicianNames.length > 0 && (
                              <div className="text-xs text-muted-foreground">
                                + {helperTechnicianNames.join(', ')}
                              </div>
                            )}
                          </div>
                        ) : (
                          (o.assigned_technician_id as string) || '-'
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onViewOrder(o.order_id as string)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
