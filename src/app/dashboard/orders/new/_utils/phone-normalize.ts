/**
 * Normalize Indonesian phone number to E.164 format (+62xxxxxxxxxx).
 * Strips spaces, dashes, and parentheses. Converts leading 0 to +62.
 */
export function normalizePhone(raw: string): string {
  const cleaned = raw.replace(/[\s\-()]/g, '')
  if (cleaned.startsWith('+62')) return cleaned
  if (cleaned.startsWith('62')) return `+${cleaned}`
  if (cleaned.startsWith('0')) return `+62${cleaned.slice(1)}`
  return cleaned
}
