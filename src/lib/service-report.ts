import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { logger } from '@/lib/logger'

export interface ServiceReportMaterial {
  addon_id?: string | null
  name: string
  qty: number
  unit_price: number
  total: number
  is_manual?: boolean
}

export interface ServiceReport {
  report_id: string
  order_id: string
  technician_id: string
  photos_before: string[]
  photos_after: string[]
  materials: ServiceReportMaterial[]
  actual_total_price: number
  customer_signature_url: string | null
  customer_name_signed: string | null
  signed_at: string | null
  notes: string | null
  work_started_at: string | null
  work_completed_at: string | null
  submitted_at: string
  created_at: string
  updated_at: string
  technicians?: {
    technician_id: string
    technician_name: string
  } | null
}

/**
 * Fetch the latest non-deleted service report for an order.
 * Returns null if no report exists (e.g. teknisi has not submitted yet).
 */
export async function getServiceReport(
  orderId: string
): Promise<ServiceReport | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('service_reports')
    .select(
      `
      report_id,
      order_id,
      technician_id,
      photos_before,
      photos_after,
      materials,
      actual_total_price,
      customer_signature_url,
      customer_name_signed,
      signed_at,
      notes,
      work_started_at,
      work_completed_at,
      submitted_at,
      created_at,
      updated_at,
      technicians (
        technician_id,
        technician_name
      )
    `
    )
    .eq('order_id', orderId)
    .is('deleted_at', null)
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    logger.error('Error fetching service report:', error)
    throw new Error('Gagal memuat laporan teknisi')
  }

  if (!data) return null

  // Supabase types joined relations as arrays even when the FK is one-to-one.
  // Normalise to a single object (or null) for the consumer-facing shape.
  const rawTechnicians = (data as { technicians?: unknown }).technicians
  const technician = Array.isArray(rawTechnicians)
    ? (rawTechnicians[0] as ServiceReport['technicians']) ?? null
    : (rawTechnicians as ServiceReport['technicians']) ?? null

  return {
    ...data,
    photos_before: await reSignPhotos(
      supabase,
      (data.photos_before as string[] | null) ?? []
    ),
    photos_after: await reSignPhotos(
      supabase,
      (data.photos_after as string[] | null) ?? []
    ),
    materials: (data.materials as ServiceReportMaterial[] | null) ?? [],
    technicians: technician,
  } as unknown as ServiceReport
}

async function reSignPhotos(
  supabase: Awaited<ReturnType<typeof createClient>>,
  paths: string[]
): Promise<string[]> {
  if (paths.length === 0) return []

  return Promise.all(
    paths.map(async (value) => {
      if (value.startsWith('http://') || value.startsWith('https://')) {
        return value
      }
      const { data, error } = await supabase.storage
        .from('service-photos')
        .createSignedUrl(value, 3600)
      if (error || !data?.signedUrl) {
        logger.error('Error creating signed photo URL:', error)
        return value
      }
      return data.signedUrl
    })
  )
}

/**
 * Generate a signed URL for the customer signature (private bucket).
 * Default expiry: 1 hour.
 *
 * Returns null when:
 *  - the report has no signature recorded
 *  - the signed URL fails to generate (logged, swallowed for the UI)
 */
export async function getSignedSignatureUrl(
  reportId: string,
  expiresInSeconds = 60 * 60
): Promise<string | null> {
  const supabase = await createClient()

  const { data: report, error: reportError } = await supabase
    .from('service_reports')
    .select('customer_signature_url')
    .eq('report_id', reportId)
    .is('deleted_at', null)
    .maybeSingle()

  if (reportError || !report?.customer_signature_url) {
    if (reportError) logger.error('Error reading signature path:', reportError)
    return null
  }

  // The stored value is the object key inside the `signatures` bucket
  // (e.g. `<orderId>/<reportId>.png`). When older records accidentally
  // stored a full URL, fall back to that value.
  const path = report.customer_signature_url
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path
  }

  // Use admin client (service role key) to bypass RLS on the signatures bucket.
  // The SELECT on service_reports is already gated by the caller's session.
  const admin = createAdminClient()
  const { data, error } = await admin.storage
    .from('signatures')
    .createSignedUrl(path, expiresInSeconds)

  if (error || !data?.signedUrl) {
    logger.error('Error creating signed signature URL:', error)
    return null
  }

  return data.signedUrl
}

/**
 * Convenience: fetch a report and a signed signature URL together.
 * Used by the "Create Invoice from Order" flow when we want the full
 * picture in one round-trip.
 */
export async function getServiceReportWithSignature(orderId: string): Promise<{
  report: ServiceReport | null
  signatureUrl: string | null
}> {
  const report = await getServiceReport(orderId)
  if (!report) return { report: null, signatureUrl: null }
  const signatureUrl = report.customer_signature_url
    ? await getSignedSignatureUrl(report.report_id)
    : null
  return { report, signatureUrl }
}
