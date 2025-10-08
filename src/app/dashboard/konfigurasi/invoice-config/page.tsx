'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Save, Building2, Banknote, FileText } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getInvoiceConfig, updateInvoiceConfig } from '@/lib/actions/invoice-config'

const invoiceConfigSchema = z.object({
  companyName: z.string().min(1, 'Nama perusahaan wajib diisi'),
  companyAddress: z.string().optional(),
  companyPhone: z.string().optional(),
  companyEmail: z.string().email('Email tidak valid').optional().or(z.literal('')),
  companyWebsite: z.string().optional(),
  bankName: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  bankAccountHolder: z.string().optional(),
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
  const { toast } = useToast()

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<InvoiceConfigFormData>({
    resolver: zodResolver(invoiceConfigSchema),
    defaultValues: {
      companyName: '',
      companyAddress: '',
      companyPhone: '',
      companyEmail: '',
      companyWebsite: '',
      bankName: '',
      bankAccountNumber: '',
      bankAccountHolder: '',
      npwp: '',
      taxPercentage: '11.00',
      defaultDueDays: '30',
      invoicePrefix: 'INV',
      logoUrl: '',
      termsConditions: '',
    },
  })

  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async () => {
    try {
      setIsFetching(true)
      const config = await getInvoiceConfig()
      if (config) {
        // Parse bank_accounts JSON to get first bank account
        let bankData = { bankName: '', bankAccountNumber: '', bankAccountHolder: '' }
        if (config.bank_accounts) {
          try {
            const banks = JSON.parse(config.bank_accounts)
            if (banks && banks.length > 0) {
              bankData = {
                bankName: banks[0].bank || '',
                bankAccountNumber: banks[0].account_number || '',
                bankAccountHolder: banks[0].account_name || '',
              }
            }
          } catch (e) {
            console.error('Error parsing bank_accounts:', e)
          }
        }

        reset({
          companyName: config.company_name,
          companyAddress: config.company_address || '',
          companyPhone: config.company_phone || '',
          companyEmail: config.company_email || '',
          companyWebsite: config.company_website || '',
          ...bankData,
          npwp: config.npwp || '',
          taxPercentage: config.default_tax_percentage?.toString() || '11.00',
          defaultDueDays: config.default_due_days?.toString() || '30',
          invoicePrefix: config.invoice_prefix || 'INV',
          logoUrl: config.logo_url || '',
          termsConditions: config.terms_conditions_template || '',
        })
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Gagal memuat konfigurasi invoice',
      })
    } finally {
      setIsFetching(false)
    }
  }

  const onSubmit = async (data: InvoiceConfigFormData) => {
    try {
      setIsLoading(true)

      // Create bank_accounts array
      const bankAccounts = []
      if (data.bankName && data.bankAccountNumber && data.bankAccountHolder) {
        bankAccounts.push({
          bank: data.bankName,
          account_number: data.bankAccountNumber,
          account_name: data.bankAccountHolder,
        })
      }

      await updateInvoiceConfig({
        company_name: data.companyName,
        company_address: data.companyAddress,
        company_phone: data.companyPhone,
        company_email: data.companyEmail,
        company_website: data.companyWebsite,
        bank_accounts: bankAccounts.length > 0 ? bankAccounts : undefined,
        npwp: data.npwp,
        default_tax_percentage: parseFloat(data.taxPercentage),
        default_due_days: parseInt(data.defaultDueDays),
        invoice_prefix: data.invoicePrefix,
        logo_url: data.logoUrl,
        terms_conditions_template: data.termsConditions,
      })

      toast({
        title: 'Berhasil',
        description: 'Konfigurasi invoice berhasil disimpan',
      })
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Gagal menyimpan konfigurasi invoice',
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (isFetching) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Konfigurasi Invoice</h1>
        <p className="text-muted-foreground">
          Kelola informasi perusahaan, bank, dan pengaturan invoice
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <Tabs defaultValue="company" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="company" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Data Perusahaan
            </TabsTrigger>
            <TabsTrigger value="bank" className="flex items-center gap-2">
              <Banknote className="h-4 w-4" />
              Informasi Bank
            </TabsTrigger>
            <TabsTrigger value="invoice" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Pengaturan Invoice
            </TabsTrigger>
          </TabsList>

          {/* Company Information Tab */}
          <TabsContent value="company">
            <Card>
              <CardHeader>
                <CardTitle>Informasi Perusahaan</CardTitle>
                <CardDescription>
                  Informasi ini akan ditampilkan di header invoice
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="companyName">
                    Nama Perusahaan <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="companyName"
                    placeholder="PT. AC Service Indonesia"
                    {...register('companyName')}
                  />
                  {errors.companyName && (
                    <p className="text-sm text-destructive">{errors.companyName.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="companyAddress">Alamat</Label>
                  <Textarea
                    id="companyAddress"
                    placeholder="Jl. Contoh No. 123, Jakarta Selatan"
                    rows={3}
                    {...register('companyAddress')}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="companyPhone">Telepon</Label>
                    <Input
                      id="companyPhone"
                      placeholder="021-12345678"
                      {...register('companyPhone')}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="companyEmail">Email</Label>
                    <Input
                      id="companyEmail"
                      type="email"
                      placeholder="info@acservice.com"
                      {...register('companyEmail')}
                    />
                    {errors.companyEmail && (
                      <p className="text-sm text-destructive">{errors.companyEmail.message}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="npwp">NPWP</Label>
                  <Input
                    id="npwp"
                    placeholder="12.345.678.9-012.000"
                    {...register('npwp')}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="logoUrl">URL Logo</Label>
                  <Input
                    id="logoUrl"
                    placeholder="https://example.com/logo.png"
                    {...register('logoUrl')}
                  />
                  <p className="text-sm text-muted-foreground">
                    URL logo perusahaan yang akan ditampilkan di invoice
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Bank Information Tab */}
          <TabsContent value="bank">
            <Card>
              <CardHeader>
                <CardTitle>Informasi Bank</CardTitle>
                <CardDescription>
                  Informasi rekening untuk pembayaran invoice
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="bankName">Nama Bank</Label>
                  <Input
                    id="bankName"
                    placeholder="Bank Mandiri"
                    {...register('bankName')}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bankAccountNumber">Nomor Rekening</Label>
                  <Input
                    id="bankAccountNumber"
                    placeholder="1234567890"
                    {...register('bankAccountNumber')}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bankAccountHolder">Atas Nama</Label>
                  <Input
                    id="bankAccountHolder"
                    placeholder="PT. AC Service Indonesia"
                    {...register('bankAccountHolder')}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Invoice Settings Tab */}
          <TabsContent value="invoice">
            <Card>
              <CardHeader>
                <CardTitle>Pengaturan Invoice</CardTitle>
                <CardDescription>
                  Konfigurasi format dan ketentuan invoice
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="invoicePrefix">
                      Prefix Invoice <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="invoicePrefix"
                      placeholder="INV"
                      {...register('invoicePrefix')}
                    />
                    {errors.invoicePrefix && (
                      <p className="text-sm text-destructive">{errors.invoicePrefix.message}</p>
                    )}
                    <p className="text-sm text-muted-foreground">
                      Format: {register('invoicePrefix').name || 'INV'}/2025/01/0001
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="taxPercentage">Pajak (%)</Label>
                    <Input
                      id="taxPercentage"
                      placeholder="11.00"
                      {...register('taxPercentage')}
                    />
                    {errors.taxPercentage && (
                      <p className="text-sm text-destructive">{errors.taxPercentage.message}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="defaultDueDays">Jatuh Tempo (hari)</Label>
                  <Input
                    id="defaultDueDays"
                    placeholder="30"
                    type="number"
                    {...register('defaultDueDays')}
                  />
                  <p className="text-sm text-muted-foreground">
                    Jumlah hari dari tanggal invoice hingga jatuh tempo
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="termsConditions">Syarat & Ketentuan</Label>
                  <Textarea
                    id="termsConditions"
                    placeholder="Terima kasih atas kepercayaan Anda..."
                    rows={4}
                    {...register('termsConditions')}
                  />
                  <p className="text-sm text-muted-foreground">
                    Teks yang akan ditampilkan di bagian bawah invoice
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end mt-6">
          <Button type="submit" disabled={isLoading} className="min-w-[150px]">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Menyimpan...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Simpan Konfigurasi
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
