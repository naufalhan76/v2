/**
 * Format a number as Indonesian Rupiah currency.
 * Returns `Rp 0` for nullish or non-finite inputs.
 */
export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(amount)) {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(0)
  }

  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount)
}

/**
 * Format an ISO timestamp to a human-readable Indonesian datetime.
 * Returns an em dash when the input is missing.
 */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(d)
}
