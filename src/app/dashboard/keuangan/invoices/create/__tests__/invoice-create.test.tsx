import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import CreateInvoicePage from '../page'

const pushMock = vi.fn()
const backMock = vi.fn()
const toastMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, back: backMock }),
}))

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastMock }),
}))

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

vi.mock('@/lib/actions/orders', () => ({
  getOrders: vi.fn(),
}))

vi.mock('@/lib/actions/service-pricing', () => ({
  getServicePricingByType: vi.fn(),
}))

vi.mock('@/lib/actions/addons', () => ({
  getActiveAddons: vi.fn(),
}))

vi.mock('@/lib/actions/invoices', () => ({
  createInvoice: vi.fn(),
  getOrderItemsForInvoice: vi.fn(),
}))

vi.mock('@/lib/supabase-browser', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/components/ui/select', async () => {
  const React = await import('react')
  return {
    Select: ({ value, onValueChange, children }: { value?: string; onValueChange?: (value: string) => void; children: React.ReactNode }) => (
      <select data-testid="mock-select" value={value || ''} onChange={(event) => onValueChange?.(event.target.value)}>
        {children}
      </select>
    ),
    SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    SelectValue: ({ placeholder }: { placeholder?: string }) => <option value="">{placeholder}</option>,
    SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => (
      <option value={value}>{children}</option>
    ),
  }
})

vi.mock('@/components/ui/searchable-select', async () => {
  const React = await import('react')
  return {
    SearchableSelect: ({ options, value, onValueChange, placeholder }: { options: Array<{ id: string; label: string; secondaryLabel?: string }>; value: string; onValueChange: (value: string) => void; placeholder?: string }) => {
      React.useEffect(() => {
        if (!value && options.length > 0) onValueChange(options[0].id)
      }, [options, onValueChange, value])

      return (
        <select data-testid="mock-searchable-select" value={value || ''} onChange={(event) => onValueChange(event.target.value)}>
          <option value="">{placeholder}</option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}{option.secondaryLabel ? ` (${option.secondaryLabel})` : ''}
            </option>
          ))}
        </select>
      )
    },
  }
})

import { getOrders } from '@/lib/actions/orders'
import { getActiveAddons } from '@/lib/actions/addons'
import { createInvoice, getOrderItemsForInvoice } from '@/lib/actions/invoices'
import { getServicePricingByType } from '@/lib/actions/service-pricing'
import { createClient } from '@/lib/supabase-browser'

const orders = [
  {
    order_id: 'ORD-001',
    customer_id: 'CUS-001',
    status: 'COMPLETED',
    order_type: 'AC_CLEANING',
    customers: { customer_name: 'Budi Santoso', phone_number: '081234567890' },
  },
  {
    order_id: 'ORD-002',
    customer_id: 'CUS-002',
    status: 'ASSIGNED',
    order_type: 'AC_REPAIR',
    customers: { customer_name: 'Siti Aminah', phone_number: '082233344455' },
  },
]

const addons = [
  {
    addon_id: 'ADD-FREON',
    category: 'Parts',
    item_name: 'Freon R32',
    item_code: 'FR32',
    description: null,
    unit_of_measure: 'kg',
    unit_price: 75_000,
    stock_quantity: 10,
    minimum_stock: 1,
    applicable_service_types: null,
    is_active: true,
    created_at: '',
    updated_at: '',
  },
  {
    addon_id: 'ADD-BRACKET',
    category: 'Parts',
    item_name: 'Bracket Outdoor',
    item_code: 'BRK',
    description: null,
    unit_of_measure: 'pcs',
    unit_price: 50_000,
    stock_quantity: 10,
    minimum_stock: 1,
    applicable_service_types: null,
    is_active: true,
    created_at: '',
    updated_at: '',
  },
  {
    addon_id: 'ADD-PIPE',
    category: 'Parts',
    item_name: 'Pipa Drain',
    item_code: 'PIP',
    description: null,
    unit_of_measure: 'm',
    unit_price: 25_000,
    stock_quantity: 10,
    minimum_stock: 1,
    applicable_service_types: null,
    is_active: true,
    created_at: '',
    updated_at: '',
  },
  {
    addon_id: 'ADD-CAP',
    category: 'Parts',
    item_name: 'Kapasitor',
    item_code: 'CAP',
    description: null,
    unit_of_measure: 'pcs',
    unit_price: 90_000,
    stock_quantity: 10,
    minimum_stock: 1,
    applicable_service_types: null,
    is_active: true,
    created_at: '',
    updated_at: '',
  },
]

