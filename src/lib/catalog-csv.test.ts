import { describe, it, expect } from 'vitest'
import { parseCatalogCSV } from '@/lib/catalog-csv'

const HEADER =
  'unit_type_name,capacity_label,service_type_code,msn_code,service_name,base_price,includes'

describe('parseCatalogCSV', () => {
  it('returns a header error when the CSV is empty', () => {
    const res = parseCatalogCSV('')
    expect(res.rows).toEqual([])
    expect(res.headerError).toBeTruthy()
  })

  it('returns a header error when only the header row is present', () => {
    const res = parseCatalogCSV(HEADER)
    expect(res.rows).toEqual([])
    expect(res.headerError).toBeTruthy()
  })

  it('returns a header error when a required column is missing', () => {
    const csv = ['capacity_label,service_type_code,msn_code', 'A,CHK,MSN1'].join('\n')
    const res = parseCatalogCSV(csv)
    expect(res.rows).toEqual([])
    expect(res.headerError).toContain('unit_type_name')
  })

  it('parses a well-formed row', () => {
    const csv = [HEADER, 'Room Air,0.5-1.5 HP,CHK,MSN001,Checking,150000,filter;freon'].join('\n')
    const res = parseCatalogCSV(csv)
    expect(res.headerError).toBeUndefined()
    expect(res.errors).toEqual([])
    expect(res.rows).toHaveLength(1)
    expect(res.rows[0]).toMatchObject({
      unit_type_name: 'Room Air',
      capacity_label: '0.5-1.5 HP',
      service_type_code: 'CHK',
      msn_code: 'MSN001',
      service_name: 'Checking',
      base_price: 150000,
      priceBlank: false,
      includes: ['filter', 'freon'],
    })
  })

  it('flags a blank price as priceBlank with base_price 0', () => {
    const csv = [HEADER, 'Room Air,3 HP,KA,MSN002,Kategori A,,'].join('\n')
    const res = parseCatalogCSV(csv)
    expect(res.rows[0].priceBlank).toBe(true)
    expect(res.rows[0].base_price).toBe(0)
    expect(res.rows[0].includes).toEqual([])
  })

  it('strips currency symbols and spaces from the price', () => {
    const csv = [HEADER, 'Room Air,3 HP,KA,MSN003,Kategori A,Rp 1250000,'].join('\n')
    const res = parseCatalogCSV(csv)
    expect(res.rows[0].base_price).toBe(1250000)
  })

  it('records an error for a non-numeric price', () => {
    const csv = [HEADER, 'Room Air,3 HP,KA,MSN004,Kategori A,abc,'].join('\n')
    const res = parseCatalogCSV(csv)
    expect(res.rows).toHaveLength(0)
    expect(res.errors[0]).toMatchObject({ msn_code: 'MSN004' })
  })

  it('records an error when msn_code is blank', () => {
    const csv = [HEADER, 'Room Air,3 HP,KA,,Kategori A,1000,'].join('\n')
    const res = parseCatalogCSV(csv)
    expect(res.rows).toHaveLength(0)
    expect(res.errors[0].message).toContain('msn_code')
  })

  it('records an error when a required dimension cell is blank', () => {
    const csv = [HEADER, 'Room Air,,KA,MSN005,Kategori A,1000,'].join('\n')
    const res = parseCatalogCSV(csv)
    expect(res.rows).toHaveLength(0)
    expect(res.errors[0]).toMatchObject({ msn_code: 'MSN005' })
  })

  it('supports TAB-delimited input', () => {
    const tabHeader = HEADER.replace(/,/g, '\t')
    const tabRow = 'Room Air\t3 HP\tKA\tMSN006\tKategori A\t99000\tfilter'
    const res = parseCatalogCSV([tabHeader, tabRow].join('\n'))
    expect(res.rows).toHaveLength(1)
    expect(res.rows[0].base_price).toBe(99000)
    expect(res.rows[0].includes).toEqual(['filter'])
  })

  it('tolerates reordered columns', () => {
    const csv = [
      'msn_code,unit_type_name,capacity_label,service_type_code,service_name,base_price,includes',
      'MSN007,Room Air,3 HP,KA,Kategori A,5000,',
    ].join('\n')
    const res = parseCatalogCSV(csv)
    expect(res.rows[0]).toMatchObject({ msn_code: 'MSN007', base_price: 5000 })
  })

  it('falls back to service_type_code when service_name is blank', () => {
    const csv = [HEADER, 'Room Air,3 HP,KA,MSN008,,5000,'].join('\n')
    const res = parseCatalogCSV(csv)
    expect(res.rows[0].service_name).toBe('KA')
  })

  it('handles CRLF line endings', () => {
    const csv = [HEADER, 'Room Air,3 HP,KA,MSN009,Kategori A,5000,'].join('\r\n')
    const res = parseCatalogCSV(csv)
    expect(res.rows).toHaveLength(1)
  })
})
