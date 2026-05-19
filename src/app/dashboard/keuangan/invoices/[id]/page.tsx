'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
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
} from 'lucide-react'
import {
  getInvoiceById,
  updateInvoiceStatus,
  recordPayment,
  deleteInvoice,
  reviseInvoice,
  type Invoice,
  type InvoiceItem,
  type PaymentRecord,
  type ReviseInvoiceItemInput,
} from '@/lib/actions/invoices'
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
import { getInvoiceStatusLabel } from '@/lib/invoice-status'
import { canReviseInvoice } from '@/lib/invoice-utils'

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-500',
  SENT: 'bg-blue-500',
  PARTIAL_PAID: 'bg-amber-500',
  PAID: 'bg-green-500',
  OVERDUE: 'bg-red-500',
  CANCELLED: 'bg-gray-400',
}

const getInvoiceSourceLabel = (source?: Invoice['source']) => (source === 'BLANK' ? 'Kosong' : 'Transaksi')

const getInvoiceSourceVariant = (source?: Invoice['source']) => (source === 'BLANK' ? 'secondary' : 'default')

const formatBankAccountLine = (account: { account_label: string; bank: string; account_number: string; account_name: string }) => {
  return `${account.account_label} — ${account.bank} / ${account.account_number} / a/n ${account.account_name}`
}

export default function InvoiceDetailPage() {
  const router = useRouter()
  const params = useParams()
  const invoiceId = params?.id as string
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

  // Payment form state
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0])
  const [paymentMethod, setPaymentMethod] = useState('TRANSFER')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentReference, setPaymentReference] = useState('')
  const [paymentNotes, setPaymentNotes] = useState('')

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
    } catch (error: unknown) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Gagal mencatat pembayaran',
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

  const resetPaymentForm = () => {
    setPaymentDate(new Date().toISOString().split('T')[0])
    setPaymentMethod('TRANSFER')
    setPaymentAmount('')
    setPaymentReference('')
    setPaymentNotes('')
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
        title: 'WhatsApp Dibuka ✅',
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

  const _generateEmailContent = () => {
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
    const bankAccounts = parseBankAccounts(invoiceConfig.bank_accounts)
    if (bankAccounts.length > 0) {
          body += `\n\nINFORMASI PEMBAYARAN\n`
          body += `═══════════════════════════════\n`
          body += `Silakan transfer ke salah satu rekening berikut:\n\n`
          bankAccounts.forEach((account, index: number) => {
            body += `${index + 1}. ${formatBankAccountLine(account)}\n\n`
          })
          body += `Mohon cantumkan No. Invoice (${invoiceNumber}) dalam keterangan transfer.\n`
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">{invoice.invoice_number}</h1>
              <Badge variant={getInvoiceSourceVariant(invoice.source)}>
                {getInvoiceSourceLabel(invoice.source)}
              </Badge>
              <Badge variant={invoice.invoice_type === 'FINAL' ? 'default' : 'secondary'}>
                {invoice.invoice_type}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              {invoice.invoice_type === 'PROFORMA' ? 'Invoice Proforma' : 'Invoice Final'}
            </p>
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
          {/* Edit / Revisi — only for DRAFT/SENT */}
          {!isRevisionMode && canReviseInvoice(invoice.status) && (
            <Button
              variant="outline"
              onClick={handleEnterRevisionMode}
              disabled={isProcessing}
              className="border-amber-200 text-amber-700 hover:bg-amber-50"
              data-testid="invoice-edit-revisi-button"
            >
              <Pencil className="mr-2 h-4 w-4" />
              Edit / Revisi
            </Button>
          )}
          {!isRevisionMode && revisionHelpMessage && (
            <p className="max-w-[18rem] text-xs leading-relaxed text-muted-foreground">
              {revisionHelpMessage}
            </p>
          )}
          {isRevisionMode && (
            <>
              <Button
                onClick={handleSaveRevision}
                disabled={isSavingRevision}
                data-testid="invoice-save-revision"
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
              className="border-orange-200 text-orange-700 hover:bg-orange-50"
            >
              <XCircle className="mr-2 h-4 w-4" />
              Cancel Invoice
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
                  <Badge className={STATUS_COLORS[displayStatus]} data-testid="invoice-status-badge">
                    {getInvoiceStatusLabel(displayStatus)}
                  </Badge>
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

                  <div className="grid grid-cols-2 gap-4">
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
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Customer</Label>
                      <p className="font-semibold">{customerDisplayName}</p>
                      <p className="text-sm text-muted-foreground">
                        {customerDisplayPhone ? formatPhone(customerDisplayPhone) : '—'}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {customerDisplayEmail || '—'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {customerDisplayAddress || '—'}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Order ID</Label>
                      <p className="font-mono font-semibold">{displayOrderId}</p>
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
                      <div className="grid gap-3 md:grid-cols-12">
                        <div className="space-y-1 md:col-span-6">
                          <Label htmlFor={`rev-item-desc-${idx}`}>Deskripsi</Label>
                          <Input
                            id={`rev-item-desc-${idx}`}
                            value={item.description}
                            onChange={(e) => updateRevisionItem(idx, { description: e.target.value })}
                            placeholder="Deskripsi item"
                          />
                        </div>
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
                        <div className="space-y-1 md:col-span-3">
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
                        <div className="md:col-span-1 flex items-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeRevisionItem(idx)}
                            disabled={revisionDraft.items.length <= 1}
                            aria-label="Hapus item"
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
                  <Button type="button" variant="outline" onClick={addRevisionItem} className="w-full">
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
                    <SelectItem value="PARTIAL_PAID">Partial Paid</SelectItem>
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
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
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDelete} 
              disabled={isProcessing}
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