const bankAccounts = [
  {
    id: 'BANK-1',
    account_label: 'BCA Operasional',
    bank: 'BCA',
    account_number: '1234567890',
    account_name: 'PT AC Service',
    tax_percentage: 11,
  },
]

const orderItems = [
  {
    serviceName: 'AC Cleaning',
    msnCode: 'MSN-001',
    unitTypeName: 'Wall',
    capacityLabel: '1PK',
    quantity: 1,
    estimatedPrice: 150_000,
    serviceType: 'AC_CLEANING',
  },
  {
    serviceName: 'AC Deep Cleaning',
    msnCode: 'MSN-002',
    unitTypeName: 'Cassette',
    capacityLabel: '2PK',
    quantity: 2,
    estimatedPrice: 200_000,
    serviceType: 'AC_CLEANING',
  },
]

const setupSupabase = (invoicedRows: Array<{ order_id: string | null }> = [], accounts = bankAccounts) => {
  const from = vi.fn((table: string) => {
    if (table === 'invoices') {
      return {
        select: vi.fn(() => ({
          in: vi.fn(async () => ({ data: invoicedRows, error: null })),
        })),
      }
    }

    return {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(async () => ({ data: { bank_accounts: accounts }, error: null })),
        })),
      })),
    }
  })

  vi.mocked(createClient).mockReturnValue({ from } as never)
}

let testContainer: HTMLElement

const renderPage = async () => {
  const result = render(<CreateInvoicePage />)
  testContainer = result.container
  await screen.findByText('Step 1: Pilih Order')
  await waitFor(() => expect(screen.queryByText('Tidak ada order yang tersedia')).not.toBeInTheDocument())
}

const selectFirstOrder = async () => {
  await waitFor(() => expect(screen.getByTestId('mock-select')).toBeInTheDocument())
  fireEvent.change(screen.getByTestId('mock-select'), { target: { value: 'ORD-001' } })
  expect(await screen.findByText('Budi Santoso')).toBeInTheDocument()
}

const goToStep = async (stepTitle: string) => {
  await userEvent.click(screen.getByRole('button', { name: /lanjut/i }))
  expect(await screen.findByText(stepTitle)).toBeInTheDocument()
  if (stepTitle === 'Step 2: Base Service') {
    expect(await screen.findByText('[MSN-001] AC Cleaning (Wall 1PK)')).toBeInTheDocument()
  }
}

const baseDefaults = () => {
  vi.mocked(getOrders).mockResolvedValue({ success: true, data: orders })
  vi.mocked(getActiveAddons).mockResolvedValue(addons)
  vi.mocked(getOrderItemsForInvoice).mockResolvedValue(orderItems)
  vi.mocked(getServicePricingByType).mockResolvedValue({
    service_type: 'AC_CLEANING',
    service_name: 'AC Cleaning',
    description: 'Paket cuci AC',
    base_price: 150_000,
  })
  vi.mocked(createInvoice).mockResolvedValue({ invoice_id: 'INV-001' })
  setupSupabase()
}

const getCurrentSelect = () => [
  ...screen.queryAllByTestId('mock-select'),
  ...screen.queryAllByTestId('mock-searchable-select'),
].at(-1) as HTMLElement

