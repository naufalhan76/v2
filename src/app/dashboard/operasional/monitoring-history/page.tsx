'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getServiceRecords, updateServiceRecord, trackReminder, getReminderStats } from '@/lib/actions/service-records'
import { updateOrderStatus } from '@/lib/actions/orders'
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { SortableTableHead } from '@/components/ui/sortable-table-head'
import { useSortableTable } from '@/hooks/use-sortable-table'
import { useToast } from '@/hooks/use-toast'
import { History, Search, CalendarIcon, MessageCircle, AlertCircle, CheckCircle } from 'lucide-react'
import { format, subDays, differenceInDays, isPast } from 'date-fns'
import { cn } from '@/lib/utils'
import { id } from 'date-fns/locale'

// Component to display reminder statistics
function ReminderStatsCell({ serviceId }: { serviceId: string }) {
  const { data: statsData, isLoading } = useQuery({
    queryKey: ['reminder-stats', serviceId],
    queryFn: async () => {
      const result = await getReminderStats(serviceId)
      return result
    },
    staleTime: 30000 // 30 seconds
  })
  
  if (isLoading) {
    return <div className='text-xs text-muted-foreground'>Loading...</div>
  }
  
  const count = statsData?.count || 0
  const lastSent = statsData?.lastSentAt || null

  return (
    <div className='text-sm space-y-1'>
      <div className='flex items-center gap-2'>
        <Badge variant='outline'>
          {count} reminders
        </Badge>
      </div>
      {lastSent && (
        <div className='text-xs text-muted-foreground'>
          Last: {format(new Date(lastSent), 'dd MMM HH:mm')}
        </div>
      )}
    </div>
  )
}

