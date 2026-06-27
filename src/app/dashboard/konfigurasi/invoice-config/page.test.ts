import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('invoice config coordinate schema', () => {
  it('defines optional nullable company coordinate fields with range validation', () => {
    const pageContent = readFileSync(join(__dirname, 'page.tsx'), 'utf-8')

    expect(pageContent).toContain('companyLat: z.number().min(-90).max(90).nullable().optional()')
    expect(pageContent).toContain('companyLng: z.number().min(-180).max(180).nullable().optional()')
  })

  it('preserves loaded company coordinates and forwards them to updateInvoiceConfig', () => {
    const pageContent = readFileSync(join(__dirname, 'page.tsx'), 'utf-8')

    expect(pageContent).toContain('companyLat: config.company_lat ?? null')
    expect(pageContent).toContain('companyLng: config.company_lng ?? null')
    expect(pageContent).toContain('companyLat: data.companyLat ?? null')
    expect(pageContent).toContain('companyLng: data.companyLng ?? null')
  })
})
