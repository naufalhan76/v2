export type DiscountType = 'PERCENTAGE' | 'FIXED'

function roundToTwo(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function calculateDiscount(
  subtotal: number,
  discountType: DiscountType,
  discountValue: number
): number {
  const safeSubtotal = Math.max(0, subtotal)
  const safeValue = Math.max(0, discountValue)

  if (discountType === 'PERCENTAGE') {
    return roundToTwo((safeSubtotal * safeValue) / 100)
  }

  return roundToTwo(Math.min(safeSubtotal, safeValue))
}

export function calculateTax(amount: number, taxRate: number): number {
  return roundToTwo((Math.max(0, amount) * Math.max(0, taxRate)) / 100)
}
