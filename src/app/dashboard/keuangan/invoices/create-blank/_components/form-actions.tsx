'use client'

import { Loader2, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface FormActionsProps {
  isSubmitting: boolean
  onCancel: () => void
}

export function FormActions({ isSubmitting, onCancel }: FormActionsProps) {
  return (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button type="button" variant="outline" onClick={onCancel} className="min-h-[44px]">Batal</Button>
      <Button type="submit" disabled={isSubmitting} className="min-h-[44px]">
        {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Membuat Invoice...</> : <><Check className="mr-2 h-4 w-4" /> Buat Invoice</>}
      </Button>
    </div>
  )
}
