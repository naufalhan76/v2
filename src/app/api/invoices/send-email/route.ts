import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from '@clerk/nextjs/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase-server'
import { logInvoiceCommunication } from '@/lib/actions/invoice-communications'
import { parseBankAccounts } from '@/lib/bank-accounts'
import { logger } from '@/lib/logger'
import { getInvoiceStatusLabel, isOverdue } from '@/lib/invoice-status'
import { requireFinanceRoleAPI } from '@/app/api/middleware/auth'
import { buildInvoiceEmailHtml, sendInvoiceEmail, validateSenderEmail } from './email-template'

export async function POST(request: NextRequest) {
  try {
    const financeGuard = await requireFinanceRoleAPI(request)
    if (financeGuard) return financeGuard

    if (!process.env.RESEND_API_KEY) {
      logger.error('RESEND_API_KEY is not configured')
      return NextResponse.json(
        { error: 'Email service is not configured' },
        { status: 500 }
      )
    }

    const resend = new Resend(process.env.RESEND_API_KEY)
    const supabase = await createClient()

    const { userId } = getAuth(request)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { invoiceId } = body
    if (!invoiceId) {
      return NextResponse.json({ error: 'Invoice ID required' }, { status: 400 })
    }

    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select(`*, customers (customer_id, customer_name, email, phone_number)`)
      .eq('invoice_id', invoiceId)
      .single()

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    const { data: items } = await supabase.from('invoice_items').select('*').eq('invoice_id', invoiceId).order('item_id')
    const { data: payments } = await supabase.from('payment_records').select('*').eq('invoice_id', invoiceId).order('payment_date', { ascending: false })
    const { data: config } = await supabase.from('invoice_configuration').select('*').eq('is_active', true).single()

    const customerName = invoice.customers?.customer_name || invoice.customer_name_override || 'Customer'
    const customerAddress = invoice.customer_address_override || ''
    const customerPhone = invoice.customers?.phone_number || invoice.customer_phone_override || ''
    const customerEmail = invoice.customers?.email || invoice.customer_email_override || ''

    if (!customerEmail) {
      return NextResponse.json({ error: 'Customer email not found' }, { status: 400 })
    }

    const amountPaid = payments?.reduce((sum, p) => sum + p.amount, 0) || 0
    const balanceDue = invoice.total_amount - amountPaid
    const companyName = config?.company_name || 'AC Service Dashboard'
    const companyAddress = config?.company_address || ''
    const companyPhone = config?.company_phone || ''
    const companyWebsite = config?.company_website || ''
    const companyEmail = validateSenderEmail(config?.company_email || 'noreply@yaleya.biz.id')

    const bankAccounts = parseBankAccounts(config?.bank_accounts)
    const displayStatus = isOverdue(invoice) ? 'OVERDUE' : invoice.status
    const displayStatusLabel = getInvoiceStatusLabel(displayStatus)
    const termsConditions = config?.terms_conditions_template || null

    const htmlEmail = buildInvoiceEmailHtml({
      invoiceNumber: invoice.invoice_number,
      customerName, customerAddress, customerPhone, customerEmail,
      invoiceDate: invoice.invoice_date,
      dueDate: invoice.due_date,
      displayStatusLabel, displayStatus,
      companyName, companyAddress, companyPhone, companyEmail, companyWebsite,
      bankAccounts, termsConditions,
      items: items || [],
      subtotal: invoice.subtotal,
      discountAmount: invoice.discount_amount,
      taxPercentage: invoice.tax_percentage,
      taxAmount: invoice.tax_amount,
      amountPaid, balanceDue,
    })

    const { data: emailData, error: emailError } = await sendInvoiceEmail(
      resend,
      `${companyName} <${companyEmail}>`,
      customerEmail,
      `Invoice ${invoice.invoice_number} - ${companyName}`,
      htmlEmail
    )

    if (emailError) {
      logger.error('Resend error:', emailError)
      return NextResponse.json(
        { error: 'Failed to send email', details: emailError },
        { status: 500 }
      )
    }

    try {
      await logInvoiceCommunication({
        invoiceId,
        type: 'EMAIL',
        recipient: customerEmail,
        externalId: emailData?.id,
        status: 'sent',
      })
    } catch (logError) {
      logger.error('Failed to log communication:', logError)
    }

    return NextResponse.json({
      success: true,
      message: 'Email sent successfully',
      emailId: emailData?.id,
    })
  } catch (error: unknown) {
    logger.error('Send email error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
