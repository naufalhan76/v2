'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Bell,
  Mail,
  MessageCircle,
  Info,
} from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { TableSkeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  getReminderRules,
  createReminderRule,
  updateReminderRule,
  deleteReminderRule,
} from '@/lib/actions/reminders'
import type { ReminderRule } from '@/lib/reminder-utils'

const reminderRuleSchema = z.object({
  name: z.string().min(1, 'Nama rule wajib diisi'),
  days_before_due: z
    .coerce
    .number({ invalid_type_error: 'Harus berupa angka' })
    .int('Harus bilangan bulat')
    .min(1, 'Minimal 1 hari')
    .max(90, 'Maksimal 90 hari'),
  channel: z.enum(['WHATSAPP', 'EMAIL'], {
    errorMap: () => ({ message: 'Pilih channel' }),
  }),
  message_template: z.string().min(1, 'Template pesan wajib diisi'),
  is_active: z.boolean(),
  auto_send: z.boolean(),
})

type ReminderRuleFormData = z.infer<typeof reminderRuleSchema>

const TEMPLATE_VARIABLES: { key: string; description: string }[] = [
  { key: '{{customer_name}}', description: 'Nama customer' },
  { key: '{{ac_brand}}', description: 'Merk AC' },
  { key: '{{ac_model}}', description: 'Model AC' },
  { key: '{{location}}', description: 'Lokasi unit' },
  { key: '{{due_date}}', description: 'Tanggal jatuh tempo' },
]

const DEFAULT_TEMPLATE =
  'Halo {{customer_name}}, AC {{ac_brand}} {{ac_model}} di {{location}} akan jatuh tempo service rutin pada {{due_date}}. Silakan hubungi kami untuk jadwal kunjungan. Terima kasih.'

