'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { UserCheck, X } from 'lucide-react'

interface BulkAssignBarProps {
  selectedCount: number
  onAssign: () => void
  onClear: () => void
}

export function BulkAssignBar({ selectedCount, onAssign, onClear }: BulkAssignBarProps) {
  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
      <div className="flex items-center gap-3 rounded-lg border border-border bg-background px-4 py-3 shadow-lg">
        <Badge variant="secondary" className="h-7 px-2.5 text-base font-medium bg-primary text-primary-foreground">
          {selectedCount} dipilih
        </Badge>
        <div className="h-4 w-px bg-border" />
        <Button
          size="sm"
          onClick={onAssign}
          disabled={selectedCount === 0}
          className="h-8 gap-1.5"
        >
          <UserCheck className="h-3.5 w-3.5" />
          Tugaskan yang Dipilih
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onClear}
          className="h-8 gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
          Batal Pilih
        </Button>
      </div>
    </div>
  )
}