export default function MonitoringHistoryPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')
  
  // Cancel/Reschedule modal states
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState<unknown>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null)
  const [editingDate, setEditingDate] = useState<Date | null>(null)
  
  // Date range state (default: 90 days ago to today)
  const [dateRange, setDateRange] = useState<{from: Date | undefined, to?: Date | undefined}>(() => {
    const endDate = new Date()
    const startDate = subDays(endDate, 90)
    return {
      from: startDate,
      to: endDate
    }
  })
  
  const [tempDateRange, setTempDateRange] = useState(dateRange)
  
  const dateFrom = dateRange.from || subDays(new Date(), 90)
  const dateTo = dateRange.to || new Date()

  // Handle date range selection
  const handleDateRangeSelect = (range: {from: Date | undefined, to?: Date | undefined} | undefined) => {
    if (range) {
      setTempDateRange(range)
      // Auto-update when both dates are selected
      if (range.from && range.to) {
        setDateRange(range)
      }
    }
  }

  const formatDateRange = () => {
    if (!dateRange.from || !dateRange.to) return "Pilih Tanggal"
    
    const fromFormatted = format(dateRange.from, 'dd/MM/yyyy', { locale: id })
    const toFormatted = format(dateRange.to, 'dd/MM/yyyy', { locale: id })
    
    return `${fromFormatted} - ${toFormatted}`
  }

  const { data: serviceRecordsData, isLoading } = useQuery({
    queryKey: ['service-records', format(dateFrom, 'yyyy-MM-dd'), format(dateTo, 'yyyy-MM-dd')],
    queryFn: () => getServiceRecords({ 
      sortByNextService: true,
      dateFrom: format(dateFrom, 'yyyy-MM-dd'),
      dateTo: format(dateTo, 'yyyy-MM-dd'),
      limit: 500
    })
  })

  const serviceRecords = serviceRecordsData?.data || []

  // Client-side search filter
  const filteredRecordsBase = serviceRecords.filter((record: unknown) => {
    if (!searchQuery) return true
    const r = record as Record<string, unknown>
    const acUnits = r.ac_units as Record<string, unknown> | undefined
    const locations = acUnits?.locations as Record<string, unknown> | undefined
    const customers = locations?.customers as Record<string, unknown> | undefined
    const searchLower = searchQuery.toLowerCase()
    const customerName = (customers?.customer_name as string)?.toLowerCase() || ''
    const brand = (acUnits?.brand as string)?.toLowerCase() || ''
    const model = (acUnits?.model_number as string)?.toLowerCase() || ''
    const orderId = (r.order_id as string)?.toLowerCase() || ''
    return customerName.includes(searchLower) ||
           brand.includes(searchLower) ||
           model.includes(searchLower) ||
           orderId.includes(searchLower)
  })

  // Apply sorting
  const { sortedData: filteredRecords, sortConfig, requestSort } = useSortableTable(filteredRecordsBase, {
    key: 'service_date',
    direction: 'desc'
  })

  // Calculate stats
  const overdueCount = filteredRecords.filter((r: unknown) => {
    const rec = r as Record<string, unknown>
    return rec.next_service_due && isPast(new Date(rec.next_service_due as string))
  }).length
  const upcomingCount = filteredRecords.filter((r: unknown) => {
    const rec = r as Record<string, unknown>
    if (!rec.next_service_due) return false
    const daysUntil = differenceInDays(new Date(rec.next_service_due as string), new Date())
    return daysUntil >= 0 && daysUntil <= 30
  }).length

  const generateWhatsAppMessage = (record: unknown) => {
    const r = record as Record<string, unknown>
    const acUnits = r.ac_units as Record<string, unknown> | undefined
    const locations = acUnits?.locations as Record<string, unknown> | undefined
    const customer = locations?.customers as Record<string, unknown> | undefined
    const customerName = (customer?.customer_name as string) || 'Customer'
    const brand = (acUnits?.brand as string) || 'AC'
    const model = (acUnits?.model_number as string) || ''
    const nextServiceDate = r.next_service_due ? format(new Date(r.next_service_due as string), 'dd MMMM yyyy') : '-'
    
    const message = `Halo ${customerName},

AC anda dengan Merk ${brand} ${model} akan masuk ke masa service pada tanggal ${nextServiceDate}.

Mohon untuk melakukan penjadwalan service agar AC anda tetap dalam kondisi optimal.

Terima kasih.`
    
    return encodeURIComponent(message)
  }

  const sendWhatsAppReminder = async (record: unknown) => {
    const r = record as Record<string, unknown>
    const acUnits = r.ac_units as Record<string, unknown> | undefined
    const locations = acUnits?.locations as Record<string, unknown> | undefined
    const customer = locations?.customers as Record<string, unknown> | undefined
    const phoneNumber = customer?.phone_number as string | undefined
    if (!phoneNumber) {
      toast({
        title: 'Error',
        description: 'Nomor telepon customer tidak ditemukan',
        variant: 'destructive'
      })
      return
    }
    
    try {
      // Track the reminder in database
      const trackResult = await trackReminder(r.service_id as string, r.order_id as string, phoneNumber)
      
      if (!trackResult.success) {
        toast({
          title: 'Error',
          description: 'Failed to track reminder',
          variant: 'destructive'
        })
        return
      }
      
      // Remove non-numeric characters and format for WhatsApp
      const cleanPhone = phoneNumber.replace(/\D/g, '')
      const whatsappPhone = cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : cleanPhone
      const message = generateWhatsAppMessage(record)
      
      // Open WhatsApp
      window.open(`https://wa.me/${whatsappPhone}?text=${message}`, '_blank')
      
      // Refresh data to show updated reminder count
      queryClient.invalidateQueries({ queryKey: ['service-records'] })
      
      toast({
        title: 'Success',
        description: 'Reminder sent successfully'
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to send reminder',
        variant: 'destructive'
      })
    }
  }

  const handleCancelOrder = async () => {
    if (!selectedRecord) return
    
    setIsProcessing(true)
    try {
      const orderId = (selectedRecord as Record<string, unknown>).orders
        ? ((selectedRecord as Record<string, unknown>).orders as Record<string, unknown>).order_id as string
        : ''
      const result = await updateOrderStatus(orderId, 'CANCELLED', 'Cancelled from monitoring history')
      
      if (result.success) {
        toast({
          title: 'Success',
          description: 'Order cancelled successfully'
        })
        setCancelModalOpen(false)
        setSelectedRecord(null)
        queryClient.invalidateQueries({ queryKey: ['service-records'] })
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to cancel order',
          variant: 'destructive'
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive'
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleSaveEditDate = async () => {
    if (!editingServiceId || !editingDate) return
    
    setIsProcessing(true)
    try {
      const result = await updateServiceRecord(editingServiceId, {
        next_service_due: format(editingDate, 'yyyy-MM-dd')
      })
      
      if (result.success) {
        toast({
          title: 'Success',
          description: `Next service due updated to ${format(editingDate, 'dd MMM yyyy')}`
        })
        setEditingServiceId(null)
        setEditingDate(null)
        queryClient.invalidateQueries({ queryKey: ['service-records'] })
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to update date',
          variant: 'destructive'
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive'
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const getServiceStatusBadge = (nextServiceDue: string | null) => {
    if (!nextServiceDue) {
      return <Badge variant='secondary'>No Schedule</Badge>
    }
    
    const daysUntil = differenceInDays(new Date(nextServiceDue), new Date())
    
    if (daysUntil < 0) {
      return (
        <Badge className='bg-red-500 text-white'>
          <AlertCircle className='w-3 h-3 mr-1' />
          Overdue ({Math.abs(daysUntil)} days)
        </Badge>
      )
    } else if (daysUntil <= 7) {
      return (
        <Badge className='bg-orange-500 text-white'>
          <AlertCircle className='w-3 h-3 mr-1' />
          Urgent ({daysUntil} days)
        </Badge>
      )
    } else if (daysUntil <= 30) {
      return (
        <Badge className='bg-yellow-500 text-white'>
          Coming ({daysUntil} days)
        </Badge>
      )
    } else {
      return (
        <Badge className='bg-green-500 text-white'>
          <CheckCircle className='w-3 h-3 mr-1' />
          Scheduled
        </Badge>
      )
    }
  }

  return (
    <div className='p-6 space-y-6'>
      {/* Header with Date Range */}
      <div className='flex flex-col md:flex-row md:items-center md:justify-between gap-4'>
        <div>
          <h1 className='text-3xl font-bold mb-2'>Service History & Reminders</h1>
          <p className='text-muted-foreground'>Monitor service history and upcoming service schedules</p>
        </div>
        
        {/* Date Range Picker */}
        <div className="flex flex-col items-end gap-3">
          <div className="text-sm font-medium">Filter Tanggal Service:</div>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-[240px] justify-start text-left font-normal text-sm px-3 py-2.5 h-auto shadow-sm",
                  (!dateRange.from || !dateRange.to) && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-3 h-4 w-4" />
                <span className="flex-1">{formatDateRange()}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={dateRange.from}
                selected={tempDateRange}
                onSelect={handleDateRangeSelect}
                numberOfMonths={2}
                locale={id as never}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Stats Cards */}
      <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between pb-2'>
            <CardTitle className='text-sm font-medium'>Total Service Records</CardTitle>
            <History className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{filteredRecords.length}</div>
            <p className='text-xs text-muted-foreground mt-1'>All service history</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between pb-2'>
            <CardTitle className='text-sm font-medium'>Upcoming (30 days)</CardTitle>
            <AlertCircle className='h-4 w-4 text-yellow-500' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold text-yellow-600'>{upcomingCount}</div>
            <p className='text-xs text-muted-foreground mt-1'>Need scheduling soon</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between pb-2'>
            <CardTitle className='text-sm font-medium'>Overdue</CardTitle>
            <AlertCircle className='h-4 w-4 text-red-500' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold text-red-600'>{overdueCount}</div>
            <p className='text-xs text-muted-foreground mt-1'>Past due date</p>
          </CardContent>
        </Card>
      </div>

      {/* Search Bar */}
      <Card>
        <CardHeader>
          <CardTitle>Search Records</CardTitle>
          <CardDescription>Search by customer name, AC brand, model, or order ID</CardDescription>
        </CardHeader>
        <CardContent>
          <div className='relative'>
            <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
            <Input
              placeholder='Search customer, brand, model, or order ID...'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className='pl-9'
            />
          </div>
        </CardContent>
      </Card>

      {/* Service Records Table */}
      <Card>
        <CardHeader>
          <CardTitle>Service Records ({filteredRecords.length})</CardTitle>
          <CardDescription>Sorted by next service due date (nearest first)</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className='text-center py-8 text-muted-foreground'>Loading service records...</div>
          ) : filteredRecords.length === 0 ? (
            <div className='text-center py-8 text-muted-foreground'>No service records found</div>
          ) : (
            <div className='data-table-container'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableTableHead sortKey="ac_units.locations.customers.customer_name" currentSort={sortConfig} onSort={requestSort}>
                      Customer
                    </SortableTableHead>
                    <SortableTableHead sortKey="ac_units.brand" currentSort={sortConfig} onSort={requestSort}>
                      AC Unit
                    </SortableTableHead>
                    <SortableTableHead sortKey="service_date" currentSort={sortConfig} onSort={requestSort}>
                      Last Service
                    </SortableTableHead>
                    <SortableTableHead sortKey="next_service_due" currentSort={sortConfig} onSort={requestSort}>
                      Next Service Due
                    </SortableTableHead>
                    <SortableTableHead sortKey="service_type" currentSort={sortConfig} onSort={requestSort}>
                      Service Type
                    </SortableTableHead>
                    <TableHead>Reminder History</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className='text-right'>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.map((record: unknown) => {
                    const rec = record as Record<string, unknown>
                    const acUnit = rec.ac_units as Record<string, unknown> | undefined
                    const locations = acUnit?.locations as Record<string, unknown> | undefined
                    const customer = locations?.customers as Record<string, unknown> | undefined

                    return (
                      <TableRow key={rec.service_id as string}>
                        <TableCell>
                          <div>
                            <div className='font-medium'>{(customer?.customer_name as string) || '-'}</div>
                            <div className='text-sm text-muted-foreground'>{(customer?.phone_number as string) || '-'}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className='font-medium'>{(acUnit?.brand as string) || '-'} {(acUnit?.model_number as string) || ''}</div>
                            <div className='text-sm text-muted-foreground'>{(acUnit?.ac_type as string) || '-'}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {rec.service_date ? format(new Date(rec.service_date as string), 'dd MMM yyyy') : '-'}
                        </TableCell>
                        <TableCell>
                          {editingServiceId === rec.service_id ? (
                            <div className='space-y-2'>
                              <input
                                type='date'
                                value={editingDate ? editingDate.toISOString().split('T')[0] : ''}
                                onChange={(e) => {
                                  if (e.target.value) {
                                    setEditingDate(new Date(e.target.value));
                                  }
                                }}
                                className='w-full px-2 py-1 border rounded text-sm'
                              />
                              <div className='flex gap-2'>
                                <Button
                                  size='sm'
                                  variant='default'
                                  onClick={handleSaveEditDate}
                                  disabled={!editingDate || isProcessing}
                                  className='h-7 text-xs'
                                >
                                  Save
                                </Button>
                                <Button
                                  size='sm'
                                  variant='outline'
                                  onClick={() => {
                                    setEditingServiceId(null)
                                    setEditingDate(null)
                                  }}
                                  disabled={isProcessing}
                                  className='h-7 text-xs'
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div
                              onClick={() => {
                                setEditingServiceId(rec.service_id as string)
                                setEditingDate(rec.next_service_due ? new Date(rec.next_service_due as string) : new Date())
                              }}
                              className='cursor-pointer hover:bg-accent p-2 rounded transition-colors'
                            >
                              <div className='font-medium'>
                                {rec.next_service_due ? format(new Date(rec.next_service_due as string), 'dd MMM yyyy') : '-'}
                              </div>
                              {getServiceStatusBadge(rec.next_service_due as string | null)}
                              <div className='text-xs text-muted-foreground mt-1'>Click to edit</div>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant='outline'>{(rec.service_type as string) || '-'}</Badge>
                        </TableCell>
                        <TableCell>
                          <ReminderStatsCell serviceId={rec.service_id as string} />
                        </TableCell>
                        <TableCell>
                          <Badge variant='secondary'>
                            {((rec.orders as Record<string, unknown>)?.status as string) || 'N/A'}
                          </Badge>
                        </TableCell>
                        <TableCell className='text-right'>
                          <div className='flex justify-end gap-2 ml-auto'>
                            <Button
                              variant='outline'
                              className='group relative overflow-hidden transition-all duration-300 ease-in-out w-10 hover:w-28 flex items-center justify-start px-2'
                              onClick={() => sendWhatsAppReminder(record)}
                              disabled={!customer?.phone_number}
                              title={!customer?.phone_number ? 'No phone number' : 'Send WhatsApp reminder'}
                            >
                              <MessageCircle className='w-4 h-4 flex-shrink-0' />
                              <span className='ml-2 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300'>
                                Remind
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

      {/* Cancel Order Modal */}
      <AlertDialog open={cancelModalOpen} onOpenChange={setCancelModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Order?</AlertDialogTitle>
            <AlertDialogDescription>
              This will cancel the order and mark any pending AC units as inactive. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Order</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelOrder}
              disabled={isProcessing}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              {isProcessing ? 'Cancelling...' : 'Cancel Order'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
