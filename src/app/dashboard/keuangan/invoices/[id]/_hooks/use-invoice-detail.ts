'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { useToast } from '@/hooks/use-toast'
import { getInvoiceById, updateInvoiceStatus, deleteInvoice, reviseInvoice } from '@/lib/actions/invoices'
import type { Invoice, InvoiceItem, PaymentRecord } from '@/types/invoices'
import { getInvoiceConfig, type InvoiceConfig } from '@/lib/actions/invoice-config'
import { parseBankAccounts, type BankAccount } from '@/lib/bank-accounts'
import { logInvoiceCommunication, getInvoiceCommunicationStats } from '@/lib/actions/invoice-communications'
import { logger } from '@/lib/logger'
import { canReviseInvoice } from '@/lib/invoice-utils'
import { generateWhatsAppMessage } from '../_components/whatsapp-utils'
import type { RevisionDraft, RevisionItemDraft } from '../_components/revision-utils'
import { buildRevisionDraft, validateRevisionDraft, buildRevisionPayload } from '../_components/revision-utils'

export type { RevisionDraft, RevisionItemDraft }

export function useInvoiceDetail() {
  const router = useRouter()
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
    totalSent: 0, emailSent: 0, whatsappSent: 0,
    lastSentAt: null as string | null, lastSentType: null as string | null,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isRevisionMode, setIsRevisionMode] = useState(false)
  const [isSavingRevision, setIsSavingRevision] = useState(false)
  const [revisionDraft, setRevisionDraft] = useState<RevisionDraft | null>(null)

  useEffect(() => { if (invoiceId) loadInvoice() }, [invoiceId]) // eslint-disable-line

  const loadInvoice = async () => {
    if (!invoiceId) return
    try {
      setIsLoading(true)
      const [data, config, stats] = await Promise.all([
        getInvoiceById(invoiceId), getInvoiceConfig(), getInvoiceCommunicationStats(invoiceId),
      ])
      if (data) {
        setInvoice(data.invoice); setItems(data.items); setPayments(data.payments)
        setOrderItemsDetailed(data.orderItemsDetailed || [])
      }
      setInvoiceConfig(config); setBankAccounts(parseBankAccounts(config?.bank_accounts))
      setCommunicationStats(stats)
    } catch { toast({ variant: 'destructive', title: 'Error', description: 'Gagal memuat data invoice' }) }
    finally { setIsLoading(false) }
  }

  const handleStatusChange = async (newStatus: string) => {
    if (!invoice) return
    try {
      setIsProcessing(true)
      await updateInvoiceStatus(invoice.invoice_id, newStatus as Invoice['status'])
      toast({ title: 'Berhasil', description: 'Status invoice berhasil diupdate' }); loadInvoice()
    } catch { toast({ variant: 'destructive', title: 'Error', description: 'Gagal mengupdate status invoice' }) }
    finally { setIsProcessing(false) }
  }

  const handleDelete = async () => {
    if (!invoice) return
    try {
      setIsProcessing(true)
      await deleteInvoice(invoice.invoice_id)
      toast({ title: 'Berhasil', description: 'Invoice berhasil dihapus' })
      router.push('/dashboard/keuangan/invoices')
    } catch (error: unknown) {
      toast({ variant: 'destructive', title: 'Tidak Dapat Menghapus', description: error instanceof Error ? error.message : 'Gagal menghapus invoice' })
    } finally { setIsProcessing(false); setIsDeleteDialogOpen(false) }
  }

  const handleEnterRevisionMode = () => {
    if (!invoice) return
    if (!canReviseInvoice(invoice.status)) {
      toast({ variant: 'destructive', title: 'Tidak dapat direvisi', description: 'Invoice hanya dapat direvisi saat berstatus DRAFT atau SENT' }); return
    }
    setRevisionDraft(buildRevisionDraft(invoice, items)); setIsRevisionMode(true)
  }

  const handleCancelRevision = () => { setIsRevisionMode(false); setRevisionDraft(null) }

  const updateRevisionField = <K extends keyof RevisionDraft>(field: K, value: RevisionDraft[K]) =>
    setRevisionDraft((prev) => (prev ? { ...prev, [field]: value } : prev))

  const updateRevisionItem = (index: number, patch: Partial<RevisionItemDraft>) =>
    setRevisionDraft((prev) => {
      if (!prev) return prev; const next = [...prev.items]; next[index] = { ...next[index], ...patch }; return { ...prev, items: next }
    })

  const addRevisionItem = () =>
    setRevisionDraft((prev) => prev ? { ...prev, items: [...prev.items, { item_type: 'BASE_SERVICE', description: '', quantity: 1, unit_price: 0, line_order: prev.items.length }] } : prev)

  const removeRevisionItem = (index: number) =>
    setRevisionDraft((prev) => prev ? { ...prev, items: prev.items.filter((_, i) => i !== index).map((it, i) => ({ ...it, line_order: i })) } : prev)

  const handleSaveRevision = async () => {
    if (!invoice || !revisionDraft) return
    const validationError = validateRevisionDraft(revisionDraft)
    if (validationError) { toast({ variant: 'destructive', title: 'Validasi gagal', description: validationError }); return }
    const [headerUpdates, itemsPayload] = buildRevisionPayload(revisionDraft, bankAccounts, Boolean(invoice.customer_id))
    try {
      setIsSavingRevision(true)
      await reviseInvoice(invoice.invoice_id, headerUpdates, itemsPayload)
      toast({ title: 'Revisi tersimpan', description: 'Invoice berhasil diperbarui' })
      setIsRevisionMode(false); setRevisionDraft(null); await loadInvoice()
    } catch (error: unknown) {
      logger.error('Save revision error:', error)
      toast({ variant: 'destructive', title: 'Gagal menyimpan revisi', description: error instanceof Error ? error.message : 'Terjadi kesalahan' })
    } finally { setIsSavingRevision(false) }
  }

  const handleSendWhatsApp = async () => {
    if (!invoice?.customers?.phone_number || !invoiceConfig) {
      toast({ variant: 'destructive', title: 'Error', description: 'Nomor WhatsApp customer tidak ditemukan' }); return
    }
    try {
      const message = generateWhatsAppMessage({ invoice, items, invoiceConfig })
      const phoneNumber = invoice.customers.phone_number.replace(/^0/, '62').replace(/\D/g, '')
      await logInvoiceCommunication({ invoiceId: invoice.invoice_id, type: 'WHATSAPP', recipient: invoice.customers.phone_number })
      window.open(`https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`, '_blank')
      await loadInvoice()
      toast({ title: 'WhatsApp Dibuka', description: 'Pesan invoice siap dikirim ke customer' })
    } catch (error: unknown) {
      logger.error('WhatsApp error:', error)
      toast({ variant: 'destructive', title: 'Error', description: error instanceof Error ? error.message : 'Gagal membuka WhatsApp' })
    }
  }

  const handleSendEmail = async () => {
    if (!invoice?.customers?.email) { toast({ variant: 'destructive', title: 'Error', description: 'Email customer tidak ditemukan' }); return }
    try {
      setIsProcessing(true)
      const response = await fetch('/api/invoices/send-email', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ invoiceId: invoice.invoice_id }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to send email')
      toast({ title: 'Email Terkirim', description: `Invoice berhasil dikirim ke ${invoice.customers.email}` })
      if (invoice.status === 'DRAFT') { await updateInvoiceStatus(invoice.invoice_id, 'SENT'); await loadInvoice() }
    } catch (error: unknown) {
      logger.error('Send email error:', error)
      toast({ variant: 'destructive', title: 'Gagal Kirim Email', description: error instanceof Error ? error.message : 'Terjadi kesalahan' })
    } finally { setIsProcessing(false) }
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount)

  return {
    invoiceId, isPrefilledFromReport, invoice, items, payments, orderItemsDetailed,
    invoiceConfig, bankAccounts, communicationStats, isLoading,
    isPaymentDialogOpen, isDeleteDialogOpen, isProcessing,
    isRevisionMode, isSavingRevision, revisionDraft,
    setIsPaymentDialogOpen, setIsDeleteDialogOpen, setIsRevisionMode,
    loadInvoice, handleStatusChange, handleDelete,
    handleEnterRevisionMode, handleCancelRevision,
    updateRevisionField, updateRevisionItem, addRevisionItem, removeRevisionItem,
    handleSaveRevision, handleSendWhatsApp, handleSendEmail, formatCurrency,
  }
}
