'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getServiceRecords } from '@/lib/actions/service-records'
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { History, Search, CalendarIcon, MessageCircle, AlertCircle, CheckCircle } from 'lucide-react'
import { format, subDays, differenceInDays, isPast, isFuture } from 'date-fns'
import { cn } from '@/lib/utils'

export default function MonitoringHistoryPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [dateFrom, setDateFrom] = useState<Date>(subDays(new Date(), 90))
  const [dateTo, setDateTo] = useState<Date>(new Date())

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
  const filteredRecords = serviceRecords.filter((record: any) => {
    if (!searchQuery) return true
    const searchLower = searchQuery.toLowerCase()
    const customerName = record.ac_units?.locations?.customers?.customer_name?.toLowerCase() || ''
    const brand = record.ac_units?.brand?.toLowerCase() || ''
    const model = record.ac_units?.model_number?.toLowerCase() || ''
    const orderId = record.order_id?.toLowerCase() || ''
    
    return customerName.includes(searchLower) || 
           brand.includes(searchLower) || 
           model.includes(searchLower) ||
           orderId.includes(searchLower)
  })

  // Calculate stats
  const overdueCount = filteredRecords.filter((r: any) => r.next_service_due && isPast(new Date(r.next_service_due))).length
  const upcomingCount = filteredRecords.filter((r: any) => {
    if (!r.next_service_due) return false
    const daysUntil = differenceInDays(new Date(r.next_service_due), new Date())
    return daysUntil >= 0 && daysUntil <= 30
  }).length

  const generateWhatsAppMessage = (record: any) => {
    const customer = record.ac_units?.locations?.customers
    const acUnit = record.ac_units
    const customerName = customer?.customer_name || 'Customer'
    const brand = acUnit?.brand || 'AC'
    const model = acUnit?.model_number || ''
    const nextServiceDate = record.next_service_due ? format(new Date(record.next_service_due), 'dd MMMM yyyy') : '-'
    
    const message = `Halo ${customerName},

AC anda dengan Merk ${brand} ${model} akan masuk ke masa service pada tanggal ${nextServiceDate}.

Mohon untuk melakukan penjadwalan service agar AC anda tetap dalam kondisi optimal.

Terima kasih.`
    
    return encodeURIComponent(message)
  }

  const sendWhatsAppReminder = (record: any) => {
    const phoneNumber = record.ac_units?.locations?.customers?.phone_number
    if (!phoneNumber) {
      alert('Nomor telepon customer tidak ditemukan')
      return
    }
    
    // Remove non-numeric characters and format for WhatsApp
    const cleanPhone = phoneNumber.replace(/\D/g, '')
    const whatsappPhone = cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : cleanPhone
    const message = generateWhatsAppMessage(record)
    
    window.open(`https://wa.me/${whatsappPhone}?text=${message}`, '_blank')
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
        
        {/* Date Range Filters */}
        <div className='flex gap-2'>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant='outline' className={cn('justify-start text-left font-normal w-[160px]', !dateFrom && 'text-muted-foreground')}>
                <CalendarIcon className='mr-2 h-4 w-4' />
                {dateFrom ? format(dateFrom, 'dd MMM yyyy') : 'From date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className='w-auto p-0'>
              <Calendar mode='single' selected={dateFrom} onSelect={(date) => date && setDateFrom(date)} initialFocus />
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant='outline' className={cn('justify-start text-left font-normal w-[160px]', !dateTo && 'text-muted-foreground')}>
                <CalendarIcon className='mr-2 h-4 w-4' />
                {dateTo ? format(dateTo, 'dd MMM yyyy') : 'To date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className='w-auto p-0'>
              <Calendar mode='single' selected={dateTo} onSelect={(date) => date && setDateTo(date)} initialFocus />
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
            <div className='rounded-md border'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>AC Unit</TableHead>
                    <TableHead>Last Service</TableHead>
                    <TableHead>Next Service Due</TableHead>
                    <TableHead>Service Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className='text-right'>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.map((record: any) => {
                    const customer = record.ac_units?.locations?.customers
                    const acUnit = record.ac_units
                    
                    return (
                      <TableRow key={record.service_id}>
                        <TableCell>
                          <div>
                            <div className='font-medium'>{customer?.customer_name || '-'}</div>
                            <div className='text-sm text-muted-foreground'>{customer?.phone_number || '-'}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className='font-medium'>{acUnit?.brand || '-'} {acUnit?.model_number || ''}</div>
                            <div className='text-sm text-muted-foreground'>{acUnit?.ac_type || '-'}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {record.service_date ? format(new Date(record.service_date), 'dd MMM yyyy') : '-'}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className='font-medium'>
                              {record.next_service_due ? format(new Date(record.next_service_due), 'dd MMM yyyy') : '-'}
                            </div>
                            {getServiceStatusBadge(record.next_service_due)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant='outline'>{record.service_type || '-'}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant='secondary'>
                            {record.orders?.status || 'N/A'}
                          </Badge>
                        </TableCell>
                        <TableCell className='text-right'>
                          <Button
                            variant='outline'
                            size='sm'
                            onClick={() => sendWhatsAppReminder(record)}
                            disabled={!customer?.phone_number}
                            title={!customer?.phone_number ? 'No phone number' : 'Send WhatsApp reminder'}
                          >
                            <MessageCircle className='w-4 h-4 mr-1' />
                            Remind
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
    </div>
  )
}
