'use client'

import { Calendar as CalendarIcon } from 'lucide-react'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { MultiSelectDropdown } from '@/components/ui/multi-select-dropdown'
import { cn } from '@/lib/utils'

type Technician = {
  technician_id: string
  full_name: string
}

type SchedulingStepProps = {
  scheduledDate: Date | undefined
  onScheduledDateChange: (date: Date | undefined) => void
  today: Date | undefined
  skipAssignment: boolean
  onSkipAssignmentChange: (skip: boolean) => void
  leadTechnicianId: string
  onLeadTechnicianChange: (id: string) => void
  helperTechnicianIds: string[]
  onHelperChange: (ids: string[]) => void
  technicians: Technician[] | undefined
  orderNotes: string
  onNotesChange: (notes: string) => void
  isScheduleFilled: boolean
  onNavigateNext: () => void
}

export function SchedulingStep({
  scheduledDate,
  onScheduledDateChange,
  today,
  skipAssignment,
  onSkipAssignmentChange,
  leadTechnicianId,
  onLeadTechnicianChange,
  helperTechnicianIds,
  onHelperChange,
  technicians,
  orderNotes,
  onNotesChange,
  isScheduleFilled,
  onNavigateNext,
}: SchedulingStepProps) {
  return (
    <div className="space-y-4 pt-2">
      <div>
        <Label>Tanggal Kunjungan *</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                'h-11 w-full justify-start text-left font-normal sm:h-9',
                !scheduledDate && 'text-muted-foreground'
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {scheduledDate
                ? format(scheduledDate, 'EEEE, dd MMMM yyyy')
                : 'Pilih tanggal'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={scheduledDate}
              onSelect={onScheduledDateChange}
              disabled={today ? (d) => d < today : undefined}
              locale={localeId as unknown as Record<string, unknown>}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="rounded-md border p-4">
        <div className="mb-3 flex items-start gap-2">
          <Checkbox
            id="skip-assignment"
            checked={skipAssignment}
            onCheckedChange={(v) => onSkipAssignmentChange(v === true)}
          />
          <Label htmlFor="skip-assignment" className="cursor-pointer">
            Skip — assign teknisi nanti
          </Label>
        </div>

        {!skipAssignment && (
          <div className="space-y-3">
            <div>
              <Label>Lead Teknisi *</Label>
              <Select value={leadTechnicianId} onValueChange={onLeadTechnicianChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih teknisi..." />
                </SelectTrigger>
                <SelectContent>
                  {(technicians || []).map((t) => (
                    <SelectItem key={t.technician_id} value={t.technician_id}>
                      {t.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Helper (opsional)</Label>
              <MultiSelectDropdown
                options={(technicians || []).flatMap((t) =>
                  t.technician_id === leadTechnicianId ? [] : [{ id: t.technician_id, label: t.full_name }]
                )}
                selected={helperTechnicianIds}
                onSelectionChange={onHelperChange}
                placeholder="Pilih helper..."
              />
            </div>
          </div>
        )}
      </div>

      <div>
        <Label>Catatan Order (opsional)</Label>
        <Textarea
          rows={3}
          value={orderNotes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Catatan tambahan untuk order ini..."
        />
      </div>

      {isScheduleFilled && (
        <div className="flex justify-end">
          <Button
            onClick={onNavigateNext}
            className="h-11 w-full sm:h-9 sm:w-auto"
          >
            Lanjut ke Review
          </Button>
        </div>
      )}
    </div>
  )
}
