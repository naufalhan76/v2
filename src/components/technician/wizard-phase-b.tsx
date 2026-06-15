import { useEffect, useState } from 'react'
import { MapPin, User, Wrench } from 'lucide-react'

import { getActiveTimer, getElapsedSeconds, startTimer } from '@/lib/offline/timer'
import { cn } from '@/lib/utils'

type JobSummary = {
  customerName: string
  address: string
  serviceType: string
}

type WizardPhaseBProps = {
  orderId: string
  jobSummary: JobSummary
  onComplete: () => void
}

function formatElapsedTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':')
}

export function WizardPhaseB({ orderId, jobSummary, onComplete }: WizardPhaseBProps): React.JSX.Element {
  const [elapsedSeconds, setElapsedSeconds] = useState(() => getElapsedSeconds(orderId))

  useEffect(() => {
    const activeTimer = getActiveTimer()
    if (!activeTimer) {
      startTimer(orderId)
    }
    setElapsedSeconds(getElapsedSeconds(orderId))

    const interval = window.setInterval(() => {
      setElapsedSeconds(getElapsedSeconds(orderId))
    }, 1000)

    return () => window.clearInterval(interval)
  }, [orderId])

  useEffect(() => {
    window.history.pushState({ phaseBLocked: true }, '', window.location.href)
    const blockBackNavigation = () => {
      window.history.pushState({ phaseBLocked: true }, '', window.location.href)
    }

    window.addEventListener('popstate', blockBackNavigation)
    return () => window.removeEventListener('popstate', blockBackNavigation)
  }, [])

  return (
    <section className="min-h-screen bg-background pb-8 dark:bg-background">
      <header className="rounded-b-[40px] bg-primary px-5 pt-10 pb-16 text-white">
        <p className="text-sm font-semibold text-white/80">Langkah 2 dari 3</p>
        <h1 className="mt-2 text-2xl font-bold">Timer Pekerjaan</h1>
        <p className="mt-1 text-sm text-white/80">Waktu kerja berjalan sampai laporan detail diisi.</p>

        <div className="mt-6 flex items-center" aria-label="Wizard stepper">
          {[1, 2, 3].map((step) => (
            <div key={step} className={cn('flex items-center', step < 3 ? 'flex-1' : 'flex-none')}>
              <span
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                  step <= 2 && 'bg-white text-primary',
                  step > 2 && 'border-2 border-primary text-brand-200'
                )}
              >
                {step}
              </span>
              {step < 3 && <span className="mx-3 h-0.5 flex-1 rounded-full bg-brand-500" />}
            </div>
          ))}
        </div>
      </header>

      <main className="-mt-10 space-y-5 px-5">
        <section className="rounded-2xl border border-border bg-white p-6 text-center shadow-sm dark:border-border dark:bg-surface-muted">
          <div className="flex items-center justify-center gap-2">
            <span className="h-3 w-3 animate-pulse rounded-full bg-status-completed" aria-hidden="true" />
            <p className="text-sm font-medium text-muted-foreground dark:text-muted-foreground">Sedang Bekerja</p>
          </div>
          <p
            aria-label="Waktu kerja berjalan"
            className="mt-4 font-mono text-5xl font-bold text-primary dark:text-foreground"
          >
            {formatElapsedTime(elapsedSeconds)}
          </p>
        </section>

        <section className="rounded-2xl border border-border bg-white p-5 shadow-sm dark:border-border dark:bg-surface-muted">
          <h2 className="text-lg font-bold text-primary dark:text-foreground">Ringkasan Pekerjaan</h2>
          <div className="mt-4 space-y-4">
            <SummaryRow icon={User} label="Pelanggan" value={jobSummary.customerName} />
            <SummaryRow icon={MapPin} label="Alamat" value={jobSummary.address} />
            <SummaryRow icon={Wrench} label="Layanan" value={jobSummary.serviceType} />
          </div>
        </section>

        <button
          type="button"
          className="w-full bg-primary text-white font-semibold py-4 rounded-xl shadow-sm hover:bg-primary-hover transition-colors active:scale-[0.98] dark:bg-primary-hover dark:hover:bg-primary-hover"
          onClick={onComplete}
        >
          Isi Detail Pekerjaan
        </button>
      </main>
    </section>
  )
}

type SummaryRowProps = {
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
  label: string
  value: string
}

function SummaryRow({ icon: Icon, label, value }: SummaryRowProps): React.JSX.Element {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-100 text-primary dark:bg-surface dark:text-foreground">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-0 text-left">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground dark:text-muted-foreground">{label}</p>
        <p className="mt-1 font-semibold text-foreground dark:text-foreground">{value}</p>
      </div>
    </div>
  )
}
