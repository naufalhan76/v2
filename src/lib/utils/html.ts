/**
 * Escape user-facing text before injecting it into invoice email HTML.
 * Use this for invoice fields like customer names, addresses, notes, and reference numbers.
 */
export function escapeHtml(text?: string | null): string {
  if (text == null) return '';

  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
