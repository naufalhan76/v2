// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import ResetPasswordPage from './page'

// Mock dependencies
const mockPush = vi.fn()
const mockToast = vi.fn()
const mockUpdateUser = vi.fn()
const mockGetSession = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}))

vi.mock('@/lib/supabase-browser', () => ({
  createClient: () => ({
    auth: {
      updateUser: mockUpdateUser,
      getSession: mockGetSession,
    },
  }),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
  },
}))

describe('Reset Password Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null })
  })

  it('rejects short passwords (< 8 chars) before calling Supabase', async () => {
    render(<ResetPasswordPage />)

    const passwordInput = screen.getByLabelText(/^Kata Sandi Baru$/i)
    const confirmInput = screen.getByLabelText(/^Konfirmasi Kata Sandi Baru$/i)
    const submitButton = screen.getByRole('button', { name: /Simpan Kata Sandi/i })

    fireEvent.change(passwordInput, { target: { value: 'short' } })
    fireEvent.change(confirmInput, { target: { value: 'short' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('Kata sandi minimal 8 karakter')).toBeInTheDocument()
      expect(mockUpdateUser).not.toHaveBeenCalled()
    })
  })

  it('rejects mismatched passwords before calling Supabase', async () => {
    render(<ResetPasswordPage />)

    const passwordInput = screen.getByLabelText(/^Kata Sandi Baru$/i)
    const confirmInput = screen.getByLabelText(/^Konfirmasi Kata Sandi Baru$/i)
    const submitButton = screen.getByRole('button', { name: /Simpan Kata Sandi/i })

    fireEvent.change(passwordInput, { target: { value: 'password123' } })
    fireEvent.change(confirmInput, { target: { value: 'password456' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('Kata sandi tidak cocok')).toBeInTheDocument()
      expect(mockUpdateUser).not.toHaveBeenCalled()
    })
  })

  it('calls Supabase updateUser when validation passes', async () => {
    mockUpdateUser.mockResolvedValueOnce({ data: {}, error: null })
    
    render(<ResetPasswordPage />)

    const passwordInput = screen.getByLabelText(/^Kata Sandi Baru$/i)
    const confirmInput = screen.getByLabelText(/^Konfirmasi Kata Sandi Baru$/i)
    const submitButton = screen.getByRole('button', { name: /Simpan Kata Sandi/i })

    fireEvent.change(passwordInput, { target: { value: 'validPassword123' } })
    fireEvent.change(confirmInput, { target: { value: 'validPassword123' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'validPassword123' })
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
        title: "Berhasil"
      }))
      expect(mockPush).toHaveBeenCalledWith('/login')
    })
  })
})
