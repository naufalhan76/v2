import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPhone(phone: string | number | null | undefined): string {
  if (phone == null) {
    return ""
  }

  if (typeof phone === "string") {
    // Convert string scientific notation (e.g. "6.28138E+11") to plain digits
    if (/^[0-9]+\.?[0-9]*[Ee][+\-]?[0-9]+$/.test(phone.trim())) {
      const n = Number(phone)
      if (Number.isFinite(n) && n > 0) {
        return BigInt(Math.trunc(n)).toString()
      }
    }
    return phone
  }

  if (!Number.isFinite(phone) || phone === 0) {
    return ""
  }

  if (phone < 0) {
    return String(phone)
  }

  return BigInt(Math.trunc(phone)).toString()
}