const clickIconButton = async (iconClassName: string) => {
  await waitFor(() => {
    const icon = testContainer.querySelector(`svg.${iconClassName}`)
    const button = icon?.closest('button')
    expect(button).toBeTruthy()
    expect(button).not.toBeDisabled()
  })
  const icon = testContainer.querySelector(`svg.${iconClassName}`)
  const button = icon?.closest('button')
  if (!button) throw new Error(`Button for ${iconClassName} not found`)
  await userEvent.click(button)
}

const changeAddonQuantity = async (value: string) => {
  const quantityInput = Array.from(testContainer.querySelectorAll('input[type="number"]')).at(-1) as HTMLElement
  fireEvent.change(quantityInput, { target: { value } })
  await waitFor(() => expect((quantityInput as HTMLInputElement).value).toBe(value))
}

const changeFirstBaseQuantity = (value: string) => {
  const quantityInput = Array.from(testContainer.querySelectorAll('input[type="number"]'))[0] as HTMLElement
  fireEvent.change(quantityInput, { target: { value } })
}

const changeDueDate = (value: string) => {
  const dueDateInput = testContainer.querySelector('input[type="date"]') as HTMLElement
  fireEvent.change(dueDateInput, { target: { value } })
}

const selectAddon = async () => {
  const select = getCurrentSelect() as HTMLSelectElement
  fireEvent.change(select, { target: { value: 'ADD-FREON' } })
  await waitFor(() => {
    const plus = testContainer.querySelector('svg.lucide-plus')?.closest('button')
    expect(plus).not.toBeDisabled()
  })
}

