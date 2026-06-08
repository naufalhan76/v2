'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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
import { SearchableSelect } from '@/components/ui/searchable-select'
import { useToast } from '@/hooks/use-toast'
import {
  Loader2,
  ArrowLeft,
  Download,
  DollarSign,
  Trash2,
  XCircle,
  Send,
  Mail,
  MapPin,
  Pencil,
  Plus,
  Save,
  X,
  FileText,
  AlertCircle,
  Receipt,
} from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { TableSkeleton } from '@/components/ui/skeleton'
import {
  getInvoiceById,
  updateInvoiceStatus,
  deleteInvoice,
  reviseInvoice,
  type Invoice,
  type InvoiceItem,
  type PaymentRecord,
  type ReviseInvoiceItemInput,
} from '@/lib/actions/invoices'
import { RecordPaymentModal } from '@/components/invoices/record-payment-modal'
import { getInvoiceConfig, type InvoiceConfig } from '@/lib/actions/invoice-config'
import { parseBankAccounts, type BankAccount } from '@/lib/bank-accounts'
import { 
  logInvoiceCommunication, 
  getInvoiceCommunicationStats 
} from '@/lib/actions/invoice-communications'
import { exportInvoiceToPDF } from '@/lib/pdf-export'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { logger } from '@/lib/logger'
import { formatPhone } from '@/lib/utils'
import { canReviseInvoice } from '@/lib/invoice-utils'
import { InvoiceStatusBadge } from '@/components/invoices/invoice-status-badge'

const getInvoiceSourceLabel = (source?: Invoice['source']) => (source === 'BLANK' ? 'Kosong' : 'Transaksi')

const getInvoiceSourceVariant = (source?: Invoice['source']) => (source === 'BLANK' ? 'secondary' : 'default')

const formatBankAccountLine = (account: { account_label: string; bank: string; account_number: string; account_name: string }) => {
  return `${account.account_label} — ${account.bank} / ${account.account_number} / a/n ${account.account_name}`
}

