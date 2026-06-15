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
            setPhase('B')
          }}
        />
      )

    case 'B':
      return (
        <WizardPhaseB
          orderId={orderId}
          jobSummary={jobSummary}
          onComplete={() => setPhase('C')}
        />
      )

    case 'C': {
      if (!phaseADraft) {
        setPhase('A')
        return null
      }
      return (
        <WizardPhaseC
          orderId={orderId}
          phaseADraft={phaseADraft}
          technicianId={technicianId}
          onComplete={() => {
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
