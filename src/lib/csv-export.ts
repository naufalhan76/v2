export type CsvValue = string | number | boolean | null | undefined

export interface CsvColumn<T> {
  header: string
  value: (row: T) => CsvValue
}

const UTF8_BOM = '\uFEFF'

function escapeCsvValue(value: CsvValue): string {
  if (value === null || value === undefined) return ''

  const normalized = String(value).replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  if (/[",\n]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`
  }
  return normalized
}

export function buildCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((column) => escapeCsvValue(column.header)).join(',')
  const body = rows.map((row) =>
    columns.map((column) => escapeCsvValue(column.value(row))).join(',')
  )

  return [header, ...body].join('\n') + '\n'
}

export function downloadCsv<T>(filename: string, rows: T[], columns: CsvColumn<T>[]) {
  const blob = new Blob([UTF8_BOM, buildCsv(rows, columns)], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function datedCsvFilename(prefix: string, date = new Date()): string {
  return `${prefix}-${date.toISOString().slice(0, 10)}.csv`
}
