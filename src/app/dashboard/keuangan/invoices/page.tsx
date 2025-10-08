'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Loader2,
  Plus,
  Eye,
  FileText,
  Search,
  DollarSign,
  Clock,
  CheckCircle,
  AlertCircle,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { getInvoices, getInvoiceStats, type Invoice } from '@/lib/actions/invoices'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-500',
  SENT: 'bg-blue-500',
  PAID: 'bg-green-500',
  OVERDUE: 'bg-red-500',
  CANCELLED: 'bg-gray-400',
}

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  UNPAID: 'bg-red-500',
  PARTIAL: 'bg-amber-500',
  PAID: 'bg-green-500',
}

export default function InvoicesPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [stats, setStats] = useState({
    total: 0,
    draft: 0,
    sent: 0,
    paid: 0,
    overdue: 0,
    totalRevenue: 0,
    unpaidAmount: 0,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [paymentFilter, setPaymentFilter] = useState('ALL')

  useEffect(() => {
    loadInvoices()
    loadStats()
  }, [statusFilter, paymentFilter])

  const loadInvoices = async () => {
    try {
      setIsLoading(true)
      const result = await getInvoices({
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        paymentStatus: paymentFilter !== 'ALL' ? paymentFilter : undefined,
        search: searchQuery || undefined,
      })
      setInvoices(result.data)
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Gagal memuat data invoice',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const data = await getInvoiceStats()
      setStats(data)
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  const handleSearch = () => {
    loadInvoices()
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Invoice</h1>
          <p className="text-muted-foreground">Kelola dan monitor invoice pelanggan</p>
        </div>
        <Button
          onClick={() => router.push('/dashboard/keuangan/invoices/create')}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Buat Invoice
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Invoice</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              {stats.draft} draft, {stats.sent} terkirim
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">{stats.paid} invoice dibayar</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Belum Dibayar</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.unpaidAmount)}</div>
            <p className="text-xs text-muted-foreground">Total piutang</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.overdue}</div>
            <p className="text-xs text-muted-foreground">Invoice jatuh tempo</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Cari invoice number atau customer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua Status</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="SENT">Terkirim</SelectItem>
                <SelectItem value="PAID">Dibayar</SelectItem>
                <SelectItem value="OVERDUE">Overdue</SelectItem>
                <SelectItem value="CANCELLED">Dibatalkan</SelectItem>
              </SelectContent>
            </Select>
            <Select value={paymentFilter} onValueChange={setPaymentFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Pembayaran" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua Pembayaran</SelectItem>
                <SelectItem value="UNPAID">Belum Dibayar</SelectItem>
                <SelectItem value="PARTIAL">Dibayar Sebagian</SelectItem>
                <SelectItem value="PAID">Lunas</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleSearch}>Cari</Button>
          </div>
        </CardContent>
      </Card>

      {/* Invoices Table */}
      <Card>
        <CardHeader>
          <CardTitle>Daftar Invoice</CardTitle>
          <CardDescription>{invoices.length} invoice ditemukan</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : invoices.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">Belum ada invoice</h3>
              <p className="text-sm text-muted-foreground mt-2">
                Mulai dengan membuat invoice pertama
              </p>
              <Button
                onClick={() => router.push('/dashboard/keuangan/invoices/create')}
                className="mt-4"
              >
                <Plus className="mr-2 h-4 w-4" />
                Buat Invoice
              </Button>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice Number</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Jatuh Tempo</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Pembayaran</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => (
                    <TableRow key={invoice.invoice_id}>
                      <TableCell className="font-mono font-semibold">
                        {invoice.invoice_number}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {invoice.customers?.customer_name}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {invoice.customers?.phone_number}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {format(new Date(invoice.invoice_date), 'dd MMM yyyy', {
                          locale: localeId,
                        })}
                      </TableCell>
                      <TableCell>
                        {format(new Date(invoice.due_date), 'dd MMM yyyy', {
                          locale: localeId,
                        })}
                      </TableCell>
                      <TableCell className="font-semibold">
                        {formatCurrency(invoice.total_amount)}
                      </TableCell>
                      <TableCell>
                        <Badge className={STATUS_COLORS[invoice.status]}>
                          {invoice.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={PAYMENT_STATUS_COLORS[invoice.payment_status]}>
                          {invoice.payment_status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            router.push(`/dashboard/keuangan/invoices/${invoice.invoice_id}`)
                          }
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
