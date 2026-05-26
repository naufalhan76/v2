import { Suspense } from 'react'
import { JobDetailContent } from '@/components/technician/job-detail-content'
import { JobDetailSkeleton } from '@/components/technician/job-detail-skeleton'

interface JobDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function JobDetailPage({ params }: JobDetailPageProps) {
  const { id } = await params

  return (
    <Suspense fallback={<JobDetailSkeleton />}>
      <JobDetailContent orderId={id} />
    </Suspense>
  )
}
