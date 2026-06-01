'use client'

import { useState, useEffect } from 'react'
import { X, Lightbulb } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

const ONBOARDING_KEY = 'msn-erp-dashboard-onboarded'

export function useOnboardingReplay() {
  const [showBanner, setShowBanner] = useState(false)

  useEffect(() => {
    const seen = localStorage.getItem(ONBOARDING_KEY)
    if (!seen) {
      setShowBanner(true)
    }
  }, [])

  const dismiss = () => {
    setShowBanner(false)
    localStorage.setItem(ONBOARDING_KEY, 'true')
  }

  const replay = () => {
    localStorage.removeItem(ONBOARDING_KEY)
    setShowBanner(true)
  }

  return { showBanner, dismiss, replay }
}

export function DashboardOnboarding({ children }: { children: React.ReactNode }) {
  const { showBanner, dismiss } = useOnboardingReplay()

  return (
    <TooltipProvider delayDuration={200}>
      {showBanner && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 mb-4 flex items-start gap-3">
          <Lightbulb className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">
              Selamat datang di Dashboard MSN ERP
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Halaman ini menampilkan order yang memerlukan perhatian Anda. Gunakan filter tanggal untuk melihat periode tertentu, dan klik &quot;Buat Order&quot; atau &quot;Tugaskan&quot; untuk mengelola pekerjaan.
            </p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={dismiss}>
            <X className="h-4 w-4" />
            <span className="sr-only">Tutup</span>
          </Button>
        </div>
      )}
      {children}
    </TooltipProvider>
  )
}

export function DateFilterTooltip({ children }: { children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="bottom" align="end">
        <p className="text-xs max-w-[200px]">
          Pilih rentang tanggal untuk melihat order dalam periode tertentu
        </p>
      </TooltipContent>
    </Tooltip>
  )
}

export function StatusBadgeTooltip({ children }: { children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="top">
        <p className="text-xs max-w-[220px]">
          Warna menunjukkan status order. Amber = menunggu, Biru = ditugaskan, Ungu = sedang dikerjakan, Hijau = selesai
        </p>
      </TooltipContent>
    </Tooltip>
  )
}

export function QuickActionsTooltip({ children }: { children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="left">
        <p className="text-xs max-w-[180px]">
          Buat order baru atau tugaskan ke teknisi
        </p>
      </TooltipContent>
    </Tooltip>
  )
}
