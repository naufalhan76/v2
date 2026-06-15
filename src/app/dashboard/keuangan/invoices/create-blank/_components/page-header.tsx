'use client'

import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PageHeaderProps {
  onBack: () => void
}

export function PageHeader({ onBack }: PageHeaderProps) {
  return (
    <div className="flex items-center gap-3 sm:gap-4">
      <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0 min-h-[44px] min-w-[44px]">
        <ArrowLeft className="h-4 w-4" />
      </Button>
      <div className="min-w-0">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Buat Invoice Kosong</h1>
        <p className="text-sm sm:text-base text-muted-foreground">Buat invoice manual tanpa menautkan ke transaksi/order</p>
      </div>
    </div>
  )
}
