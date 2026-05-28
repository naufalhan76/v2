'use client'

import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
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
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { MultiSelectDropdown } from '@/components/ui/multi-select-dropdown'
import { useToast } from '@/hooks/use-toast'
import { getTechnicians } from '@/lib/actions/technicians'
import { useAssignTechnician } from '@/hooks/use-order-mutation'

const schema = z
  .object({
    technicianId: z.string().min(1, 'Teknisi wajib dipilih'),
    helperIds: z.array(z.string()).default([]),
    scheduledDate: z.date({ required_error: 'Tanggal wajib diisi' }),
  })
  .refine(
    (data) => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      return data.scheduledDate >= today
    },
    { path: ['scheduledDate'], message: 'Tanggal tidak boleh di masa lalu' }
  )

type FormValues = z.infer<typeof schema>

interface AssignModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  orderIds: string[]
  defaultDate?: string | null
  currentTechnicianId?: string | null
  onSuccess?: () => void
}

export function AssignModal({
  open,
  onOpenChange,
  orderIds,
  defaultDate,
  currentTechnicianId,
  onSuccess,
}: AssignModalProps) {
  const { toast } = useToast()
  const mutation = useAssignTechnician()

  const isReassign = Boolean(currentTechnicianId)

  const { data: techResp, isLoading: techLoading } = useQuery({
    queryKey: ['technicians', 'all'],
    queryFn: () => getTechnicians({ limit: 200 }),
    enabled: open,
  })

  const technicians = (techResp?.data ?? []) as Array<{
    technician_id: string
    technician_name: string
  }>

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      technicianId: currentTechnicianId ?? '',
      helperIds: [],
      scheduledDate: defaultDate ? new Date(defaultDate) : new Date(),
    },
  })

  useEffect(() => {
    if (open) {
      form.reset({
        technicianId: currentTechnicianId ?? '',
        helperIds: [],
        scheduledDate: defaultDate ? new Date(defaultDate) : new Date(),
      })
    }
  }, [open, defaultDate, currentTechnicianId, form])

  async function onSubmit(values: FormValues) {
    if (orderIds.length === 0) {
      toast({ variant: 'destructive', title: 'Tidak ada order yang dipilih' })
      return
    }
    await mutation.mutateAsync({
      orderIds,
      technicianId: values.technicianId,
      helperTechnicianIds: values.helperIds.filter((id) => id !== values.technicianId),
      scheduledDate: format(values.scheduledDate, 'yyyy-MM-dd'),
    })
    onOpenChange(false)
    onSuccess?.()
  }

  const technicianId = form.watch('technicianId')
  const scheduledDate = form.watch('scheduledDate')
  const helperIds = form.watch('helperIds')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-w-[calc(100vw-2rem)]">
        <DialogHeader>
          <DialogTitle>{isReassign ? 'Reassign Teknisi' : 'Assign Teknisi'}</DialogTitle>
          <DialogDescription>
            {isReassign
              ? `Ganti teknisi lead untuk order ${orderIds[0]}.`
              : orderIds.length === 1
              ? `Assign teknisi untuk order ${orderIds[0]}`
              : `Assign teknisi untuk ${orderIds.length} order sekaligus`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="technician">
              Teknisi Lead <span className="text-destructive">*</span>
            </Label>
            <SearchableSelect
              value={technicianId}
              onValueChange={(v) => form.setValue('technicianId', v, { shouldValidate: true })}
              options={technicians.map((t) => ({
                id: t.technician_id,
                label: t.technician_name,
              }))}
              placeholder={techLoading ? 'Memuat teknisi...' : 'Pilih teknisi'}
              searchPlaceholder="Cari teknisi..."
            />
            {form.formState.errors.technicianId && (
              <p className="text-xs text-destructive">
                {form.formState.errors.technicianId.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Helper (opsional)</Label>
            <MultiSelectDropdown
              options={technicians
                .filter((t) => t.technician_id !== technicianId)
                .map((t) => ({ id: t.technician_id, label: t.technician_name }))}
              selected={helperIds}
              onSelectionChange={(vals) => form.setValue('helperIds', vals)}
              placeholder="Pilih helper (opsional)"
            />
          </div>

          <div className="space-y-2">
            <Label>
              Jadwal Kunjungan <span className="text-destructive">*</span>
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  type="button"
                  className={cn(
                    'h-11 w-full justify-start text-left font-normal sm:h-9',
                    !scheduledDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {scheduledDate ? format(scheduledDate, 'd MMM yyyy') : 'Pilih tanggal'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={scheduledDate}
                  onSelect={(d) => d && form.setValue('scheduledDate', d, { shouldValidate: true })}
                  disabled={(date) => {
                    const today = new Date()
                    today.setHours(0, 0, 0, 0)
                    return date < today
                  }}
                  locale={localeId}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            {form.formState.errors.scheduledDate && (
              <p className="text-xs text-destructive">
                {form.formState.errors.scheduledDate.message}
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
              {isReassign ? 'Reassign' : 'Assign'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
