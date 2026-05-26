import { NextRequest, NextResponse } from 'next/server'
import { getSignedSignatureUrl } from '@/lib/service-report'
import { createClient } from '@/lib/supabase-server'

export async function GET(
  _req: NextRequest,
  { params }: { params: { reportId: string } }
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  // RLS on service_reports already gates SELECT; if the user can read the
  // report row, they may also see its signed URL. Otherwise we get null.
  const signedUrl = await getSignedSignatureUrl(params.reportId)

  return NextResponse.json({
    success: true,
    data: { signedUrl },
  })
}
