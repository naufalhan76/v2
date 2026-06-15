import { NextRequest } from 'next/server'
import { handleGetJob } from './handlers/get-job'
import { handleTransition } from './handlers/transition-job'
import { handleSubmitReport } from './handlers/submit-report'
import { authenticateTechnician, isTechnicianContext } from '../../helpers'
import { jsonError } from '@/app/api/utils'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string | string[] }> }
) {
  return handleGetJob(request, context)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string | string[] }> }
) {
  const authResult = await authenticateTechnician(request)
  if (!isTechnicianContext(authResult)) return authResult

  const resolvedParams = await params
  const rawId = Array.isArray(resolvedParams.id) ? resolvedParams.id : [resolvedParams.id]
  const lastSegment = rawId[rawId.length - 1]

  const body = await request.json()

  if (lastSegment === 'transition') {
    return handleTransition(request, { params, body, authResult })
  }

  if (lastSegment === 'report') {
    return handleSubmitReport(request, { params, body, authResult })
  }

  return jsonError('Invalid action. Append /transition or /report to the order ID.', 400)
}
