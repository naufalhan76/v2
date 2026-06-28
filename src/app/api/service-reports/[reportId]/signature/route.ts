import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from '@clerk/nextjs/server'
import { getSignedSignatureUrl } from '@/lib/service-report'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  const { reportId } = await params
  const { userId } = getAuth(_req)

  if (!userId) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  // RLS on service_reports already gates SELECT; if the user can read the
  // report row, they may also see its signed URL. Otherwise we get null.
  const signedUrl = await getSignedSignatureUrl(reportId)

  return NextResponse.json({
    success: true,
    data: { signedUrl },
  })
}
