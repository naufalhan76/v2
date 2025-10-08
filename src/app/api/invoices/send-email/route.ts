import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase-server'
import { logInvoiceCommunication } from '@/lib/actions/invoice-communications'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { invoiceId } = body

    if (!invoiceId) {
      return NextResponse.json({ error: 'Invoice ID required' }, { status: 400 })
    }

    // Get invoice data
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select(`
        *,
        customers (
          customer_id,
          customer_name,
          email,
          phone_number
        )
      `)
      .eq('invoice_id', invoiceId)
      .single()

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Get invoice items
    const { data: items } = await supabase
      .from('invoice_items')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('item_id')

    // Get payments
    const { data: payments } = await supabase
      .from('payment_records')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('payment_date', { ascending: false })

    // Get invoice config
    const { data: config } = await supabase
      .from('invoice_configuration')
      .select('*')
      .eq('is_active', true)
      .single()

    if (!invoice.customers?.email) {
      return NextResponse.json(
        { error: 'Customer email not found' },
        { status: 400 }
      )
    }

    // Calculate totals
    const amountPaid = payments?.reduce((sum, p) => sum + p.amount, 0) || 0
    const balanceDue = invoice.total_amount - amountPaid

    // Get company info
    const companyName = config?.company_name || 'AC Service Dashboard'
    const companyPhone = config?.company_phone || ''
    const companyWebsite = config?.company_website || ''
    
    // Validated sender email - MUST use verified domain
    // If company_email uses unverified domain (gmail.com, yahoo.com, etc), fallback to verified domain
    let companyEmail = config?.company_email || 'noreply@yaleya.biz.id'
    
    // Check if email uses common email providers (not allowed by Resend)
    const invalidDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'live.com', 'aol.com']
    const emailDomain = companyEmail.split('@')[1]?.toLowerCase()
    
    if (invalidDomains.includes(emailDomain)) {
      console.warn(`Company email uses invalid domain (${emailDomain}), using fallback: noreply@yaleya.biz.id`)
      companyEmail = 'noreply@yaleya.biz.id'
    }

    // Parse bank accounts
    let bankAccounts: any[] = []
    if (config?.bank_accounts) {
      try {
        bankAccounts = JSON.parse(config.bank_accounts)
      } catch (e) {
        console.error('Failed to parse bank accounts:', e)
      }
    }

    // Format currency
    const formatCurrency = (amount: number) => {
      return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
      }).format(amount)
    }

    // Format date
    const formatDate = (date: string) => {
      return new Date(date).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    }

    // Generate HTML email
    const htmlEmail = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice ${invoice.invoice_number}</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: bold;">INVOICE</h1>
              <p style="margin: 10px 0 0 0; color: #e0e7ff; font-size: 18px;">${companyName}</p>
            </td>
          </tr>

          <!-- Invoice Details -->
          <tr>
            <td style="padding: 30px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="width: 50%; vertical-align: top;">
                    <p style="margin: 0 0 5px 0; color: #6b7280; font-size: 12px; text-transform: uppercase; font-weight: bold;">Tagihan Kepada</p>
                    <p style="margin: 0 0 5px 0; color: #111827; font-size: 18px; font-weight: bold;">${invoice.customers.customer_name}</p>
                    ${invoice.customers.phone_number ? `<p style="margin: 0 0 5px 0; color: #6b7280; font-size: 14px;">${invoice.customers.phone_number}</p>` : ''}
                    <p style="margin: 0; color: #6b7280; font-size: 14px;">${invoice.customers.email}</p>
                  </td>
                  <td style="width: 50%; vertical-align: top; text-align: right;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 6px; padding: 15px;">
                      <tr>
                        <td style="padding: 3px 0; color: #6b7280; font-size: 12px;">No. Invoice:</td>
                        <td style="padding: 3px 0; color: #111827; font-size: 14px; font-weight: bold; text-align: right;">${invoice.invoice_number}</td>
                      </tr>
                      <tr>
                        <td style="padding: 3px 0; color: #6b7280; font-size: 12px;">Tanggal:</td>
                        <td style="padding: 3px 0; color: #111827; font-size: 14px; text-align: right;">${formatDate(invoice.invoice_date)}</td>
                      </tr>
                      <tr>
                        <td style="padding: 3px 0; color: #6b7280; font-size: 12px;">Jatuh Tempo:</td>
                        <td style="padding: 3px 0; color: #dc2626; font-size: 14px; font-weight: bold; text-align: right;">${formatDate(invoice.due_date)}</td>
                      </tr>
                      <tr>
                        <td style="padding: 3px 0; color: #6b7280; font-size: 12px;">Status:</td>
                        <td style="padding: 3px 0; text-align: right;">
                          <span style="display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: bold; 
                            ${invoice.status === 'PAID' ? 'background-color: #dcfce7; color: #16a34a;' : 
                              invoice.status === 'SENT' ? 'background-color: #dbeafe; color: #2563eb;' : 
                              invoice.status === 'OVERDUE' ? 'background-color: #fee2e2; color: #dc2626;' : 
                              'background-color: #f3f4f6; color: #6b7280;'}">${invoice.status}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Items Table -->
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              <h2 style="margin: 0 0 15px 0; color: #111827; font-size: 18px; font-weight: bold;">Rincian Layanan</h2>
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
                <thead>
                  <tr style="background-color: #1e3a8a;">
                    <th style="padding: 12px; text-align: left; color: #ffffff; font-size: 13px; font-weight: bold;">Deskripsi</th>
                    <th style="padding: 12px; text-align: center; color: #ffffff; font-size: 13px; font-weight: bold; width: 60px;">Qty</th>
                    <th style="padding: 12px; text-align: right; color: #ffffff; font-size: 13px; font-weight: bold; width: 120px;">Harga Satuan</th>
                    <th style="padding: 12px; text-align: right; color: #ffffff; font-size: 13px; font-weight: bold; width: 120px;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${items?.map((item, index) => `
                    <tr style="background-color: ${index % 2 === 0 ? '#f9fafb' : '#ffffff'}; border-bottom: 1px solid #e5e7eb;">
                      <td style="padding: 12px; color: #374151; font-size: 14px;">${item.description}</td>
                      <td style="padding: 12px; text-align: center; color: #374151; font-size: 14px;">${item.quantity}</td>
                      <td style="padding: 12px; text-align: right; color: #374151; font-size: 14px;">${formatCurrency(item.unit_price)}</td>
                      <td style="padding: 12px; text-align: right; color: #111827; font-size: 14px; font-weight: bold;">${formatCurrency(item.total_price)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </td>
          </tr>

          <!-- Summary -->
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 8px; padding: 20px;">
                <tr>
                  <td style="padding: 5px 0; color: #6b7280; font-size: 14px;">Subtotal:</td>
                  <td style="padding: 5px 0; text-align: right; color: #111827; font-size: 14px;">${formatCurrency(invoice.subtotal)}</td>
                </tr>
                ${invoice.discount_amount > 0 ? `
                <tr>
                  <td style="padding: 5px 0; color: #6b7280; font-size: 14px;">Diskon:</td>
                  <td style="padding: 5px 0; text-align: right; color: #dc2626; font-size: 14px;">-${formatCurrency(invoice.discount_amount)}</td>
                </tr>
                ` : ''}
                <tr>
                  <td style="padding: 5px 0; color: #6b7280; font-size: 14px;">Pajak (${invoice.tax_percentage}%):</td>
                  <td style="padding: 5px 0; text-align: right; color: #111827; font-size: 14px;">${formatCurrency(invoice.tax_amount)}</td>
                </tr>
                ${amountPaid > 0 ? `
                <tr>
                  <td style="padding: 5px 0; color: #6b7280; font-size: 14px;">Jumlah Dibayar:</td>
                  <td style="padding: 5px 0; text-align: right; color: #16a34a; font-size: 14px;">-${formatCurrency(amountPaid)}</td>
                </tr>
                ` : ''}
                <tr>
                  <td colspan="2" style="padding: 10px 0 5px 0;"><hr style="border: none; border-top: 2px solid #1e3a8a; margin: 0;"></td>
                </tr>
                <tr>
                  <td style="padding: 5px 0; color: #111827; font-size: 18px; font-weight: bold;">${balanceDue > 0 ? 'Sisa Tagihan:' : 'LUNAS'}</td>
                  <td style="padding: 5px 0; text-align: right; color: ${balanceDue > 0 ? '#dc2626' : '#16a34a'}; font-size: 20px; font-weight: bold;">${formatCurrency(balanceDue)}</td>
                </tr>
              </table>
            </td>
          </tr>

          ${balanceDue > 0 && bankAccounts.length > 0 ? `
          <!-- Payment Info -->
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 20px; border-radius: 6px;">
                <h3 style="margin: 0 0 15px 0; color: #1e3a8a; font-size: 16px; font-weight: bold;">💳 Informasi Pembayaran</h3>
                <p style="margin: 0 0 15px 0; color: #475569; font-size: 13px; font-style: italic;">Silakan transfer ke salah satu rekening berikut dan cantumkan No. Invoice (${invoice.invoice_number}) dalam keterangan transfer.</p>
                ${bankAccounts.map((account, index) => `
                  <div style="margin-bottom: 15px; padding: 12px; background-color: #ffffff; border-radius: 6px;">
                    <p style="margin: 0 0 5px 0; color: #1e3a8a; font-size: 15px; font-weight: bold;">${index + 1}. ${account.bank}</p>
                    <p style="margin: 0 0 3px 0; color: #475569; font-size: 14px;">No. Rekening: <strong>${account.account_number}</strong></p>
                    <p style="margin: 0; color: #475569; font-size: 14px;">Atas Nama: <strong>${account.account_name}</strong></p>
                  </div>
                `).join('')}
              </div>
            </td>
          </tr>
          ` : ''}

          ${config?.terms_conditions_template ? `
          <!-- Terms & Conditions -->
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              <h3 style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px; font-weight: bold; text-transform: uppercase;">Syarat dan Ketentuan</h3>
              <p style="margin: 0; color: #6b7280; font-size: 13px; line-height: 1.6;">${config.terms_conditions_template.replace(/\n/g, '<br>')}</p>
            </td>
          </tr>
          ` : ''}

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 20px 30px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 10px 0; color: #374151; font-size: 13px;">Jika ada pertanyaan, silakan hubungi kami:</p>
              ${companyPhone ? `<p style="margin: 0 0 5px 0; color: #6b7280; font-size: 13px;">📞 ${companyPhone}</p>` : ''}
              ${companyEmail ? `<p style="margin: 0 0 5px 0; color: #6b7280; font-size: 13px;">📧 ${companyEmail}</p>` : ''}
              ${companyWebsite ? `<p style="margin: 0 0 15px 0; color: #3b82f6; font-size: 13px;">🌐 ${companyWebsite}</p>` : ''}
              <p style="margin: 0; color: #9ca3af; font-size: 12px; font-style: italic;">Terima kasih atas kepercayaan Anda! 🙏</p>
            </td>
          </tr>

        </table>

        <!-- Footer Note -->
        <table width="600" cellpadding="0" cellspacing="0" style="margin-top: 20px;">
          <tr>
            <td style="text-align: center; color: #9ca3af; font-size: 12px;">
              <p style="margin: 0;">Invoice ini digenerate otomatis oleh sistem ${companyName}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `

    // Send email
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: `${companyName} <${companyEmail}>`,
      to: invoice.customers.email,
      subject: `Invoice ${invoice.invoice_number} - ${companyName}`,
      html: htmlEmail,
    })

    if (emailError) {
      console.error('Resend error:', emailError)
      return NextResponse.json(
        { error: 'Failed to send email', details: emailError },
        { status: 500 }
      )
    }

    // Log communication to database
    try {
      await logInvoiceCommunication({
        invoiceId,
        type: 'EMAIL',
        recipient: invoice.customers.email,
        externalId: emailData?.id,
        status: 'sent',
      })
    } catch (logError) {
      console.error('Failed to log communication:', logError)
      // Don't fail the request if logging fails
    }

    return NextResponse.json({
      success: true,
      message: 'Email sent successfully',
      emailId: emailData?.id,
    })
  } catch (error: any) {
    console.error('Send email error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
