export const ORDER_SERVICE_TYPES = [
  'REFILL_FREON',
  'CLEANING',
  'REPAIR',
  'INSTALLATION',
  'INSPECTION',
  'CHECKING',
  'UNINSTALL'
] as const

export type OrderServiceType = (typeof ORDER_SERVICE_TYPES)[number]

const SERVICE_TYPE_ALIASES: Record<string, OrderServiceType> = {
  MAINTENANCE: 'CHECKING',
}

export function normalizeOrderServiceType(value: string | null | undefined): OrderServiceType {
  const raw = (value || '').trim().toUpperCase()

  if (SERVICE_TYPE_ALIASES[raw]) {
    return SERVICE_TYPE_ALIASES[raw]
  }

  if ((ORDER_SERVICE_TYPES as readonly string[]).includes(raw)) {
    return raw as OrderServiceType
  }

  return 'INSPECTION'
}

