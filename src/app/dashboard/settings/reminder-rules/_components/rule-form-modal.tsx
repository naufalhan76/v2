'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Info } from 'lucide-react'
import type { ReminderRule } from '@/lib/reminder-utils'
import { RulePreview } from './rule-preview'

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

export type ReminderRuleFormData = z.infer<typeof reminderRuleSchema>

const TEMPLATE_VARIABLES: { key: string; description: string }[] = [
  { key: '{{customer_name}}', description: 'Nama customer' },
  { key: '{{ac_brand}}', description: 'Merk AC' },
  { key: '{{ac_model}}', description: 'Model AC' },
  { key: '{{location}}', description: 'Lokasi unit' },
  { key: '{{due_date}}', description: 'Tanggal jatuh tempo' },
]

const DEFAULT_TEMPLATE =
  'Halo {{customer_name}}, AC {{ac_brand}} {{ac_model}} di {{location}} akan jatuh tempo service rutin pada {{due_date}}. Silakan hubungi kami untuk jadwal kunjungan. Terima kasih.'

interface RuleFormModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingRule: ReminderRule | null
  isLoading: boolean
  onSubmit: (data: ReminderRuleFormData) => Promise<void>
}

export function RuleFormModal({
  open,
  onOpenChange,
  editingRule,
  isLoading,
  onSubmit,
}: RuleFormModalProps) {
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

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      reset()
    }
    onOpenChange(isOpen)
  }

  const handleInsertVariable = (variable: string) => {
    setValue('message_template', `${messageTemplate}${variable}`, {
      shouldValidate: true,
      shouldDirty: true,
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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
            <Label htmlFor="name" className="text-sm font-medium text-foreground">
              Nama Rule <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              placeholder="7 hari sebelum jatuh tempo"
              className="h-10"
              {...register('name')}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="days_before_due" className="text-sm font-medium text-foreground">
                Hari Sebelum Jatuh Tempo <span className="text-destructive">*</span>
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
              <p className="text-xs text-muted-foreground">Antara 1 sampai 90 hari</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="channel" className="text-sm font-medium text-foreground">
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
                <p className="text-sm text-destructive">{errors.channel.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message_template" className="text-sm font-medium text-foreground">
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
                    onClick={() => handleInsertVariable(v.key)}
                    className="text-xs font-mono rounded-md border border-border/60 bg-background px-3 py-2 min-h-[36px] hover:bg-muted active:bg-muted transition-colors"
                    title={v.description}
                  >
                    {v.key}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <RulePreview
            template={messageTemplate}
            isActive={isActiveValue}
            autoSend={autoSendValue}
          />

          <div className="grid grid-cols-1 gap-3 rounded-lg border border-border/50 p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-0.5">
                <Label htmlFor="is_active" className="text-sm font-medium text-foreground">
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
                <Label htmlFor="auto_send" className="text-sm font-medium text-foreground">
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
              onClick={() => handleOpenChange(false)}
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
  )
}
