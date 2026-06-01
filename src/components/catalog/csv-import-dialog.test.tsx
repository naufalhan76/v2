import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'

import { CsvImportDialog } from './csv-import-dialog'
import type { ImportCatalogResult } from '@/lib/catalog-csv'

// ============================================================
// MOCKS
// ============================================================

vi.mock('@/lib/actions/bulk-import-catalog', () => ({
  importCatalogCSV: vi.fn(),
}))

import { importCatalogCSV } from '@/lib/actions/bulk-import-catalog'

const noop = () => {}

const sampleCsv =
  'unit_type_name,capacity_label,service_type_code,msn_code,service_name,base_price,includes\n' +
  'AC Split,1/2 PK,CC,SPLIT001,Cuci AC,85000,Cek freon'

function makeFile(content = sampleCsv, name = 'catalog.csv') {
  return new File([content], name, { type: 'text/csv' })
}

describe('CsvImportDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders dialog title and description when open', () => {
    render(<CsvImportDialog open onOpenChange={noop} />)
    expect(screen.getByText('Import Katalog dari CSV')).toBeInTheDocument()
    expect(
      screen.getByText(/Upload file CSV untuk menambahkan/i)
    ).toBeInTheDocument()
  })

  it('does not render content when closed', () => {
    render(<CsvImportDialog open={false} onOpenChange={noop} />)
    expect(screen.queryByText('Import Katalog dari CSV')).not.toBeInTheDocument()
  })

  it('disables the import button until a file is selected', () => {
    render(<CsvImportDialog open onOpenChange={noop} />)
    const importBtn = screen.getByRole('button', { name: 'Import' })
    expect(importBtn).toBeDisabled()
  })

  it('shows the file upload control and template download button', () => {
    render(<CsvImportDialog open onOpenChange={noop} />)
    expect(screen.getByLabelText('Upload CSV')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Template/i })).toBeInTheDocument()
  })

  it('triggers a template download via Blob URL', async () => {
    const user = userEvent.setup()
    const createSpy = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:mock')
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(noop)

    render(<CsvImportDialog open onOpenChange={noop} />)
    await user.click(screen.getByRole('button', { name: /Template/i }))

    expect(createSpy).toHaveBeenCalledTimes(1)
    expect(revokeSpy).toHaveBeenCalledWith('blob:mock')

    createSpy.mockRestore()
    revokeSpy.mockRestore()
  })

  it('enables import after selecting a file and shows file name', async () => {
    const user = userEvent.setup()
    render(<CsvImportDialog open onOpenChange={noop} />)

    const input = screen.getByLabelText('Upload CSV') as HTMLInputElement
    await user.upload(input, makeFile())

    await waitFor(() => {
      expect(screen.getByText('catalog.csv')).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: 'Import' })).toBeEnabled()
  })

  it('calls importCatalogCSV with file contents on submit', async () => {
    const user = userEvent.setup()
    const okResult: ImportCatalogResult = {
      success: true,
      importedCount: 1,
      errors: [],
    }
    vi.mocked(importCatalogCSV).mockResolvedValue(okResult)

    render(<CsvImportDialog open onOpenChange={noop} />)
    const input = screen.getByLabelText('Upload CSV') as HTMLInputElement
    await user.upload(input, makeFile())

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Import' })).toBeEnabled()
    })

    await user.click(screen.getByRole('button', { name: 'Import' }))

    await waitFor(() => {
      expect(importCatalogCSV).toHaveBeenCalledWith(sampleCsv)
    })
  })

  it('shows success message and fires onImportSuccess', async () => {
    const user = userEvent.setup()
    const onImportSuccess = vi.fn()
    vi.mocked(importCatalogCSV).mockResolvedValue({
      success: true,
      importedCount: 3,
      errors: [],
    })

    render(
      <CsvImportDialog open onOpenChange={noop} onImportSuccess={onImportSuccess} />
    )
    const input = screen.getByLabelText('Upload CSV') as HTMLInputElement
    await user.upload(input, makeFile())

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Import' })).toBeEnabled()
    })
    await user.click(screen.getByRole('button', { name: 'Import' }))

    await waitFor(() => {
      expect(
        screen.getByText('3 rows imported successfully')
      ).toBeInTheDocument()
    })
    expect(onImportSuccess).toHaveBeenCalledTimes(1)
  })

  it('renders a scrollable list of row errors', async () => {
    const user = userEvent.setup()
    vi.mocked(importCatalogCSV).mockResolvedValue({
      success: true,
      importedCount: 0,
      errors: [
        { rowNumber: 2, msn_code: 'SPLIT001', message: 'msn_code sudah ada.' },
        { rowNumber: 3, msn_code: 'SPLIT002', message: 'Harga tidak valid.' },
      ],
    })

    render(<CsvImportDialog open onOpenChange={noop} />)
    const input = screen.getByLabelText('Upload CSV') as HTMLInputElement
    await user.upload(input, makeFile())

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Import' })).toBeEnabled()
    })
    await user.click(screen.getByRole('button', { name: 'Import' }))

    await waitFor(() => {
      expect(screen.getByText('msn_code sudah ada.')).toBeInTheDocument()
    })
    expect(screen.getByText('Harga tidak valid.')).toBeInTheDocument()
    expect(screen.getByText(/Baris 2/)).toBeInTheDocument()
    expect(screen.getByText(/Baris 3/)).toBeInTheDocument()
  })

  it('renders a top-level error when import fails outright', async () => {
    const user = userEvent.setup()
    vi.mocked(importCatalogCSV).mockResolvedValue({
      success: false,
      importedCount: 0,
      errors: [],
      error: 'Header CSV tidak lengkap.',
    })

    render(<CsvImportDialog open onOpenChange={noop} />)
    const input = screen.getByLabelText('Upload CSV') as HTMLInputElement
    await user.upload(input, makeFile())

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Import' })).toBeEnabled()
    })
    await user.click(screen.getByRole('button', { name: 'Import' }))

    await waitFor(() => {
      expect(screen.getByText('Header CSV tidak lengkap.')).toBeInTheDocument()
    })
  })

  it('handles a thrown error from the action gracefully', async () => {
    const user = userEvent.setup()
    vi.mocked(importCatalogCSV).mockRejectedValue(new Error('Network down'))

    render(<CsvImportDialog open onOpenChange={noop} />)
    const input = screen.getByLabelText('Upload CSV') as HTMLInputElement
    await user.upload(input, makeFile())

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Import' })).toBeEnabled()
    })
    await user.click(screen.getByRole('button', { name: 'Import' }))

    await waitFor(() => {
      expect(screen.getByText('Network down')).toBeInTheDocument()
    })
  })

  it('has a default export matching the named export', async () => {
    const DefaultExport = (await import('./csv-import-dialog')).default
    expect(DefaultExport).toBe(CsvImportDialog)
  })
})
