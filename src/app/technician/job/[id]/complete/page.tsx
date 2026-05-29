import { Suspense } from 'react'
import { CompleteJobForm } from '@/components/technician/complete-job-form'
import { CompleteJobFormV2 } from '@/components/technician/complete-job-form-v2'
import { JobDetailSkeleton } from '@/components/technician/job-detail-skeleton'

interface CompleteJobPageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function CompleteJobPage({ params, searchParams }: CompleteJobPageProps) {
  const { id } = await params
  const resolvedSearchParams = await searchParams
  
  const isV1 = resolvedSearchParams?.v === '1'

  return (
    <Suspense fallback={<JobDetailSkeleton />}>
      {!isV1 ? <CompleteJobFormV2 orderId={id} /> : <CompleteJobForm orderId={id} />}
    </Suspense>
  )
}
