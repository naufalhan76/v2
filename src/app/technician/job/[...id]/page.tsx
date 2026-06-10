import { Suspense } from 'react'
import { JobDetailContent } from '@/components/technician/job-detail-content'
import { JobCompletionWizard } from '@/components/technician/job-completion-wizard'
import { JobDetailSkeleton } from '@/components/technician/job-detail-skeleton'
import { cn } from '@/lib/utils'

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
    <div className={cn('min-h-full bg-background', !isComplete && '-mx-4 -my-4')}>
      <Suspense fallback={<JobDetailSkeleton />}>
        {isComplete ? (
          <JobCompletionWizard orderId={id} />
        ) : (
          <div className="px-4 py-4">
            <JobDetailContent orderId={id} />
          </div>
        )}
      </Suspense>
    </div>
  )
}
