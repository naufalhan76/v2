'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Save, Building2, Banknote, FileText } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getInvoiceConfig, updateInvoiceConfig } from '@/lib/actions/invoice-config'
import { parseBankAccounts } from '@/lib/bank-accounts'
import { BankAccountsSection, type BankAccount } from './bank-accounts-section'
import { CompanyTab } from './_components/company-tab'
import { InvoiceSettingsTab } from './_components/invoice-settings-tab'

const invoiceConfigSchema = z.object({
  companyName: z.string().min(1, 'Nama perusahaan wajib diisi'),
  companyAddress: z.string().optional(),
  companyPhone: z.string().optional(),
  companyEmail: z.string().email('Email tidak valid').optional().or(z.literal('')),
  companyWebsite: z.string().optional(),
  companyLat: z.number().min(-90).max(90).nullable().optional(),
  companyLng: z.number().min(-180).max(180).nullable().optional(),
  npwp: z.string().optional(),
  taxPercentage: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Format tidak valid').default('11.00'),
  defaultDueDays: z.string().regex(/^\d+$/, 'Harus berupa angka').default('30'),
  invoicePrefix: z.string().min(1, 'Prefix invoice wajib diisi').default('INV'),
  logoUrl: z.string().optional(),
  termsConditions: z.string().optional(),
})

type InvoiceConfigFormData = z.infer<typeof invoiceConfigSchema>

export default function InvoiceConfigPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(true)
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const { toast } = useToast()

  const form = useForm<InvoiceConfigFormData>({
    resolver: zodResolver(invoiceConfigSchema),
    defaultValues: {
      companyName: '', companyAddress: '', companyPhone: '', companyEmail: '',
      companyWebsite: '', npwp: '', taxPercentage: '11.00', defaultDueDays: '30',
      invoicePrefix: 'INV', logoUrl: '', termsConditions: '', companyLat: null, companyLng: null,
    },
  })

  useEffect(() => { loadConfig() }, [])

  const loadConfig = async () => {
    try {
      setIsFetching(true)
      const config = await getInvoiceConfig()
      if (config) {
        setBankAccounts(parseBankAccounts(config.bank_accounts))
        form.reset({
          companyName: config.company_name,
          companyAddress: config.company_address || '',
          companyPhone: config.company_phone || '',
          companyEmail: config.company_email || '',
          companyWebsite: config.company_website || '',
          companyLat: config.company_lat ?? null,
          companyLng: config.company_lng ?? null,
          npwp: config.npwp || '',
          taxPercentage: config.default_tax_percentage?.toString() || '11.00',
          defaultDueDays: config.default_due_days?.toString() || '30',
          invoicePrefix: config.invoice_prefix || 'INV',
          logoUrl: config.logo_url || '',
          termsConditions: config.terms_conditions_template || '',
        })
      }
    } catch (_error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Gagal memuat konfigurasi invoice' })
    } finally { setIsFetching(false) }
  }

  const onSubmit = async (data: InvoiceConfigFormData) => {
    try {
      setIsLoading(true)
      const bankAccountsData = bankAccounts.map(acc => ({
        bank: acc.bank, account_number: acc.account_number, account_name: acc.account_name,
      }))
      await updateInvoiceConfig({
        company_name: data.companyName, company_address: data.companyAddress,
        company_phone: data.companyPhone, company_email: data.companyEmail,
        company_website: data.companyWebsite, companyLat: data.companyLat ?? null,
        companyLng: data.companyLng ?? null,
        bank_accounts: bankAccountsData.length > 0 ? bankAccountsData : undefined,
        npwp: data.npwp, default_tax_percentage: parseFloat(data.taxPercentage),
        default_due_days: parseInt(data.defaultDueDays), invoice_prefix: data.invoicePrefix,
        logo_url: data.logoUrl, terms_conditions_template: data.termsConditions,
      })
      toast({ title: 'Berhasil', description: 'Konfigurasi invoice berhasil disimpan' })
    } catch (_error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Gagal menyimpan konfigurasi invoice' })
    } finally { setIsLoading(false) }
  }

  if (isFetching) {
    return (
      <div className="space-y-6">
        <div className="space-y-2"><div className="h-8 w-64 rounded bg-muted animate-pulse" /><div className="h-4 w-80 rounded bg-muted animate-pulse" /></div>
        <div className="h-10 w-full rounded bg-muted animate-pulse" />
        <div className="rounded-xl border border-border/50 bg-card p-6 space-y-6">
          {Array.from({ length: 6 }).map((_, i) => (<div key={i} className="space-y-2"><div className="h-4 w-32 rounded bg-muted animate-pulse" /><div className="h-10 w-full rounded bg-muted animate-pulse" /></div>))}
          <div className="h-10 w-32 rounded bg-muted animate-pulse" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">Konfigurasi Invoice</h1>
        <p className="text-muted-foreground text-sm sm:text-base">Kelola informasi perusahaan, bank, dan pengaturan invoice</p>
      </div>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <Tabs defaultValue="company" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 rounded-xl border border-border/50 bg-muted/50 p-1 h-auto">
            <TabsTrigger value="company" className="flex items-center justify-center gap-1 sm:gap-2 rounded-lg py-2 text-xs sm:text-sm">
              <Building2 className="h-4 w-4 shrink-0" /><span className="hidden sm:inline">Data Perusahaan</span><span className="sm:hidden">Perusahaan</span>
            </TabsTrigger>
            <TabsTrigger value="bank" className="flex items-center justify-center gap-1 sm:gap-2 rounded-lg py-2 text-xs sm:text-sm">
              <Banknote className="h-4 w-4 shrink-0" /><span className="hidden sm:inline">Informasi Bank</span><span className="sm:hidden">Bank</span>
            </TabsTrigger>
            <TabsTrigger value="invoice" className="flex items-center justify-center gap-1 sm:gap-2 rounded-lg py-2 text-xs sm:text-sm">
              <FileText className="h-4 w-4 shrink-0" /><span className="hidden sm:inline">Pengaturan Invoice</span><span className="sm:hidden">Invoice</span>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="company"><CompanyTab form={form as any} /></TabsContent>
          <TabsContent value="bank"><BankAccountsSection accounts={bankAccounts} onChange={setBankAccounts} /></TabsContent>
          <TabsContent value="invoice"><InvoiceSettingsTab form={form as any} /></TabsContent>
        </Tabs>
        <div className="flex justify-end mt-6">
          <Button type="submit" disabled={isLoading} className="w-full sm:w-auto sm:min-w-[150px]">
            {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Menyimpan...</> : <><Save className="mr-2 h-4 w-4" />Simpan Konfigurasi</>}
          </Button>
        </div>
      </form>
    </div>
  )
}
