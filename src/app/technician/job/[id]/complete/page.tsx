import { Suspense } from 'react'
import { CompleteJobForm } from '@/components/technician/complete-job-form'
import { JobDetailSkeleton } from '@/components/technician/job-detail-skeleton'

interface CompleteJobPageProps {
  params: Promise<{ id: string }>
}

export default async function CompleteJobPage({ params }: CompleteJobPageProps) {
  const { id } = await params

  return (
    <Suspense fallback={<JobDetailSkeleton />}>
      <CompleteJobForm orderId={id} />
    </Suspense>
  )
}
