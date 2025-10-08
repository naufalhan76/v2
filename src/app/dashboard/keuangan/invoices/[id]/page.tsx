'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import {
  Loader2,
  ArrowLeft,
  Download,
  DollarSign,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Send,
  Mail,
} from 'lucide-react'
import {
  getInvoiceById,
  updateInvoiceStatus,
  recordPayment,
  deleteInvoice,
  type Invoice,
  type InvoiceItem,
  type PaymentRecord,
} from '@/lib/actions/invoices'
import { getInvoiceConfig, type InvoiceConfig, type BankAccount } from '@/lib/actions/invoice-config'
import { 
  logInvoiceCommunication, 
  getInvoiceCommunicationStats 
} from '@/lib/actions/invoice-communications'
import { exportInvoiceToPDF } from '@/lib/pdf-export'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-500',
  SENT: 'bg-blue-500',
  PAID: 'bg-green-500',
  OVERDUE: 'bg-red-500',
  CANCELLED: 'bg-gray-400',
}

export default function InvoiceDetailPage() {
  const router = useRouter()
  const params = useParams()
  const invoiceId = params?.id as string
  const { toast } = useToast()
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [items, setItems] = useState<InvoiceItem[]>([])
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [invoiceConfig, setInvoiceConfig] = useState<InvoiceConfig | null>(null)
  const [communicationStats, setCommunicationStats] = useState({
    totalSent: 0,
    emailSent: 0,
    whatsappSent: 0,
    lastSentAt: null as string | null,
    lastSentType: null as string | null,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  // Payment form state
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0])
  const [paymentMethod, setPaymentMethod] = useState('TRANSFER')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentReference, setPaymentReference] = useState('')
  const [paymentNotes, setPaymentNotes] = useState('')

  useEffect(() => {
    if (invoiceId) {
      loadInvoice()
    }
  }, [invoiceId])

  const loadInvoice = async () => {
    if (!invoiceId) return
    
    try {
      setIsLoading(true)
      const [data, config, stats] = await Promise.all([
        getInvoiceById(invoiceId),
        getInvoiceConfig(),
        getInvoiceCommunicationStats(invoiceId),
      ])
      if (data) {
        setInvoice(data.invoice)
        setItems(data.items)
        setPayments(data.payments)
      }
      setInvoiceConfig(config)
      setCommunicationStats(stats)
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

  const handleStatusChange = async (newStatus: string) => {
    if (!invoice) return

    try {
      setIsProcessing(true)
      await updateInvoiceStatus(
        invoice.invoice_id,
        newStatus as 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'CANCELLED'
      )
      toast({
        title: 'Berhasil',
        description: 'Status invoice berhasil diupdate',
      })
      loadInvoice()
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Gagal mengupdate status invoice',
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleRecordPayment = async () => {
    if (!invoice || !paymentAmount) return

    try {
      setIsProcessing(true)
      await recordPayment(invoice.invoice_id, {
        payment_date: paymentDate,
        payment_method: paymentMethod,
        amount: parseFloat(paymentAmount),
        reference_number: paymentReference || undefined,
        notes: paymentNotes || undefined,
      })

      toast({
        title: 'Berhasil',
        description: 'Pembayaran berhasil dicatat',
      })

      setIsPaymentDialogOpen(false)
      resetPaymentForm()
      loadInvoice()
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Gagal mencatat pembayaran',
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDelete = async () => {
    if (!invoice || !confirm('Apakah Anda yakin ingin menghapus invoice ini?')) return

    try {
      setIsProcessing(true)
      await deleteInvoice(invoice.invoice_id)
      toast({
        title: 'Berhasil',
        description: 'Invoice berhasil dihapus',
      })
      router.push('/dashboard/keuangan/invoices')
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Gagal menghapus invoice',
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleExportPDF = async () => {
    if (!invoice) return
    
    try {
      setIsProcessing(true)
      
      exportInvoiceToPDF({
        invoice,
        items,
        payments,
        invoiceConfig,
      })

      toast({
        title: 'Sukses',
        description: 'Invoice berhasil di-export ke PDF',
      })
    } catch (error: any) {
      console.error('Export PDF error:', error)
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Gagal export PDF',
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const resetPaymentForm = () => {
    setPaymentDate(new Date().toISOString().split('T')[0])
    setPaymentMethod('TRANSFER')
    setPaymentAmount('')
    setPaymentReference('')
    setPaymentNotes('')
  }

  const generateWhatsAppMessage = () => {
    if (!invoice || !invoiceConfig) return ''

    const companyName = invoiceConfig.company_name || 'AC Service Dashboard'
    const customerName = invoice.customers?.customer_name || 'Customer'
    const invoiceNumber = invoice.invoice_number
    const invoiceDate = format(new Date(invoice.invoice_date), 'dd MMMM yyyy', { locale: localeId })
    const dueDate = format(new Date(invoice.due_date), 'dd MMMM yyyy', { locale: localeId })
    const totalAmount = formatCurrency(invoice.total_amount)
    const balanceDue = formatCurrency(invoice.total_amount - invoice.paid_amount)

    let message = `Halo ${customerName},\n\n`
    message += `Terima kasih telah menggunakan layanan *${companyName}*.\n\n`
    message += `Berikut adalah invoice untuk layanan yang telah kami berikan:\n\n`
    message += `📄 *INVOICE DETAILS*\n`
    message += `• No. Invoice: *${invoiceNumber}*\n`
    message += `• Tanggal: ${invoiceDate}\n`
    message += `• Jatuh Tempo: ${dueDate}\n`
    message += `• Total Tagihan: *${totalAmount}*\n`

    if (invoice.paid_amount > 0) {
      message += `• Sudah Dibayar: ${formatCurrency(invoice.paid_amount)}\n`
      message += `• Sisa Tagihan: *${balanceDue}*\n`
    }

    message += `\n📋 *RINCIAN LAYANAN*\n`
    items.slice(0, 5).forEach((item, index) => {
      message += `${index + 1}. ${item.description} (${item.quantity}x) - ${formatCurrency(item.total_price)}\n`
    })
    if (items.length > 5) {
      message += `... dan ${items.length - 5} item lainnya\n`
    }

    // Bank accounts
    if (invoiceConfig.bank_accounts) {
      try {
        const bankAccounts = JSON.parse(invoiceConfig.bank_accounts)
        if (bankAccounts.length > 0) {
          message += `\n💳 *PEMBAYARAN*\n`
          message += `Silakan transfer ke salah satu rekening:\n\n`
          bankAccounts.forEach((account: any, index: number) => {
            message += `${index + 1}. *${account.bank}*\n`
            message += `   ${account.account_number}\n`
            message += `   a/n ${account.account_name}\n\n`
          })
          message += `_Mohon cantumkan No. Invoice (${invoiceNumber}) dalam keterangan transfer._\n`
        }
      } catch (e) {
        console.error('Failed to parse bank accounts:', e)
      }
    }

    message += `\n---\n`
    message += `Jika ada pertanyaan, silakan hubungi kami.\n\n`
    message += `Terima kasih! 🙏`

    return message
  }

  const handleSendWhatsApp = async () => {
    if (!invoice?.customers?.phone_number) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Nomor WhatsApp customer tidak ditemukan',
      })
      return
    }

    try {
      const message = generateWhatsAppMessage()
      const phoneNumber = invoice.customers.phone_number.replace(/^0/, '62').replace(/\D/g, '')
      const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`

      // Log communication
      await logInvoiceCommunication({
        invoiceId: invoice.invoice_id,
        type: 'WHATSAPP',
        recipient: invoice.customers.phone_number,
      })

      // Open WhatsApp
      window.open(whatsappUrl, '_blank')

      // Reload invoice to update status and stats
      await loadInvoice()

      toast({
        title: 'WhatsApp Dibuka ✅',
        description: 'Pesan invoice siap dikirim ke customer',
      })
    } catch (error: any) {
      console.error('WhatsApp error:', error)
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Gagal membuka WhatsApp',
      })
    }
  }

  const generateEmailContent = () => {
    if (!invoice || !invoiceConfig) return { subject: '', body: '' }

    const companyName = invoiceConfig.company_name || 'AC Service Dashboard'
    const customerName = invoice.customers?.customer_name || 'Customer'
    const invoiceNumber = invoice.invoice_number
    const invoiceDate = format(new Date(invoice.invoice_date), 'dd MMMM yyyy', { locale: localeId })
    const dueDate = format(new Date(invoice.due_date), 'dd MMMM yyyy', { locale: localeId })
    const totalAmount = formatCurrency(invoice.total_amount)
    const balanceDue = formatCurrency(invoice.total_amount - invoice.paid_amount)

    const subject = `Invoice ${invoiceNumber} - ${companyName}`

    let body = `Dear ${customerName},\n\n`
    body += `Terima kasih telah menggunakan layanan ${companyName}.\n\n`
    body += `Terlampir adalah invoice untuk layanan yang telah kami berikan:\n\n`
    body += `INVOICE DETAILS\n`
    body += `═══════════════════════════════\n`
    body += `No. Invoice    : ${invoiceNumber}\n`
    body += `Tanggal        : ${invoiceDate}\n`
    body += `Jatuh Tempo    : ${dueDate}\n`
    body += `Total Tagihan  : ${totalAmount}\n`

    if (invoice.paid_amount > 0) {
      body += `Sudah Dibayar  : ${formatCurrency(invoice.paid_amount)}\n`
      body += `Sisa Tagihan   : ${balanceDue}\n`
    }

    body += `\n\nRINCIAN LAYANAN\n`
    body += `═══════════════════════════════\n`
    items.forEach((item, index) => {
      body += `${index + 1}. ${item.description}\n`
      body += `   ${item.quantity} x ${formatCurrency(item.unit_price)} = ${formatCurrency(item.total_price)}\n\n`
    })

    body += `───────────────────────────────\n`
    body += `Subtotal       : ${formatCurrency(invoice.subtotal)}\n`
    if (invoice.discount_amount > 0) {
      body += `Diskon         : -${formatCurrency(invoice.discount_amount)}\n`
    }
    body += `Pajak (${invoice.tax_percentage}%)    : ${formatCurrency(invoice.tax_amount)}\n`
    body += `───────────────────────────────\n`
    body += `TOTAL          : ${totalAmount}\n`

    if (invoice.paid_amount > 0) {
      body += `Dibayar        : -${formatCurrency(invoice.paid_amount)}\n`
      body += `SISA TAGIHAN   : ${balanceDue}\n`
    }

    // Bank accounts
    if (invoiceConfig.bank_accounts) {
      try {
        const bankAccounts = JSON.parse(invoiceConfig.bank_accounts)
        if (bankAccounts.length > 0) {
          body += `\n\nINFORMASI PEMBAYARAN\n`
          body += `═══════════════════════════════\n`
          body += `Silakan transfer ke salah satu rekening berikut:\n\n`
          bankAccounts.forEach((account: any, index: number) => {
            body += `${index + 1}. ${account.bank}\n`
            body += `   No. Rekening: ${account.account_number}\n`
            body += `   Atas Nama: ${account.account_name}\n\n`
          })
          body += `Mohon cantumkan No. Invoice (${invoiceNumber}) dalam keterangan transfer.\n`
        }
      } catch (e) {
        console.error('Failed to parse bank accounts:', e)
      }
    }

    if (invoiceConfig.terms_conditions_template) {
      body += `\n\nSYARAT DAN KETENTUAN\n`
      body += `═══════════════════════════════\n`
      body += `${invoiceConfig.terms_conditions_template}\n`
    }

    body += `\n\n───────────────────────────────\n`
    body += `Jika ada pertanyaan, silakan hubungi kami:\n`
    if (invoiceConfig.company_phone) {
      body += `Telepon: ${invoiceConfig.company_phone}\n`
    }
    if (invoiceConfig.company_email) {
      body += `Email: ${invoiceConfig.company_email}\n`
    }
    body += `\nTerima kasih atas kepercayaan Anda!\n\n`
    body += `Best regards,\n`
    body += `${companyName} Team`

    return { subject, body }
  }

  const handleSendEmail = async () => {
    if (!invoice?.customers?.email) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Email customer tidak ditemukan',
      })
      return
    }

    try {
      setIsProcessing(true)

      const response = await fetch('/api/invoices/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invoiceId: invoice.invoice_id,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send email')
      }

      toast({
        title: 'Email Terkirim! ✅',
        description: `Invoice berhasil dikirim ke ${invoice.customers.email}`,
      })

      // Update invoice status to SENT if still DRAFT
      if (invoice.status === 'DRAFT') {
        await updateInvoiceStatus(invoice.invoice_id, 'SENT')
        await loadInvoice() // Reload to show new status
      }
    } catch (error: any) {
      console.error('Send email error:', error)
      toast({
        variant: 'destructive',
        title: 'Gagal Kirim Email',
        description: error.message || 'Terjadi kesalahan saat mengirim email',
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!invoice) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-semibold">Invoice tidak ditemukan</h3>
        <Button onClick={() => router.back()} className="mt-4">
          Kembali
        </Button>
      </div>
    )
  }

  const remainingAmount = invoice.total_amount - invoice.paid_amount

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{invoice.invoice_number}</h1>
            <p className="text-muted-foreground">Detail invoice</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={handleSendWhatsApp} 
            disabled={!invoice?.customers?.phone_number || isProcessing}
            className="bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
          >
            <Send className="mr-2 h-4 w-4" />
            Send to WhatsApp
          </Button>
          <Button 
            variant="outline" 
            onClick={handleSendEmail} 
            disabled={!invoice?.customers?.email || isProcessing}
            className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Mengirim...
              </>
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                Send to Email
              </>
            )}
          </Button>
          <Button variant="outline" onClick={handleExportPDF} disabled={isProcessing}>
            <Download className="mr-2 h-4 w-4" />
            Export PDF
          </Button>
          {invoice.status === 'DRAFT' && (
            <Button variant="destructive" onClick={handleDelete} disabled={isProcessing}>
              <Trash2 className="mr-2 h-4 w-4" />
              Hapus
            </Button>
          )}
        </div>
      </div>

      {/* Communication Stats Banner */}
      {communicationStats.totalSent > 0 && (
        <Card className="bg-gradient-to-r from-blue-50 to-green-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="text-sm font-medium text-gray-700">Email Sent</p>
                    <p className="text-2xl font-bold text-blue-600">{communicationStats.emailSent}x</p>
                  </div>
                </div>
                <Separator orientation="vertical" className="h-12" />
                <div className="flex items-center gap-2">
                  <Send className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="text-sm font-medium text-gray-700">WhatsApp Sent</p>
                    <p className="text-2xl font-bold text-green-600">{communicationStats.whatsappSent}x</p>
                  </div>
                </div>
              </div>
              {communicationStats.lastSentAt && (
                <div className="text-right">
                  <p className="text-sm text-gray-600">Last Sent via {communicationStats.lastSentType}</p>
                  <p className="text-sm font-medium text-gray-800">
                    {format(new Date(communicationStats.lastSentAt), "dd MMM yyyy 'at' HH:mm", { locale: localeId })}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          {/* Invoice Header */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>Invoice Details</CardTitle>
                  <CardDescription>
                    Created {format(new Date(invoice.created_at), 'dd MMM yyyy', { locale: localeId })}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Badge className={STATUS_COLORS[invoice.status]}>{invoice.status}</Badge>
                  <Badge
                    className={
                      invoice.payment_status === 'PAID'
                        ? 'bg-green-500'
                        : invoice.payment_status === 'PARTIAL'
                        ? 'bg-amber-500'
                        : 'bg-red-500'
                    }
                  >
                    {invoice.payment_status}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Customer</Label>
                  <p className="font-semibold">{invoice.customers?.customer_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {invoice.customers?.phone_number}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Order ID</Label>
                  <p className="font-mono font-semibold">{invoice.order_id}</p>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Invoice Date</Label>
                  <p>{format(new Date(invoice.invoice_date), 'dd MMM yyyy', { locale: localeId })}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Due Date</Label>
                  <p>{format(new Date(invoice.due_date), 'dd MMM yyyy', { locale: localeId })}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Invoice Items */}
          <Card>
            <CardHeader>
              <CardTitle>Line Items</CardTitle>
            </CardHeader>
            <CardContent>
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
                          <Badge variant="outline" className="text-xs">
                            {item.item_type}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(item.unit_price)}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(item.total_price)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <Separator className="my-4" />

              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span className="font-semibold">{formatCurrency(invoice.subtotal)}</span>
                </div>
                {invoice.discount_amount > 0 && (
                  <div className="flex justify-between">
                    <span>Discount:</span>
                    <span className="font-semibold text-red-600">
                      - {formatCurrency(invoice.discount_amount)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Tax ({invoice.tax_percentage}%):</span>
                  <span className="font-semibold">{formatCurrency(invoice.tax_amount)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg">
                  <span className="font-bold">Total:</span>
                  <span className="font-bold text-primary">
                    {formatCurrency(invoice.total_amount)}
                  </span>
                </div>
                {invoice.paid_amount > 0 && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-green-600">Paid:</span>
                      <span className="font-semibold text-green-600">
                        - {formatCurrency(invoice.paid_amount)}
                      </span>
                    </div>
                    <div className="flex justify-between text-lg">
                      <span className="font-bold">Remaining:</span>
                      <span className="font-bold text-red-600">
                        {formatCurrency(remainingAmount)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Payment History */}
          {payments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Payment History</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((payment) => (
                      <TableRow key={payment.payment_id}>
                        <TableCell>
                          {format(new Date(payment.payment_date), 'dd MMM yyyy', {
                            locale: localeId,
                          })}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{payment.payment_method}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {payment.reference_number || '-'}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-green-600">
                          {formatCurrency(payment.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Actions Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={invoice.status} onValueChange={handleStatusChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DRAFT">Draft</SelectItem>
                    <SelectItem value="SENT">Sent</SelectItem>
                    <SelectItem value="PAID">Paid</SelectItem>
                    <SelectItem value="OVERDUE">Overdue</SelectItem>
                    <SelectItem value="CANCELLED">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {invoice.payment_status !== 'PAID' && (
                <Button
                  className="w-full"
                  onClick={() => {
                    setPaymentAmount(remainingAmount.toString())
                    setIsPaymentDialogOpen(true)
                  }}
                >
                  <DollarSign className="mr-2 h-4 w-4" />
                  Record Payment
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payment Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm">Total:</span>
                <span className="font-semibold">{formatCurrency(invoice.total_amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-green-600">Paid:</span>
                <span className="font-semibold text-green-600">
                  {formatCurrency(invoice.paid_amount)}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="font-semibold">Remaining:</span>
                <span className="font-bold text-red-600">
                  {formatCurrency(remainingAmount)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Payment Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>Catat pembayaran untuk invoice ini</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Payment Date</Label>
              <Input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">Cash</SelectItem>
                  <SelectItem value="TRANSFER">Transfer</SelectItem>
                  <SelectItem value="CREDIT_CARD">Credit Card</SelectItem>
                  <SelectItem value="DEBIT_CARD">Debit Card</SelectItem>
                  <SelectItem value="QRIS">QRIS</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="0"
              />
              <p className="text-sm text-muted-foreground">
                Remaining: {formatCurrency(remainingAmount)}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Reference Number</Label>
              <Input
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder="Transfer reference, receipt number, etc."
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder="Optional notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsPaymentDialogOpen(false)
                resetPaymentForm()
              }}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button onClick={handleRecordPayment} disabled={isProcessing || !paymentAmount}>
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                'Record Payment'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
