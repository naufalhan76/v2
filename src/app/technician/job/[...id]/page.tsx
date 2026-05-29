import { Suspense } from 'react'
import { JobDetailContent } from '@/components/technician/job-detail-content'
import { CompleteJobForm } from '@/components/technician/complete-job-form'
import { CompleteJobFormV2 } from '@/components/technician/complete-job-form-v2'
import { JobDetailSkeleton } from '@/components/technician/job-detail-skeleton'

interface JobDetailPageProps {
  params: Promise<{ id: string | string[] }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function JobDetailPage({ params, searchParams }: JobDetailPageProps) {
  const resolvedParams = await params
  const rawId = Array.isArray(resolvedParams.id) ? resolvedParams.id : [resolvedParams.id]
  
  const isComplete = rawId[rawId.length - 1] === 'complete'
  
  const idSegments = isComplete ? rawId.slice(0, -1) : rawId
  const id = idSegments.map(decodeURIComponent).join('/')

  const resolvedSearchParams = await searchParams
  const isV1 = resolvedSearchParams?.v === '1'

  return (
    <Suspense fallback={<JobDetailSkeleton />}>
      {isComplete ? (
        !isV1 ? <CompleteJobFormV2 orderId={id} /> : <CompleteJobForm orderId={id} />
      ) : (
        <JobDetailContent orderId={id} />
      )}
    </Suspense>
  )
}
