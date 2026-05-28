declare module 'date-fns' {
  export function format(date: Date | number | string, formatStr: string, options?: object): string
  export function parseISO(dateString: string, options?: object): Date
  export function isToday(date: Date | number): boolean
  export function isPast(date: Date | number): boolean
  export function subDays(date: Date | number, amount: number): Date
  export function differenceInDays(dateLeft: Date | number, dateRight: Date | number): number
  export function addDays(date: Date | number, amount: number): Date
  export function startOfDay(date: Date | number): Date
  export function endOfDay(date: Date | number): Date
  export function isBefore(dateLeft: Date | number, dateRight: Date | number): boolean
  export function isAfter(dateLeft: Date | number, dateRight: Date | number): boolean
  export function isValid(date: unknown): boolean
}

declare module 'date-fns/locale' {
  export const id: object
  export const enUS: object
}
