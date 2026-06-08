'use client'

import { Button } from '@/components/ui/button'
import { ArrowLeft, Check } from 'lucide-react'

interface InvoiceFormShellProps {
  currentStep: number
  onBack: () => void
  children: React.ReactNode
}

export function InvoiceFormShell({ currentStep, onBack, children }: InvoiceFormShellProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 sm:gap-4">
        <Button variant="ghost" onClick={onBack} className="shrink-0 min-h-[44px] min-w-[44px]">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Buat Invoice</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Wizard pembuatan invoice baru</p>
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 sm:gap-4 overflow-x-auto">
        {[1, 2, 3, 4].map((step) => (
          <div key={step} className="flex items-center gap-2">
            <div
              className={`flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full border-2 text-sm ${
                currentStep === step
                  ? 'border-primary bg-primary text-primary-foreground'
                  : currentStep > step
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-muted-foreground text-muted-foreground'
              }`}
            >
              {currentStep > step ? <Check className="h-4 w-4 sm:h-5 sm:w-5" /> : step}
            </div>
            {step < 4 && <div className="h-0.5 w-6 sm:w-12 bg-muted-foreground" />}
          </div>
        ))}
      </div>

      {children}
    </div>
  )
}
