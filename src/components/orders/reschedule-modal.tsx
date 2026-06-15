'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { CalendarIcon, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useReschedule } from '@/hooks/use-order-mutation'

const schema = z.object({
  reason: z.string().trim().min(3, 'Alasan minimal 3 karakter'),
  newScheduledDate: z.date({ required_error: 'Tanggal baru wajib diisi' }),
})

type FormValues = z.infer<typeof schema>

interface RescheduleModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  orderId: string | null
  defaultDate?: string | null
  onSuccess?: () => void
}

export function RescheduleModal({
  open,
  onOpenChange,
  orderId,
  defaultDate,
  onSuccess,
}: RescheduleModalProps) {
  const mutation = useReschedule()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      reason: '',
      newScheduledDate: defaultDate ? new Date(defaultDate) : undefined,
    },
  })

  useEffect(() => {
    if (open) {
      form.reset({
        reason: '',
        newScheduledDate: defaultDate ? new Date(defaultDate) : new Date(),
      })
    }
  }, [open, defaultDate, form])

  async function onSubmit(values: FormValues) {
    if (!orderId) return
    await mutation.mutateAsync({
      orderId,
      reason: values.reason,
      newScheduledDate: format(values.newScheduledDate, 'yyyy-MM-dd'),
    })
    onOpenChange(false)
    onSuccess?.()
  }

  const newDate = form.watch('newScheduledDate')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-w-[calc(100vw-2rem)]">
        <DialogHeader>
          <DialogTitle>Reschedule Order</DialogTitle>
          <DialogDescription>
            Order akan dikembalikan ke status Menunggu, assignment teknisi akan dihapus.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reason">
              Alasan Reschedule <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="reason"
              {...form.register('reason')}
              placeholder="Customer minta ganti jadwal, teknisi sakit, dll."
              rows={3}
            />
            {form.formState.errors.reason && (
              <p className="text-xs text-destructive">{form.formState.errors.reason.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>
              Tanggal Baru <span className="text-destructive">*</span>
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  type="button"
                  className={cn(
                    'h-11 w-full justify-start text-left font-normal sm:h-9',
                    !newDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {newDate ? format(newDate, 'd MMM yyyy') : 'Pilih tanggal'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={newDate}
                  onSelect={(d) =>
                    d && form.setValue('newScheduledDate', d, { shouldValidate: true })
                  }
                  locale={localeId as unknown as Record<string, unknown>}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            {form.formState.errors.newScheduledDate && (
              <p className="text-xs text-destructive">
                {form.formState.errors.newScheduledDate.message}
              </p>
            )}
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-11 w-full sm:h-9 sm:w-auto"
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending}
              className="h-11 w-full sm:h-9 sm:w-auto"
            >
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Reschedule
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
