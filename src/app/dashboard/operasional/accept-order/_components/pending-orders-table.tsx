import { ChangeEvent } from 'react'
import type { SortConfig as SortConfigType } from '@/hooks/use-sortable-table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { SortableTableHead } from '@/components/ui/sortable-table-head'
import { CheckCircle, Search, Eye, Check, X } from 'lucide-react'
import { format } from 'date-fns'
import { StatusBadge } from '@/components/orders/status-badge'

const SERVICE_TYPES = [
  { value: 'REFILL_FREON', label: 'Refill Freon' },
  { value: 'CLEANING', label: 'Cleaning' },
  { value: 'REPAIR', label: 'Repair' },
  { value: 'INSTALLATION', label: 'Installation' },
  { value: 'INSPECTION', label: 'Inspection' },
]

interface PendingOrdersTableProps {
  filteredOrders: unknown[]
  isLoading: boolean
  searchQuery: string
  onSearchChange: (value: string) => void
  sortConfig: SortConfigType
  requestSort: (key: string) => void
  onDetailClick: (orderId: string) => void
  onAcceptClick: (orderId: string) => void
  onCancelClick: (orderId: string) => void
}

export function PendingOrdersTable({
  filteredOrders,
  isLoading,
  searchQuery,
  onSearchChange,
  sortConfig,
  requestSort,
  onDetailClick,
  onAcceptClick,
  onCancelClick,
}: PendingOrdersTableProps) {
  return (
    <>
      {/* Stats Card */}
      <Card>
        <CardHeader className='flex flex-row items-center justify-between pb-2'>
          <div>
            <CardTitle className='text-sm font-medium'>Pending Orders</CardTitle>
            <CardDescription>Orders waiting for approval</CardDescription>
          </div>
          <CheckCircle className='h-4 w-4 text-muted-foreground' />
        </CardHeader>
        <CardContent>
          <div className='text-2xl font-bold'>{filteredOrders.length}</div>
        </CardContent>
      </Card>

      {/* Search Bar */}
      <Card>
        <CardContent className='pt-6'>
          <div className='relative'>
            <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
            <Input
              placeholder='Search by Order ID or Customer Name...'
              value={searchQuery}
              onChange={(e: ChangeEvent<HTMLInputElement>) => onSearchChange(e.target.value)}
              className='pl-9'
            />
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle>New Orders ({filteredOrders.length})</CardTitle>
          <CardDescription>Orders with NEW status pending approval</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className='text-center py-8 text-muted-foreground'>Loading orders...</div>
          ) : filteredOrders.length === 0 ? (
            <div className='text-center py-8 text-muted-foreground'>
              {searchQuery ? 'No orders found matching your search' : 'No new orders at this time'}
            </div>
          ) : (
            <div className='data-table-container'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableTableHead sortKey="order_id" currentSort={sortConfig} onSort={requestSort}>
                      Order ID
                    </SortableTableHead>
                    <SortableTableHead sortKey="customers.customer_name" currentSort={sortConfig} onSort={requestSort}>
                      Customer Name
                    </SortableTableHead>
                    <SortableTableHead sortKey="order_date" currentSort={sortConfig} onSort={requestSort}>
                      Order Date
                    </SortableTableHead>
                    <SortableTableHead sortKey="req_visit_date" currentSort={sortConfig} onSort={requestSort}>
                      Req Visit Date
                    </SortableTableHead>
                    <SortableTableHead sortKey="order_type" currentSort={sortConfig} onSort={requestSort}>
                      Order Type
                    </SortableTableHead>
                    <SortableTableHead sortKey="status" currentSort={sortConfig} onSort={requestSort}>
                      Status
                    </SortableTableHead>
                    <TableHead className='text-right'>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order: unknown) => {
                    const o = order as Record<string, unknown> & { customers?: { customer_name?: string }; order_id: string; order_date?: string; req_visit_date?: string; order_type?: string; status: string }
                    return (
                    <TableRow key={o.order_id}>
                      <TableCell className='font-mono text-sm'>{o.order_id}</TableCell>
                      <TableCell className='font-medium'>{o.customers?.customer_name || '-'}</TableCell>
                      <TableCell>
                        {o.order_date ? format(new Date(o.order_date), 'dd MMM yyyy') : '-'}
                      </TableCell>
                      <TableCell>
                        {o.req_visit_date ? format(new Date(o.req_visit_date), 'dd MMM yyyy') : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant='outline'>
                          {SERVICE_TYPES.find(t => t.value === o.order_type)?.label || o.order_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={o.status} />
                      </TableCell>
                      <TableCell className='text-right'>
                        <div className='flex justify-end gap-2 w-[200px] ml-auto'>
                          <Button
                            variant='ghost'
                            size='sm'
                            aria-label='View details'
                            onClick={() => onDetailClick(o.order_id)}
                          >
                            <Eye className='w-4 h-4' />
                          </Button>
                          <Button
                            variant='default'
                            className='group relative overflow-hidden transition-all duration-300 ease-in-out bg-blue-600 hover:bg-blue-700 text-white w-10 hover:w-28 flex items-center justify-start px-2'
                            onClick={() => onAcceptClick(o.order_id)}
                          >
                            <Check className='w-4 h-4 flex-shrink-0' />
                            <span className='ml-2 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300'>
                              Accept
                            </span>
                          </Button>
                          <Button
                            variant='destructive'
                            className='group relative overflow-hidden transition-all duration-300 ease-in-out w-10 hover:w-28 flex items-center justify-start px-2'
                            onClick={() => onCancelClick(o.order_id)}
                          >
                            <X className='w-4 h-4 flex-shrink-0' />
                            <span className='ml-2 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300'>
                              Cancel
                            </span>
                          </Button>
                        </div>
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
    </>
  )
}
