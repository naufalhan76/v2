import { Suspense } from 'react'
import { JobDetailContent } from '@/components/technician/job-detail-content'
import { WizardOrchestrator } from '@/components/technician/wizard-orchestrator'
import { JobDetailSkeleton } from '@/components/technician/job-detail-skeleton'

interface JobDetailPageProps {
  params: Promise<{ id: string | string[] }>
}

export default async function JobDetailPage({ params }: JobDetailPageProps) {
  const resolvedParams = await params
  const rawId = Array.isArray(resolvedParams.id) ? resolvedParams.id : [resolvedParams.id]
  
  const isComplete = rawId[rawId.length - 1] === 'complete'
  
  const idSegments = isComplete ? rawId.slice(0, -1) : rawId
  const id = idSegments.map(decodeURIComponent).join('/')

  return (
    <div className="min-h-full bg-bg-gray-faded dark:bg-[#0f0e1a] pb-20">
      <Suspense fallback={<JobDetailSkeleton />}>
        {isComplete ? (
          <WizardOrchestrator orderId={id} />
        ) : (
          <div className="px-6 pt-6 pb-20">
            <JobDetailContent orderId={id} />
          </div>
        )}
      </Suspense>
    </div>
  )
}