export default function ReminderRulesPage() {
  const [rules, setRules] = useState<ReminderRule[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<ReminderRule | null>(null)
  const [deletingRule, setDeletingRule] = useState<ReminderRule | null>(null)
  const { toast } = useToast()

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<ReminderRuleFormData>({
    resolver: zodResolver(reminderRuleSchema),
    defaultValues: {
      name: '',
      days_before_due: 7,
      channel: 'WHATSAPP',
      message_template: DEFAULT_TEMPLATE,
      is_active: true,
      auto_send: false,
    },
  })

  const channelValue = watch('channel')
  const isActiveValue = watch('is_active')
  const autoSendValue = watch('auto_send')
  const messageTemplate = watch('message_template') || ''

  useEffect(() => {
    loadRules()
  }, [])

  const loadRules = async () => {
    try {
      setIsFetching(true)
      const result = await getReminderRules()
      if (!result.success) {
        throw new Error(result.error)
      }
      const data = 'data' in result ? result.data : []
      setRules(Array.isArray(data) ? data : [])
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Gagal memuat daftar reminder rules',
      })
    } finally {
      setIsFetching(false)
    }
  }

  const handleOpenDialog = (rule?: ReminderRule) => {
    if (rule) {
      setEditingRule(rule)
      reset({
        name: rule.name,
        days_before_due: rule.days_before_due,
        channel: rule.channel,
        message_template: rule.message_template,
        is_active: rule.is_active,
        auto_send: rule.auto_send,
      })
    } else {
      setEditingRule(null)
      reset({
        name: '',
        days_before_due: 7,
        channel: 'WHATSAPP',
        message_template: DEFAULT_TEMPLATE,
        is_active: true,
        auto_send: false,
      })
    }
    setIsDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setIsDialogOpen(false)
    setEditingRule(null)
    reset()
  }

  const onSubmit = async (data: ReminderRuleFormData) => {
    try {
      setIsLoading(true)

      const result = editingRule
        ? await updateReminderRule(editingRule.rule_id, data)
        : await createReminderRule(data)

      if (!result.success) {
        throw new Error(result.error)
      }

      toast({
        title: 'Berhasil',
        description: editingRule
          ? 'Reminder rule berhasil diupdate'
          : 'Reminder rule berhasil ditambahkan',
      })

      handleCloseDialog()
      loadRules()
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Gagal menyimpan reminder rule',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingRule) return

    try {
      setIsLoading(true)
      const result = await deleteReminderRule(deletingRule.rule_id)
      if (!result.success) {
        throw new Error(result.error)
      }
      toast({
        title: 'Berhasil',
        description: 'Reminder rule berhasil dihapus',
      })
      setIsDeleteDialogOpen(false)
      setDeletingRule(null)
      loadRules()
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Gagal menghapus reminder rule',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const insertVariable = (variable: string) => {
    setValue('message_template', `${messageTemplate}${variable}`, {
      shouldValidate: true,
      shouldDirty: true,
    })
  }

  const renderChannelBadge = (channel: ReminderRule['channel']) => {
    if (channel === 'WHATSAPP') {
      return (
        <Badge variant="secondary" className="gap-1">
          <MessageCircle className="h-3 w-3" />
          WhatsApp
        </Badge>
      )
    }
    return (
      <Badge variant="secondary" className="gap-1">
        <Mail className="h-3 w-3" />
        Email
      </Badge>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
            Reminder Rules
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Kelola template dan threshold pengingat service rutin AC
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()} className="gap-2 w-full sm:w-auto">
              <Plus className="h-4 w-4" />
              Tambah Rule
            </Button>
          </DialogTrigger>
          <DialogContent className="w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] sm:max-w-[640px] max-h-[90vh] overflow-y-auto rounded-xl border border-border/50 shadow-sm">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-foreground">
                {editingRule ? 'Edit Reminder Rule' : 'Tambah Reminder Rule'}
              </DialogTitle>
              <DialogDescription>
                Atur kapan dan bagaimana sistem mengirim pengingat ke customer
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label
                  htmlFor="name"
                  className="text-sm font-medium text-foreground"
                >
                  Nama Rule <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  placeholder="7 hari sebelum jatuh tempo"
                  className="h-10"
                  {...register('name')}
                />
                {errors.name && (
                  <p className="text-sm text-destructive">
                    {errors.name.message}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label
                    htmlFor="days_before_due"
                    className="text-sm font-medium text-foreground"
                  >
                    Hari Sebelum Jatuh Tempo{' '}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="days_before_due"
                    type="number"
                    min={1}
                    max={90}
                    placeholder="7"
                    className="h-10"
                    {...register('days_before_due')}
                  />
                  {errors.days_before_due && (
                    <p className="text-sm text-destructive">
                      {errors.days_before_due.message}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Antara 1 sampai 90 hari
                  </p>
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="channel"
                    className="text-sm font-medium text-foreground"
                  >
                    Channel <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={channelValue}
                    onValueChange={(value) =>
                      setValue('channel', value as 'WHATSAPP' | 'EMAIL', {
                        shouldValidate: true,
                      })
                    }
                  >
                    <SelectTrigger id="channel" className="h-10">
                      <SelectValue placeholder="Pilih channel" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                      <SelectItem value="EMAIL">Email</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.channel && (
                    <p className="text-sm text-destructive">
                      {errors.channel.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="message_template"
                  className="text-sm font-medium text-foreground"
                >
                  Template Pesan <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="message_template"
                  placeholder="Tulis template pesan reminder..."
                  rows={6}
                  className="font-mono text-sm"
                  {...register('message_template')}
                />
                {errors.message_template && (
                  <p className="text-sm text-destructive">
                    {errors.message_template.message}
                  </p>
                )}
                <div className="rounded-lg border border-border/50 bg-muted/40 p-3">
                  <div className="flex items-center gap-2 mb-2 text-xs font-medium text-muted-foreground">
                    <Info className="h-3.5 w-3.5" />
                    Variabel tersedia (klik untuk menyisipkan)
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {TEMPLATE_VARIABLES.map((v) => (
                      <button
                        key={v.key}
                        type="button"
                        onClick={() => insertVariable(v.key)}
                        className="text-xs font-mono rounded-md border border-border/60 bg-background px-3 py-2 min-h-[36px] hover:bg-muted active:bg-muted transition-colors"
                        title={v.description}
                      >
                        {v.key}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 rounded-lg border border-border/50 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-0.5">
                    <Label
                      htmlFor="is_active"
                      className="text-sm font-medium text-foreground"
                    >
                      Aktif
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Rule ini akan digunakan untuk generate reminder baru
                    </p>
                  </div>
                  <Switch
                    id="is_active"
                    checked={isActiveValue}
                    onCheckedChange={(checked) =>
                      setValue('is_active', checked, { shouldDirty: true })
                    }
                  />
                </div>
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-0.5">
                    <Label
                      htmlFor="auto_send"
                      className="text-sm font-medium text-foreground"
                    >
                      Auto Send
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Jika aktif, sistem otomatis mengirim reminder. Jika
                      tidak, admin harus klik Send Now.
                    </p>
                  </div>
                  <Switch
                    id="auto_send"
                    checked={autoSendValue}
                    onCheckedChange={(checked) =>
                      setValue('auto_send', checked, { shouldDirty: true })
                    }
                  />
                </div>
              </div>

              <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCloseDialog}
                  disabled={isLoading}
                  className="w-full sm:w-auto"
                >
                  Batal
                </Button>
                <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    'Simpan'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="rounded-xl border border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground">
            Daftar Reminder Rules
          </CardTitle>
          <CardDescription>
            {rules.length} rule terdaftar
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isFetching ? (
            <TableSkeleton rows={5} columns={6} />
          ) : rules.length === 0 ? (
            <EmptyState
              icon={Bell}
              title="Belum ada reminder rule"
              description="Tambahkan rule pertama untuk mulai mengirim pengingat service ke customer."
              action={{
                label: 'Tambah Rule',
                icon: Plus,
                onClick: () => handleOpenDialog(),
              }}
            />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border/50 shadow-sm bg-card">
              <Table>
                <TableHeader className="[&_tr]:border-0">
                  <TableRow className="border-0">
                    <TableHead>Nama</TableHead>
                    <TableHead className="hidden md:table-cell">Hari Sebelum</TableHead>
                    <TableHead className="hidden sm:table-cell">Channel</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden lg:table-cell">Auto Send</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.map((rule) => (
                    <TableRow
                      key={rule.rule_id}
                      className="border-0 hover:bg-muted/50"
                    >
                      <TableCell className="font-medium">
                        <div>{rule.name}</div>
                        <div className="text-xs text-muted-foreground md:hidden mt-1">
                          {rule.days_before_due} hari sebelum
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">{rule.days_before_due} hari</TableCell>
                      <TableCell className="hidden sm:table-cell">{renderChannelBadge(rule.channel)}</TableCell>
                      <TableCell>
                        {rule.is_active ? (
                          <Badge className="bg-emerald-500 hover:bg-emerald-500/90">
                            Aktif
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Nonaktif</Badge>
                        )}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {rule.auto_send ? (
                          <Badge variant="outline" className="border-blue-500/50 text-blue-600 dark:text-blue-400">
                            Otomatis
                          </Badge>
                        ) : (
                          <Badge variant="outline">Manual</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1 sm:gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label="Edit"
                            onClick={() => handleOpenDialog(rule)}
                            className="min-h-[44px] min-w-[44px] sm:min-h-9 sm:min-w-9"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label="Hapus"
                            onClick={() => {
                              setDeletingRule(rule)
                              setIsDeleteDialogOpen(true)
                            }}
                            className="min-h-[44px] min-w-[44px] sm:min-h-9 sm:min-w-9"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Reminder Rule</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus rule{' '}
              <strong>{deletingRule?.name}</strong>? Aksi ini tidak dapat
              dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Menghapus...
                </>
              ) : (
                'Hapus'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
