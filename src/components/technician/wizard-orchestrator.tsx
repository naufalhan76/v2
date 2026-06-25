'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, AlertCircle } from 'lucide-react'

import { WizardPhaseA, type AcUnitData, type PhaseADraft } from './wizard-phase-a'
import { WizardPhaseB } from './wizard-phase-b'
import { WizardPhaseC } from './wizard-phase-c'
import { useToast } from '@/hooks/use-toast'
import { buildJobSummary, extractAcUnits } from './wizard/wizard-data'
import { loadWizardContext } from './wizard/wizard-context'
import { getWizardPhase, setWizardPhase, clearWizardPhase, isTimerActive } from '@/lib/offline/timer'
import type { JobContext, Phase, WizardOrchestratorProps } from './wizard/wizard-types'

export function WizardOrchestrator({ orderId, snapshot }: WizardOrchestratorProps) {
  const router = useRouter()
  const { toast } = useToast()

  const [jobData, setJobData] = useState<JobContext | null>(null)
  const [technicianId, setTechnicianId] = useState<string>('')
  const [loadingContext, setLoadingContext] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [phase, setPhase] = useState<Phase>('A')
  const [phaseADraft, setPhaseADraft] = useState<PhaseADraft | null>(null)

  useEffect(() => {
    let mounted = true

    async function fetchContext() {
      try {
        const source = await loadWizardContext({
          orderId,
          snapshot,
          mounted: () => mounted,
          setJobData,
          setTechnicianId,
        })
        if (source === 'local' && mounted) {
          setLoadingContext(false)
          return
        }
      } catch (err) {
        console.error('Failed to fetch job context', err)
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Gagal memuat data pekerjaan')
        }
      } finally {
        if (mounted) {
          setLoadingContext(false)
        }
      }
    }

    void fetchContext()

    return () => {
      mounted = false
    }
  }, [orderId, snapshot])

  // Phase resume from persisted localStorage (Task 2)
  useEffect(() => {
    if (loadingContext) return

    const persistedPhase = getWizardPhase(orderId)
    if (!persistedPhase) return

    if (persistedPhase === 'B') {
      if (isTimerActive(orderId)) {
        setPhase('B')
      } else {
        clearWizardPhase(orderId)
      }
      return
    }

    if (persistedPhase === 'C') {
      const draftKey = `msn-tech-wizard-draft-${orderId}`
      try {
        const rawDraft = localStorage.getItem(draftKey)
        if (rawDraft) {
          const draft = JSON.parse(rawDraft)
          setPhaseADraft(draft)
          setPhase('C')
          return
        }
      } catch {
        // corrupt draft — fall through to fallback
      }
      // No draft — fallback
      if (isTimerActive(orderId)) {
        setPhase('B')
      } else {
        clearWizardPhase(orderId)
      }
    }
  }, [loadingContext, orderId])

  if (loadingContext) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background dark:bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !jobData) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-5 dark:bg-background">
        <AlertCircle className="mb-3 h-10 w-10 text-destructive" />
        <p className="mb-2 text-center text-sm font-medium text-foreground dark:text-foreground">
          {error || 'Data pekerjaan tidak ditemukan'}
        </p>
        <p className="mb-4 text-sm text-muted-foreground dark:text-muted-foreground">
          Tidak dapat memuat detail pekerjaan
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="border-2 border-border rounded-xl px-6 py-3 text-sm font-semibold text-primary hover:bg-muted transition-colors dark:border-border dark:text-foreground dark:hover:bg-surface"
        >
          Coba Lagi
        </button>
      </div>
    )
  }

  const acUnits = extractAcUnits(jobData)
  const jobSummary = buildJobSummary(jobData)

  switch (phase) {
    case 'A':
      return (
        <WizardPhaseA
          orderId={orderId}
          acUnits={acUnits as AcUnitData[]}
          onComplete={(draft: PhaseADraft) => {
            setPhaseADraft(draft)
            setWizardPhase(orderId, 'B')
            setPhase('B')
          }}
        />
      )

    case 'B':
      return (
        <WizardPhaseB
          orderId={orderId}
          jobSummary={jobSummary}
          onComplete={() => {
            setWizardPhase(orderId, 'C')
            setPhase('C')
          }}
        />
      )

    case 'C': {
      if (!phaseADraft) {
        setWizardPhase(orderId, 'A')
        setPhase('A')
        return null
      }
      return (
        <WizardPhaseC
          orderId={orderId}
          phaseADraft={phaseADraft}
          technicianId={technicianId}
          onComplete={() => {
            clearWizardPhase(orderId)
            toast({
              title: 'Tersimpan',
              description: 'Laporan akan disinkronkan saat online',
            })
            router.push('/technician')
          }}
        />
      )
    }

    default:
      return null
  }
}