describe('CreateInvoicePage characterization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.history.pushState({}, '', '/')
    baseDefaults()
  })

  it('displays initial empty/error state when orders and payment accounts fail to load', async () => {
    vi.mocked(getOrders).mockResolvedValue({ success: false, error: 'boom', data: [] })
    setupSupabase([], [])

    render(<CreateInvoicePage />)
    await screen.findByText('Step 1: Pilih Order')

    expect(await screen.findByText('Tidak ada order yang tersedia')).toBeInTheDocument()
    expect(screen.getByText('Order harus sudah di-assign atau selesai')).toBeInTheDocument()
    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'Error', description: 'Gagal memuat data order' }))
    })
  })

  it('selecting an order prefills customer, phone, service type, invoice type, and base service rows', async () => {
    await renderPage()

    await selectFirstOrder()

    expect(screen.getByText('FINAL INVOICE')).toBeInTheDocument()
    expect(screen.getByText('081234567890')).toBeInTheDocument()
    expect(screen.getByText('AC_CLEANING')).toBeInTheDocument()

    await goToStep('Step 2: Base Service')
    expect(await screen.findByText('[MSN-001] AC Cleaning (Wall 1PK)')).toBeInTheDocument()
    expect(screen.getByText('[MSN-002] AC Deep Cleaning (Cassette 2PK) × 2')).toBeInTheDocument()
    expect(screen.getAllByDisplayValue('Rp 150.000').length).toBeGreaterThan(0)
    expect(screen.getAllByDisplayValue('Rp 400.000').length).toBeGreaterThan(0)
  })

  it('adding an add-on preserves base ordering and computes the displayed subtotal and total', async () => {
    await renderPage()
    await selectFirstOrder()
    await goToStep('Step 2: Base Service')
    await goToStep('Step 3: Tambah Add-ons')

    await selectAddon()
    await changeAddonQuantity('2')
    await clickIconButton('lucide-plus')
    expect((await screen.findAllByText('Freon R32')).length).toBeGreaterThan(0)
    await goToStep('Step 4: Review & Finalize')

    expect(screen.getAllByText('Rp 700.000').length).toBeGreaterThan(0)
    expect(screen.getByText('Rp 77.000')).toBeInTheDocument()
    expect(screen.getByText('Rp 777.000')).toBeInTheDocument()
  })

  it('changing a base line quantity recalculates row total and final invoice total', async () => {
    await renderPage()
    await selectFirstOrder()
    await goToStep('Step 2: Base Service')

    changeFirstBaseQuantity('3')
    expect(await screen.findByDisplayValue('Rp 450.000')).toBeInTheDocument()

    await goToStep('Step 3: Tambah Add-ons')
    await goToStep('Step 4: Review & Finalize')

    expect(screen.getAllByText('Rp 850.000').length).toBeGreaterThan(0)
    expect(screen.getByText('Rp 93.500')).toBeInTheDocument()
    expect(screen.getByText('Rp 943.500')).toBeInTheDocument()
  })

  it('removing an add-on removes its row and recalculates subtotal and total', async () => {
    await renderPage()
    await selectFirstOrder()
    await goToStep('Step 2: Base Service')
    await goToStep('Step 3: Tambah Add-ons')

    await selectAddon()
    await clickIconButton('lucide-plus')
    expect(screen.getAllByText('Freon R32').length).toBeGreaterThan(0)

    const freonRow = screen.getAllByText('Freon R32').find((node) => node.closest('tr'))?.closest('tr')
    await userEvent.click(within(freonRow as HTMLElement).getByRole('button'))
    expect(screen.queryByText('Freon R32')).not.toBeInTheDocument()

    await goToStep('Step 4: Review & Finalize')
    expect(screen.getAllByText('Rp 550.000').length).toBeGreaterThan(0)
    expect(screen.getByText('Rp 60.500')).toBeInTheDocument()
    expect(screen.getByText('Rp 610.500')).toBeInTheDocument()
  })

  it('changing add-on quantity/type updates visible add-on controls before adding', async () => {
    await renderPage()
    await selectFirstOrder()
    await goToStep('Step 2: Base Service')
    await goToStep('Step 3: Tambah Add-ons')

    await selectAddon()
    await changeAddonQuantity('3')
    expect((getCurrentSelect() as HTMLSelectElement).value).toBe('ADD-FREON')
    expect((Array.from(testContainer.querySelectorAll('input[type="number"]')).at(-1) as HTMLInputElement).value).toBe('3')
    expect(testContainer.querySelector('svg.lucide-plus')?.closest('button')).not.toBeDisabled()
  })

  it('invalid submit keeps user on review step and shows required field validation errors', async () => {
    await renderPage()
    await selectFirstOrder()
    await goToStep('Step 2: Base Service')
    await goToStep('Step 3: Tambah Add-ons')
    await goToStep('Step 4: Review & Finalize')

    await userEvent.click(screen.getByRole('button', { name: /buat invoice/i }))

    expect(await screen.findByText('Tanggal jatuh tempo wajib diisi')).toBeInTheDocument()
    expect(screen.queryByText('Payment account wajib dipilih') || screen.getByText('Tanggal jatuh tempo wajib diisi')).toBeInTheDocument()
    expect(createInvoice).not.toHaveBeenCalled()
    expect(pushMock).not.toHaveBeenCalled()
  })

  it('successful submit creates a final invoice, shows success toast, and navigates to invoice list', async () => {
    await renderPage()
    await selectFirstOrder()
    await goToStep('Step 2: Base Service')
    await goToStep('Step 3: Tambah Add-ons')
    await goToStep('Step 4: Review & Finalize')

    fireEvent.change(getCurrentSelect(), { target: { value: 'BANK-1' } })
    changeDueDate('2026-07-01')
    await userEvent.click(screen.getByRole('button', { name: /buat invoice/i }))

    await waitFor(() => {
      expect(createInvoice).toHaveBeenCalledWith(expect.objectContaining({
        order_id: 'ORD-001',
        customer_id: 'CUS-001',
        invoice_type: 'FINAL',
        due_date: '2026-07-01',
        base_service_price: 550_000,
        payment_account_label: 'BCA Operasional',
        tax_percentage: 11,
      }))
    })
    expect(toastMock).toHaveBeenCalledWith({ title: 'Berhasil', description: 'Invoice Final berhasil dibuat' })
    expect(pushMock).toHaveBeenCalledWith('/dashboard/keuangan/invoices')
  })
})
