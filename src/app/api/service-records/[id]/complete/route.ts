import { NextRequest } from 'next/server'
import { jsonError } from '@/app/api/utils'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await params
  return jsonError(
    'Not implemented. Use /api/technician/jobs/[id]/report instead.',
    501,
  )
}
