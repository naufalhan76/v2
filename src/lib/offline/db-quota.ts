export type QuotaInfo = {
  usage: number
  quota: number
  ratio: number | null
}

export async function getQuotaInfo(): Promise<QuotaInfo | null> {
  if (
    typeof navigator === 'undefined' ||
    !navigator.storage ||
    typeof navigator.storage.estimate !== 'function'
  ) {
    return null
  }
  const est = await navigator.storage.estimate()
  const usage = est.usage ?? 0
  const quota = est.quota ?? 0
  return { usage, quota, ratio: quota > 0 ? usage / quota : null }
}

export async function isQuotaCritical(): Promise<boolean> {
  const info = await getQuotaInfo()
  if (!info || info.ratio == null) return false
  return info.ratio > 0.9
}
