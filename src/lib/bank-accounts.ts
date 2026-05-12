export type BankAccount = {
  id: string
  account_label: string
  bank: string
  account_number: string
  account_name: string
  tax_percentage: number
}

type BankAccountLike = Partial<BankAccount> & Record<string, unknown>

const DEFAULT_TAX_PERCENTAGE = 11

export function normalizeBankAccount(bank: unknown, index: number): BankAccount {
  const account = bank as BankAccountLike

  return {
    id: account?.id || `${index}`,
    account_label: account?.account_label || `Payment Account ${index + 1}`,
    bank: account?.bank || '',
    account_number: account?.account_number || '',
    account_name: account?.account_name || '',
    tax_percentage: typeof account?.tax_percentage === 'number' ? account.tax_percentage : DEFAULT_TAX_PERCENTAGE,
  }
}

export function parseBankAccounts(input: unknown): BankAccount[] {
  if (!input) return []

  try {
    const parsed = typeof input === 'string' ? JSON.parse(input) : input

    if (!Array.isArray(parsed)) return []

    return parsed.map((bank, index) => normalizeBankAccount(bank, index))
  } catch {
    return []
  }
}
