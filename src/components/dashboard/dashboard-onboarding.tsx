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
        <div className="relative mb-4">
          {/* Indigo overlay backdrop */}
          <div className="absolute inset-0 bg-[#1b1938]/90 rounded-xl" />
          {/* Canvas card */}
          <div className="relative rounded-xl border border-hairline bg-background shadow-lg p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-canvas-soft">
                <Lightbulb className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xl font-[540] leading-tight text-foreground mb-2">
                  Selamat datang di Dashboard MSN ERP
                </div>
                <p className="text-sm text-ink-mute leading-relaxed">
                  Halaman ini menampilkan order yang memerlukan perhatian Anda. Gunakan filter tanggal untuk melihat periode tertentu, dan klik &quot;Buat Order&quot; atau &quot;Tugaskan&quot; untuk mengelola pekerjaan.
                </p>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-ink-mute hover:text-foreground" onClick={dismiss}>
                <X className="h-4 w-4" />
                <span className="sr-only">Tutup</span>
              </Button>
            </div>
          </div>
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