export default function InvoiceDetailPage() {
  const router = useRouter()

  function handleBack() {
    if (window.history.length > 1) {
      router.back()
    } else {
      router.push('/dashboard/keuangan/invoices')
    }
  }
  const params = useParams()
  const searchParams = useSearchParams()
  const invoiceId = params?.id as string
  const isPrefilledFromReport = searchParams?.get('prefilled') === 'service-report'
  const { toast } = useToast()
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [items, setItems] = useState<InvoiceItem[]>([])
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [orderItemsDetailed, setOrderItemsDetailed] = useState<Record<string, unknown>[]>([])
  const [invoiceConfig, setInvoiceConfig] = useState<InvoiceConfig | null>(null)
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [communicationStats, setCommunicationStats] = useState({
    totalSent: 0,
    emailSent: 0,
    whatsappSent: 0,
    lastSentAt: null as string | null,
    lastSentType: null as string | null,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  // Revision mode state
  type RevisionItemDraft = {
    item_id?: string
    item_type: 'BASE_SERVICE' | 'ADDON'
    description: string
    quantity: number
    unit_price: number
    line_order: number
  }
  type RevisionDraft = {
    customer_name: string
    customer_phone: string
    customer_email: string
    customer_address: string
    due_date: string
    notes: string
    terms_conditions: string
    discount_amount: number
    tax_percentage: number
    payment_account_id: string
    items: RevisionItemDraft[]
  }
  const [isRevisionMode, setIsRevisionMode] = useState(false)
  const [isSavingRevision, setIsSavingRevision] = useState(false)
  const [revisionDraft, setRevisionDraft] = useState<RevisionDraft | null>(null)

  useEffect(() => {
    if (invoiceId) {
      loadInvoice()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        setOrderItemsDetailed(data.orderItemsDetailed || [])
      }
      setInvoiceConfig(config)
      setBankAccounts(parseBankAccounts(config?.bank_accounts))
      setCommunicationStats(stats)
    } catch {
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
        newStatus as 'DRAFT' | 'SENT' | 'PARTIAL_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED'
      )
      toast({
        title: 'Berhasil',
        description: 'Status invoice berhasil diupdate',
      })
      loadInvoice()
    } catch (_error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Gagal mengupdate status invoice',
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDelete = async () => {
    if (!invoice) return

    try {
      setIsProcessing(true)
      await deleteInvoice(invoice.invoice_id)
      toast({
        title: 'Berhasil',
        description: 'Invoice berhasil dihapus',
      })
      router.push('/dashboard/keuangan/invoices')
    } catch (error: unknown) {
      toast({
        variant: 'destructive',
        title: 'Tidak Dapat Menghapus',
        description: error instanceof Error ? error.message : 'Gagal menghapus invoice',
      })
    } finally {
      setIsProcessing(false)
      setIsDeleteDialogOpen(false)
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
        orderItemsDetailed,
      })

      toast({
        title: 'Sukses',
        description: 'Invoice berhasil di-export ke PDF',
      })
    } catch (error: unknown) {
      logger.error('Export PDF error:', error)
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Gagal export PDF',
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const buildRevisionDraft = (): RevisionDraft | null => {
    if (!invoice) return null
    return {
      customer_name:
        invoice.customer_name_override ?? invoice.customers?.customer_name ?? '',
      customer_phone:
        invoice.customer_phone_override ?? invoice.customers?.phone_number ?? '',
      customer_email:
        invoice.customer_email_override ?? invoice.customers?.email ?? '',
      customer_address:
        invoice.customer_address_override ?? invoice.customers?.billing_address ?? '',
      due_date: invoice.due_date ? invoice.due_date.slice(0, 10) : '',
      notes: invoice.notes ?? '',
      terms_conditions: invoice.terms_conditions ?? '',
      discount_amount: invoice.discount_amount ?? 0,
      tax_percentage: invoice.tax_percentage ?? 0,
      payment_account_id:
        (invoice as Invoice & { payment_account_id?: string | null }).payment_account_id ?? '',
      items: items.map((it, idx) => ({
        item_id: it.item_id,
        item_type: (it.item_type === 'ADDON' ? 'ADDON' : 'BASE_SERVICE') as 'BASE_SERVICE' | 'ADDON',
        description: it.description,
        quantity: it.quantity,
        unit_price: it.unit_price,
        line_order: it.line_order ?? idx,
      })),
    }
  }

  const handleEnterRevisionMode = () => {
    if (!invoice) return
    if (!canReviseInvoice(invoice.status)) {
      toast({
        variant: 'destructive',
        title: 'Tidak dapat direvisi',
        description: 'Invoice hanya dapat direvisi saat berstatus DRAFT atau SENT',
      })
      return
    }
    const draft = buildRevisionDraft()
    if (!draft) return
    setRevisionDraft(draft)
    setIsRevisionMode(true)
  }

  const handleCancelRevision = () => {
    setIsRevisionMode(false)
    setRevisionDraft(null)
  }

  const updateRevisionField = <K extends keyof RevisionDraft>(field: K, value: RevisionDraft[K]) => {
    setRevisionDraft((prev) => (prev ? { ...prev, [field]: value } : prev))
  }

  const updateRevisionItem = (
    index: number,
    patch: Partial<RevisionItemDraft>
  ) => {
    setRevisionDraft((prev) => {
      if (!prev) return prev
      const next = [...prev.items]
      next[index] = { ...next[index], ...patch }
      return { ...prev, items: next }
    })
  }

  const addRevisionItem = () => {
    setRevisionDraft((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        items: [
          ...prev.items,
          {
            item_type: 'BASE_SERVICE',
            description: '',
            quantity: 1,
            unit_price: 0,
            line_order: prev.items.length,
          },
        ],
      }
    })
  }

  const removeRevisionItem = (index: number) => {
    setRevisionDraft((prev) => {
      if (!prev) return prev
      const next = prev.items.filter((_, i) => i !== index)
      return { ...prev, items: next.map((it, i) => ({ ...it, line_order: i })) }
    })
  }

  const handleSaveRevision = async () => {
    if (!invoice || !revisionDraft) return

    if (revisionDraft.items.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Item kosong',
        description: 'Minimal satu item invoice harus diisi',
      })
      return
    }

    for (const item of revisionDraft.items) {
      if (!item.description.trim()) {
        toast({
          variant: 'destructive',
          title: 'Deskripsi item kosong',
          description: 'Setiap item harus memiliki deskripsi',
        })
        return
      }
      if (!(item.quantity > 0)) {
        toast({
          variant: 'destructive',
          title: 'Kuantitas tidak valid',
          description: 'Kuantitas item harus lebih dari 0',
        })
        return
      }
      if (item.unit_price < 0) {
        toast({
          variant: 'destructive',
          title: 'Harga tidak valid',
          description: 'Harga satuan tidak boleh negatif',
        })
        return
      }
    }

    const isLinkedCustomer = Boolean(invoice.customer_id)
    const headerUpdates: Record<string, unknown> = {
      due_date: revisionDraft.due_date,
      notes: revisionDraft.notes || null,
      terms_conditions: revisionDraft.terms_conditions || null,
      discount_amount: Number(revisionDraft.discount_amount) || 0,
      tax_percentage: Number(revisionDraft.tax_percentage) || 0,
    }

    if (!isLinkedCustomer) {
      headerUpdates.customer_name_override = revisionDraft.customer_name.trim() || null
      headerUpdates.customer_phone_override = revisionDraft.customer_phone.trim() || null
      headerUpdates.customer_email_override = revisionDraft.customer_email.trim() || null
      headerUpdates.customer_address_override = revisionDraft.customer_address.trim() || null
    }

    if (revisionDraft.payment_account_id) {
      const selected = bankAccounts.find((acc) => acc.id === revisionDraft.payment_account_id)
      if (selected) {
        headerUpdates.payment_account_id = selected.id
        headerUpdates.payment_account_label = selected.account_label
        headerUpdates.payment_bank_name = selected.bank
        headerUpdates.payment_account_number = selected.account_number
        headerUpdates.payment_account_name = selected.account_name
        if (typeof selected.tax_percentage === 'number') {
          headerUpdates.tax_percentage = selected.tax_percentage
        }
      }
    } else {
      headerUpdates.payment_account_id = null
      headerUpdates.payment_account_label = null
      headerUpdates.payment_bank_name = null
      headerUpdates.payment_account_number = null
      headerUpdates.payment_account_name = null
    }

    const itemsPayload: ReviseInvoiceItemInput[] = revisionDraft.items.map((it, idx) => ({
      item_id: it.item_id,
      item_type: it.item_type,
      description: it.description.trim(),
      quantity: Number(it.quantity),
      unit_price: Number(it.unit_price),
      line_order: idx,
    }))

    try {
      setIsSavingRevision(true)
      await reviseInvoice(invoice.invoice_id, headerUpdates, itemsPayload)
      toast({
        title: 'Revisi tersimpan',
        description: 'Invoice berhasil diperbarui',
      })
      setIsRevisionMode(false)
      setRevisionDraft(null)
      await loadInvoice()
    } catch (error: unknown) {
      logger.error('Save revision error:', error)
      toast({
        variant: 'destructive',
        title: 'Gagal menyimpan revisi',
        description: error instanceof Error ? error.message : 'Terjadi kesalahan',
      })
    } finally {
      setIsSavingRevision(false)
    }
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
    const bankAccounts = parseBankAccounts(invoiceConfig.bank_accounts)
    if (bankAccounts.length > 0) {
          message += `\n💳 *PEMBAYARAN*\n`
          message += `Silakan transfer ke salah satu rekening:\n\n`
          bankAccounts.forEach((account, index: number) => {
            message += `${index + 1}. *${formatBankAccountLine(account)}*\n\n`
          })
          message += `_Mohon cantumkan No. Invoice (${invoiceNumber}) dalam keterangan transfer._\n`
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
        title: 'WhatsApp Dibuka',
        description: 'Pesan invoice siap dikirim ke customer',
      })
    } catch (error: unknown) {
      logger.error('WhatsApp error:', error)
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Gagal membuka WhatsApp',
      })
    }
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
        title: 'Email Terkirim',
        description: `Invoice berhasil dikirim ke ${invoice.customers.email}`,
      })

      // Update invoice status to SENT if still DRAFT
      if (invoice.status === 'DRAFT') {
        await updateInvoiceStatus(invoice.invoice_id, 'SENT')
        await loadInvoice() // Reload to show new status
      }
    } catch (error: unknown) {
      logger.error('Send email error:', error)
      toast({
        variant: 'destructive',
        title: 'Gagal Kirim Email',
        description: error instanceof Error ? error.message : 'Terjadi kesalahan saat mengirim email',
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
      <div className="space-y-6">
        {/* header */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-7 w-48 rounded bg-muted animate-pulse" />
            <div className="h-4 w-32 rounded bg-muted animate-pulse" />
          </div>
          <div className="h-10 w-32 rounded bg-muted animate-pulse" />
        </div>
        {/* meta grid */}
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 rounded-lg border bg-card p-3">
              <div className="h-3 w-20 rounded bg-muted animate-pulse mb-2" />
              <div className="h-5 w-32 rounded bg-muted animate-pulse" />
            </div>
          ))}
        </div>
        {/* line items */}
        <TableSkeleton rows={4} columns={5} />
      </div>
    )
  }

  if (!invoice) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-semibold">Invoice tidak ditemukan</h3>
        <Button onClick={handleBack} className="mt-4">
          Kembali
        </Button>
      </div>
    )
  }

  const remainingAmount = invoice.total_amount - invoice.paid_amount
  const displayStatus = invoice.computed_status ?? invoice.status
  const isBlankInvoice = invoice.source === 'BLANK'
  const customerDisplayName = isBlankInvoice
    ? invoice.customer_name_override ?? invoice.customers?.customer_name ?? '—'
    : invoice.customers?.customer_name ?? invoice.customer_name_override ?? '—'
  const customerDisplayPhone = isBlankInvoice
    ? invoice.customer_phone_override ?? invoice.customers?.phone_number ?? ''
    : invoice.customers?.phone_number ?? invoice.customer_phone_override ?? ''
  const customerDisplayEmail = isBlankInvoice
    ? invoice.customer_email_override ?? invoice.customers?.email ?? ''
    : invoice.customers?.email ?? invoice.customer_email_override ?? ''
  const customerDisplayAddress = isBlankInvoice
    ? invoice.customer_address_override ?? invoice.customers?.billing_address ?? ''
    : invoice.customers?.billing_address ?? invoice.customer_address_override ?? ''
  const displayOrderId = invoice.order_id ?? '—'
  const revisionHelpMessage =
    invoice.status === 'PAID'
      ? 'Invoice telah dibayar — tidak dapat direvisi'
      : invoice.status === 'OVERDUE'
      ? 'Invoice melewati jatuh tempo — tidak dapat direvisi'
      : invoice.status === 'CANCELLED'
      ? 'Invoice dibatalkan — tidak dapat direvisi'
      : ''

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3 sm:gap-4 min-w-0">
          <Button variant="ghost" aria-label="Kembali" onClick={handleBack} className="shrink-0 min-h-[44px] min-w-[44px]">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight break-all">{invoice.invoice_number}</h1>
              <Badge variant={getInvoiceSourceVariant(invoice.source)}>
                {getInvoiceSourceLabel(invoice.source)}
              </Badge>
              <Badge variant={invoice.invoice_type === 'FINAL' ? 'default' : 'secondary'}>
                {invoice.invoice_type}
              </Badge>
            </div>
            <p className="text-sm sm:text-base text-muted-foreground">
              {invoice.invoice_type === 'PROFORMA' ? 'Invoice Proforma' : 'Invoice Final'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={handleSendWhatsApp}
            disabled={!invoice?.customers?.phone_number || isProcessing}
            className="bg-green-50 hover:bg-green-100 text-green-700 border-green-200 flex-1 sm:flex-initial min-h-[44px]"
          >
            <Send className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Send to </span>WhatsApp
          </Button>
          <Button
            variant="outline"
            onClick={handleSendEmail}
            disabled={!invoice?.customers?.email || isProcessing}
            className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200 flex-1 sm:flex-initial min-h-[44px]"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Mengirim...
              </>
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Send to </span>Email
              </>
            )}
          </Button>
          <Button variant="outline" onClick={handleExportPDF} disabled={isProcessing} className="flex-1 sm:flex-initial min-h-[44px]">
            <Download className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Export </span>PDF
          </Button>
          {/* Edit / Revisi — only for DRAFT/SENT */}
          {!isRevisionMode && canReviseInvoice(invoice.status) && (
            <Button
              variant="outline"
              onClick={handleEnterRevisionMode}
              disabled={isProcessing}
              className="border-amber-200 text-amber-700 hover:bg-amber-50 flex-1 sm:flex-initial min-h-[44px]"
              data-testid="invoice-edit-revisi-button"
            >
              <Pencil className="mr-2 h-4 w-4" />
              Edit / Revisi
            </Button>
          )}
          {!isRevisionMode && revisionHelpMessage && (
            <p className="w-full sm:w-auto sm:max-w-[18rem] text-xs leading-relaxed text-muted-foreground">
              {revisionHelpMessage}
            </p>
          )}
          {isRevisionMode && (
            <>
              <Button
                onClick={handleSaveRevision}
                disabled={isSavingRevision}
                data-testid="invoice-save-revision"
                className="flex-1 sm:flex-initial min-h-[44px]"
              >
                {isSavingRevision ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Simpan Revisi
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={handleCancelRevision}
                disabled={isSavingRevision}
                data-testid="invoice-cancel-revision"
                className="flex-1 sm:flex-initial min-h-[44px]"
              >
                <X className="mr-2 h-4 w-4" />
                Batal
              </Button>
            </>
          )}
          {/* Only show delete button for DRAFT invoices */}
          {!isRevisionMode && invoice.status === 'DRAFT' && (
            <Button
              variant="destructive"
              onClick={() => setIsDeleteDialogOpen(true)}
              disabled={isProcessing}
              className="flex-1 sm:flex-initial min-h-[44px]"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Hapus
            </Button>
          )}
          {/* Show cancel button for non-DRAFT invoices */}
          {!isRevisionMode && invoice.status !== 'DRAFT' && invoice.status !== 'CANCELLED' && (
            <Button
              variant="outline"
              onClick={() => handleStatusChange('CANCELLED')}
              disabled={isProcessing}
              className="border-orange-200 text-orange-700 hover:bg-orange-50 flex-1 sm:flex-initial min-h-[44px]"
            >
              <XCircle className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Cancel </span>Invoice
            </Button>
          )}
        </div>
      </div>

      {/* Communication Stats Banner */}
      {communicationStats.totalSent > 0 && (
        <Card className="bg-muted border-border">
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Email Sent</p>
                    <p className="text-2xl font-bold text-primary">{communicationStats.emailSent}x</p>
                  </div>
                </div>
                <Separator orientation="vertical" className="h-12 hidden sm:block" />
                <div className="flex items-center gap-2">
                  <Send className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="text-sm font-medium text-foreground">WhatsApp Sent</p>
                    <p className="text-2xl font-bold text-green-600">{communicationStats.whatsappSent}x</p>
                  </div>
                </div>
              </div>
              {communicationStats.lastSentAt && (
                <div className="sm:text-right">
                  <p className="text-sm text-muted-foreground">Last Sent via {communicationStats.lastSentType}</p>
                  <p className="text-sm font-medium text-foreground">
                    {format(new Date(communicationStats.lastSentAt), "dd MMM yyyy 'at' HH:mm", { locale: localeId })}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Pre-filled from service report banner */}
          {isPrefilledFromReport && (
            <Card className="border-blue-200 bg-blue-50/40">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <FileText className="h-5 w-5 text-blue-700 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold text-blue-900">
                      Invoice di-populate dari service report
                    </p>
                    <p className="text-sm text-blue-800">
                      Item invoice diambil dari laporan teknisi (foto, material, harga). Anda
                      dapat mengedit item, mengubah pajak/diskon, atau menambah item sebelum
                      mengirim ke customer. Klik <strong>Edit / Revisi</strong> untuk mengubah.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Mode Revisi banner */}
          {isRevisionMode && (
            <Card className="border-amber-300 bg-amber-50">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <Pencil className="h-5 w-5 text-amber-700 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold text-amber-900">Mode Revisi Aktif</p>
                    <p className="text-sm text-amber-800">
                      Anda sedang mengedit invoice <span className="font-mono font-semibold">{invoice.invoice_number}</span>.
                      Nomor invoice dan status tidak dapat diubah. Klik <strong>Simpan Revisi</strong> untuk menerapkan perubahan
                      atau <strong>Batal</strong> untuk membatalkan.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Prominent Remaining Balance banner (partial payment polish) */}
          {invoice.payment_status === 'PARTIAL_PAID' && remainingAmount > 0 && (
            <Card className="border-amber-300 bg-amber-50/60">
              <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-700 shrink-0" />
                  <div>
                    <p className="text-xs uppercase tracking-wide text-amber-800">
                      Sisa Tagihan
                    </p>
                    <p className="text-xl sm:text-2xl font-bold text-amber-900">
                      {formatCurrency(remainingAmount)}
                    </p>
                    <p className="text-xs text-amber-800">
                      Sudah dibayar {formatCurrency(invoice.paid_amount)} dari{' '}
                      {formatCurrency(invoice.total_amount)}
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => setIsPaymentDialogOpen(true)}
                  className="bg-amber-600 hover:bg-amber-700 w-full sm:w-auto min-h-[44px]"
                >
                  <DollarSign className="mr-2 h-4 w-4" />
                  Catat Pembayaran
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Invoice Header */}
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle>Invoice Details</CardTitle>
                  <CardDescription>
                    Created {format(new Date(invoice.created_at), 'dd MMM yyyy', { locale: localeId })}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <InvoiceStatusBadge status={displayStatus} data-testid="invoice-status-badge" />
                  <InvoiceStatusBadge status={invoice.payment_status} />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {isRevisionMode && revisionDraft ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="rev-customer-name">Nama Customer</Label>
                      <Input
                        id="rev-customer-name"
                        value={revisionDraft.customer_name}
                        onChange={(e) => updateRevisionField('customer_name', e.target.value)}
                        disabled={Boolean(invoice.customer_id)}
                        placeholder="Nama customer"
                      />
                      {invoice.customer_id && (
                        <p className="text-xs text-muted-foreground">
                          Customer terhubung — kelola di halaman customer.
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rev-customer-phone">No. Telepon</Label>
                      <Input
                        id="rev-customer-phone"
                        value={revisionDraft.customer_phone}
                        onChange={(e) => updateRevisionField('customer_phone', e.target.value)}
                        disabled={Boolean(invoice.customer_id)}
                        placeholder="08xxxxxxxxxx"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rev-customer-email">Email</Label>
                      <Input
                        id="rev-customer-email"
                        type="email"
                        value={revisionDraft.customer_email}
                        onChange={(e) => updateRevisionField('customer_email', e.target.value)}
                        disabled={Boolean(invoice.customer_id)}
                        placeholder="customer@example.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rev-customer-address">Alamat</Label>
                      <Input
                        id="rev-customer-address"
                        value={revisionDraft.customer_address}
                        onChange={(e) => updateRevisionField('customer_address', e.target.value)}
                        disabled={Boolean(invoice.customer_id)}
                        placeholder="Alamat penagihan"
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Invoice Date</Label>
                      <p>{format(new Date(invoice.invoice_date), 'dd MMM yyyy', { locale: localeId })}</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rev-due-date">Due Date</Label>
                      <Input
                        id="rev-due-date"
                        type="date"
                        value={revisionDraft.due_date}
                        onChange={(e) => updateRevisionField('due_date', e.target.value)}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Customer</Label>
                      <p className="font-semibold">{customerDisplayName}</p>
                      <p className="text-sm text-muted-foreground">
                        {customerDisplayPhone ? formatPhone(customerDisplayPhone) : '—'}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground break-all">
                        {customerDisplayEmail || '—'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {customerDisplayAddress || '—'}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Order ID</Label>
                      <p className="font-mono font-semibold break-all">{displayOrderId}</p>
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Invoice Date</Label>
                      <p>{format(new Date(invoice.invoice_date), 'dd MMM yyyy', { locale: localeId })}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Due Date</Label>
                      <p>{format(new Date(invoice.due_date), 'dd MMM yyyy', { locale: localeId })}</p>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Invoice Items - Detailed Per AC */}
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
              {isRevisionMode && revisionDraft ? (
                <div className="space-y-3" data-testid="invoice-revision-items">
                  {revisionDraft.items.map((item, idx) => (
                    <div key={item.item_id ?? `new-${idx}`} className="rounded-lg border p-3 space-y-3">
                      <div className="grid gap-3 grid-cols-1 md:grid-cols-12">
                        <div className="space-y-1 md:col-span-6">
                          <Label htmlFor={`rev-item-desc-${idx}`}>Deskripsi</Label>
                          <Input
                            id={`rev-item-desc-${idx}`}
                            value={item.description}
                            onChange={(e) => updateRevisionItem(idx, { description: e.target.value })}
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
                                updateRevisionItem(idx, { quantity: parseInt(e.target.value, 10) || 0 })
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
                                updateRevisionItem(idx, { unit_price: parseFloat(e.target.value) || 0 })
                              }
                            />
                          </div>
                        </div>
                        <div className="md:col-span-1 flex md:items-end justify-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeRevisionItem(idx)}
                            disabled={revisionDraft.items.length <= 1}
                            aria-label="Hapus item"
                            className="min-h-[44px] min-w-[44px]"
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </div>
                      <div className="text-right text-sm text-muted-foreground">
                        Subtotal item: {formatCurrency((Number(item.quantity) || 0) * (Number(item.unit_price) || 0))}
                      </div>
                    </div>
                  ))}
                  <Button type="button" variant="outline" onClick={addRevisionItem} className="w-full min-h-[44px]">
                    <Plus className="mr-2 h-4 w-4" />
                    Tambah Item
                  </Button>
                </div>
              ) : orderItemsDetailed.length > 0 ? (
                // Group by location
                (() => {
                  type LocationGroup = { location: Record<string, unknown>; items: Record<string, unknown>[] }
                  const groupedByLocation = orderItemsDetailed.reduce((acc: Record<string, LocationGroup>, item: Record<string, unknown>) => {
                    const locId = (item.location_id as string) || 'unknown'
                    if (!acc[locId]) {
                      acc[locId] = {
                        location: item.locations as Record<string, unknown>,
                        items: []
                      }
                    }
                    acc[locId].items.push(item)
                    return acc
                  }, {})
                  
                  return Object.values(groupedByLocation).map((g, locIdx: number) => (
                    <div key={locIdx} className="border rounded-lg p-4 space-y-3">
                      {/* Location Header */}
                      <div className="font-semibold text-base border-b pb-2">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-primary" />
                          {(g.location?.building_name as string) || 'Unknown Location'}
                        </div>
                        <div className="text-sm text-muted-foreground font-normal mt-1 pl-6">
                          Floor {g.location?.floor as number}, Room {g.location?.room_number as string}
                        </div>
                      </div>

                      {/* AC Units for this location */}
                      <div className="space-y-2">
                        {g.items.map((item: Record<string, unknown>, itemIdx: number) => {
                          const subtotal = ((item.estimated_price as number) || (item.actual_price as number) || 0) * ((item.quantity as number) || 1)
                          const acUnits = item.ac_units as Record<string, unknown> | undefined
                          return (
                            <div key={itemIdx} className="bg-muted/30 rounded-lg p-3 space-y-2">
                              {/* AC Unit Info */}
                              <div className="flex justify-between items-start">
                                <div>
                                  <div className="font-medium text-sm">
                                    {acUnits ? (
                                      <>
                                        {acUnits.brand as string} {acUnits.model_number as string}
                                      </>
                                    ) : (
                                      `New AC Unit ${(item.quantity as number) > 1 ? `(${item.quantity}x)` : ''}`
                                    )}
                                  </div>
                                  {acUnits && (acUnits.serial_number as string) && (
                                    <div className="text-xs text-muted-foreground">
                                      S/N: {acUnits.serial_number as string}
                                    </div>
                                  )}
                                </div>
                                <Badge variant="outline" className="text-xs">
                                  {item.service_type as string}
                                </Badge>
                              </div>

                              {/* Service Details */}
                              <div className="flex justify-between items-center text-sm">
                                <div className="text-muted-foreground">
                                  {(item.description as string) || 'Service'}
                                </div>
                                <div className="font-semibold">
                                  {formatCurrency(subtotal)}
                                </div>
                              </div>

                              {/* Price breakdown if multiple quantity */}
                              {(item.quantity as number) > 1 && (
                                <div className="text-xs text-muted-foreground">
                                  {formatCurrency((item.estimated_price as number) || (item.actual_price as number) || 0)} × {item.quantity as number}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>

                      {/* Location Subtotal */}
                      <div className="flex justify-between items-center pt-2 border-t font-semibold">
                        <span className="text-sm">Location Subtotal:</span>
                        <span>{formatCurrency(g.items.reduce((sum: number, item: Record<string, unknown>) =>
                          sum + (((item.estimated_price as number) || (item.actual_price as number) || 0) * ((item.quantity as number) || 1)), 0
                        ))}</span>
                      </div>
                    </div>
                  ))
                })()
              ) : (
                // Fallback to simple items table if no order items
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
                              <Badge variant="outline" className="text-xs">
                                {item.item_type}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            {formatCurrency(item.unit_price)}
                          </TableCell>
                          <TableCell className="text-right font-semibold whitespace-nowrap">
                            {formatCurrency(item.total_price)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              <Separator className="my-4" />

              {isRevisionMode && revisionDraft ? (
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="rev-discount">Diskon (Rp)</Label>
                      <Input
                        id="rev-discount"
                        type="number"
                        min="0"
                        value={revisionDraft.discount_amount}
                        onChange={(e) =>
                          updateRevisionField('discount_amount', parseFloat(e.target.value) || 0)
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rev-tax">Pajak (%)</Label>
                      <Input
                        id="rev-tax"
                        type="number"
                        min="0"
                        step="0.01"
                        value={revisionDraft.tax_percentage}
                        onChange={(e) =>
                          updateRevisionField('tax_percentage', parseFloat(e.target.value) || 0)
                        }
                      />
                    </div>
                  </div>

                  {bankAccounts.length > 0 && (
                    <div className="space-y-2">
                      <Label htmlFor="rev-payment-account">Rekening Pembayaran</Label>
                      <Select
                        value={revisionDraft.payment_account_id || '__none__'}
                        onValueChange={(value) =>
                          updateRevisionField('payment_account_id', value === '__none__' ? '' : value)
                        }
                      >
                        <SelectTrigger id="rev-payment-account">
                          <SelectValue placeholder="Pilih rekening" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Tidak ada</SelectItem>
                          {bankAccounts.map((acc) => (
                            <SelectItem key={acc.id} value={acc.id}>
                              {acc.account_label} — {acc.bank} / {acc.account_number}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Memilih rekening akan otomatis menerapkan pajak default rekening tersebut.
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="rev-notes">Catatan</Label>
                    <Textarea
                      id="rev-notes"
                      value={revisionDraft.notes}
                      onChange={(e) => updateRevisionField('notes', e.target.value)}
                      placeholder="Catatan tambahan untuk customer"
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="rev-terms">Syarat &amp; Ketentuan</Label>
                    <Textarea
                      id="rev-terms"
                      value={revisionDraft.terms_conditions}
                      onChange={(e) => updateRevisionField('terms_conditions', e.target.value)}
                      placeholder="Syarat dan ketentuan invoice"
                      rows={4}
                    />
                  </div>

                  <div className="rounded-md bg-muted/40 p-3 text-sm">
                    <div className="flex justify-between">
                      <span>Estimasi Subtotal:</span>
                      <span className="font-semibold">
                        {formatCurrency(
                          revisionDraft.items.reduce(
                            (sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0),
                            0
                          )
                        )}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Total final akan dihitung ulang server setelah disimpan.
                    </p>
                  </div>
                </div>
              ) : (
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
              )}
            </CardContent>
          </Card>

          {/* Payment History */}
          <Card>
            <CardHeader>
              <CardTitle>Riwayat Pembayaran</CardTitle>
              <CardDescription>
                {payments.length > 0
                  ? `${payments.length} pembayaran tercatat`
                  : 'Belum ada pembayaran tercatat'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {payments.length === 0 ? (
                <EmptyState
                  icon={Receipt}
                  title="Belum ada pembayaran"
                  description="Catat pembayaran pertama untuk invoice ini lewat tombol di atas."
                />
              ) : (
                <>
                  {/* Mobile cards */}
                  <div className="md:hidden space-y-2">
                    {(() => {
                      const sorted = [...payments].sort(
                        (a, b) =>
                          new Date(a.payment_date).getTime() -
                          new Date(b.payment_date).getTime()
                      )
                      let running = invoice.total_amount
                      const rows = sorted.map((p) => {
                        running -= p.amount
                        return { ...p, balanceAfter: running }
                      })
                      return rows.reverse().map((p) => (
                        <div key={p.payment_id} className="rounded-lg border p-3 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-sm">
                              {format(new Date(p.payment_date), 'dd MMM yyyy', { locale: localeId })}
                            </span>
                            <Badge variant="outline">{p.payment_method}</Badge>
                          </div>
                          {p.reference_number && (
                            <div className="font-mono text-xs text-muted-foreground break-all">
                              {p.reference_number}
                            </div>
                          )}
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-semibold text-green-600">
                              {formatCurrency(p.amount)}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              Sisa: {formatCurrency(p.balanceAfter)}
                            </span>
                          </div>
                        </div>
                      ))
                    })()}
                  </div>

                  {/* Tablet/desktop table */}
                  <div className="hidden md:block overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tanggal</TableHead>
                          <TableHead>Metode</TableHead>
                          <TableHead>Referensi</TableHead>
                          <TableHead className="text-right">Jumlah</TableHead>
                          <TableHead className="text-right">Sisa Setelah</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(() => {
                          // Sort oldest first to compute running balance, then reverse for display
                          const sorted = [...payments].sort(
                            (a, b) =>
                              new Date(a.payment_date).getTime() -
                              new Date(b.payment_date).getTime()
                          )
                          let running = invoice.total_amount
                          const rows = sorted.map((p) => {
                            running -= p.amount
                            return { ...p, balanceAfter: running }
                          })
                          return rows.reverse().map((p) => (
                            <TableRow key={p.payment_id}>
                              <TableCell className="whitespace-nowrap">
                                {format(new Date(p.payment_date), 'dd MMM yyyy', { locale: localeId })}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{p.payment_method}</Badge>
                              </TableCell>
                              <TableCell className="font-mono text-sm break-all">
                                {p.reference_number || '-'}
                              </TableCell>
                              <TableCell className="text-right font-semibold text-green-600 whitespace-nowrap">
                                {formatCurrency(p.amount)}
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground whitespace-nowrap">
                                {formatCurrency(p.balanceAfter)}
                              </TableCell>
                            </TableRow>
                          ))
                        })()}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
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
                <SearchableSelect
                  options={[
                    { id: 'DRAFT', label: 'Draft' },
                    { id: 'SENT', label: 'Sent' },
                    { id: 'PARTIAL_PAID', label: 'Partial Paid' },
                    { id: 'PAID', label: 'Paid' },
                    { id: 'OVERDUE', label: 'Overdue' },
                    { id: 'CANCELLED', label: 'Cancelled' },
                  ]}
                  value={invoice.status}
                  onValueChange={handleStatusChange}
                  placeholder="Pilih status"
                  searchPlaceholder="Cari status..."
                />
              </div>

              <Separator />

              {invoice.payment_status !== 'PAID' && (
                <Button
                  className="w-full"
                  onClick={() => setIsPaymentDialogOpen(true)}
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
      <RecordPaymentModal
        open={isPaymentDialogOpen}
        onOpenChange={setIsPaymentDialogOpen}
        invoice={invoice}
        onSuccess={loadInvoice}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Hapus Invoice</DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin menghapus invoice <strong>{invoice?.invoice_number}</strong>?
              <br />
              <span className="text-red-600 font-medium mt-2 block">
                Tindakan ini tidak dapat dibatalkan.
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-2">
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={isProcessing}
              className="min-h-[44px]"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isProcessing}
              className="min-h-[44px]"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Menghapus...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Ya, Hapus
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
