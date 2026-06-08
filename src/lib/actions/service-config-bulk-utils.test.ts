import { describe, expect, it } from 'vitest'

import {
  buildBulkUpdateServiceCatalogMessage,
  parseBulkUpdateServiceCatalogCsv,
  prepareBulkUpdateServiceCatalogRows,
} from './service-config-bulk-utils'

describe('service config bulk update helpers', () => {
  it('parses quoted headers and prepares update payloads without DB access', () => {
    const csv = [
      '"catalog_id",msn_code,service_name,base_price,description,is_active',
      'cat-1,,Updated Name,250000,,FALSE',
      ',MSN002,,300000,Desc,aktif',
      ',,,,,',
    ].join('\n')

    const parsed = parseBulkUpdateServiceCatalogCsv(csv)
    const prepared = prepareBulkUpdateServiceCatalogRows(parsed.headers, parsed.records)

    expect(parsed.headers).toEqual(['catalog_id', 'msn_code', 'service_name', 'base_price', 'description', 'is_active'])
    expect(prepared.skippedCount).toBe(1)
    expect(prepared.updates).toEqual([
      {
        matchField: 'catalog_id',
        matchValue: 'cat-1',
        label: 'cat-1',
        payload: { service_name: 'Updated Name', base_price: 250000, description: null, is_active: false },
      },
      {
        matchField: 'msn_code',
        matchValue: 'MSN002',
        label: 'MSN002',
        payload: { base_price: 300000, description: 'Desc', is_active: true },
      },
    ])
  })

  it('builds the same Indonesian summary messages as the action', () => {
    expect(buildBulkUpdateServiceCatalogMessage(2, 1, 0)).toBe('2 diupdate, 1 dilewati')
    expect(buildBulkUpdateServiceCatalogMessage(0, 0, 0)).toBe('Tidak ada perubahan')
    expect(buildBulkUpdateServiceCatalogMessage(1, 0, 2)).toBe('1 diupdate, 2 error')
  })
})
