import { createClient } from '@/lib/supabase-browser'
import { getJobSnapshot } from '@/lib/offline/snapshot'
import type { LocalJobSnapshot } from '@/lib/offline/snapshot'
import { snapshotToJobContext } from './wizard-data'
import type { JobContext } from './wizard-types'

interface LoadWizardContextArgs {
  orderId: string
  snapshot?: LocalJobSnapshot
  mounted: () => boolean
  setJobData: (jobData: JobContext) => void
  setTechnicianId: (technicianId: string) => void
}

export async function loadWizardContext({
  orderId,
  snapshot,
  mounted,
  setJobData,
  setTechnicianId,
}: LoadWizardContextArgs) {
  const localSnapshot = snapshot ?? (await getJobSnapshot(orderId).catch(() => undefined))

  if (localSnapshot) {
    const ctx = snapshotToJobContext(localSnapshot)
    setJobData(ctx)
    if (localSnapshot.technicianId) setTechnicianId(localSnapshot.technicianId)
    void fetchServerContext(orderId, mounted, setJobData).catch((err) => {
      console.warn('Background job hydrate failed', err)
    })
    return 'local'
  }

  await loadTechnicianId(setTechnicianId)
  await fetchServerContext(orderId, mounted, setJobData)
  return 'server'
}

async function loadTechnicianId(setTechnicianId: (technicianId: string) => void) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data: techData } = await supabase
    .from('technicians')
    .select('technician_id')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  setTechnicianId(techData ? techData.technician_id : user.id)
}

async function fetchServerContext(
  orderId: string,
  mounted: () => boolean,
  setJobData: (jobData: JobContext) => void,
) {
  if (!mounted()) return
  const res = await fetch(`/api/technician/jobs/${encodeURIComponent(orderId)}`)
  if (!res.ok) throw new Error('Gagal memuat detail pekerjaan')

  const json = await res.json()
  if (!json.success || !json.data) throw new Error('Gagal memuat detail pekerjaan')

  setJobData(json.data as JobContext)
}
