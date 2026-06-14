'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { Eye, EyeOff, Loader2, Mail, Lock } from 'lucide-react'
import { LoadingOverlay } from '@/components/ui/loading-state'
import { logger } from '@/lib/logger'

interface LoginFormProps {
  showPassword: boolean
  onTogglePassword: () => void
}

export function LoginForm({ showPassword, onTogglePassword }: LoginFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({})
  const [touched, setTouched] = useState<{ email?: boolean; password?: boolean }>({})
  const [isLoading, setIsLoading] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') || '/dashboard'
  const { toast } = useToast()

  const validateEmail = (value: string): string | undefined => {
    if (!value) return 'Email wajib diisi'
    if (!value.includes('@')) return 'Masukkan alamat email yang valid'
    return undefined
  }

  const validatePassword = (value: string): string | undefined => {
    if (!value) return 'Kata sandi wajib diisi'
    if (value.length < 6) return 'Kata sandi minimal 6 karakter'
    return undefined
  }

  const handleBlur = (field: 'email' | 'password') => {
    setTouched(prev => ({ ...prev, [field]: true }))
    if (field === 'email') setFieldErrors(prev => ({ ...prev, email: validateEmail(email) }))
    else setFieldErrors(prev => ({ ...prev, password: validatePassword(password) }))
  }

  useEffect(() => { setIsLoading(false); setLoadingMessage('') }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setTouched({ email: true, password: true })
    const emailError = validateEmail(email)
    const passwordError = validatePassword(password)
    setFieldErrors({ email: emailError, password: passwordError })
    if (emailError || passwordError) return

    setIsLoading(true)
    setLoadingMessage('Mengautentikasi...')
    try {
      const supabase = createClient()
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) {
        logger.error('Supabase auth error:', error)
        if (error.message.includes('Invalid login credentials')) throw new Error('Email atau kata sandi salah')
        if (error.message.includes('Email not confirmed')) throw new Error('Verifikasi email terlebih dahulu sebelum masuk.')
        throw new Error('Gagal masuk. Periksa kembali kredensial Anda atau coba lagi nanti.')
      }
      setLoadingMessage('Memverifikasi izin...')
      const { data: userData, error: userError } = await supabase
        .from('user_management')
        .select('role, email, full_name')
        .eq('auth_user_id', data.user?.id)
        .single()
      if (userError) {
        logger.error('Error fetching user role:', userError)
        if (userError.code === 'PGRST116') throw new Error('Pengguna tidak ditemukan. Hubungi administrator untuk menyiapkan akun Anda.')
        throw new Error('Gagal mengambil izin pengguna. Silakan coba lagi.')
      }
      if (!userData) throw new Error('Pengguna tidak ditemukan. Hubungi administrator untuk menyiapkan akun Anda.')
      if (!['SUPERADMIN', 'ADMIN', 'FINANCE', 'TECHNICIAN'].includes(userData.role)) throw new Error('Peran pengguna tidak valid. Hubungi administrator.')

      let targetRoute = redirectTo
      if (userData.role === 'TECHNICIAN') targetRoute = '/technician'
      else if (!redirectTo || redirectTo === '/dashboard') targetRoute = '/dashboard'

      setLoadingMessage('Berhasil masuk! Memuat...')
      toast({ title: "Berhasil masuk", description: `Selamat datang kembali, ${userData.full_name || userData.role}!` })
      router.refresh()
      await new Promise(resolve => setTimeout(resolve, 500))
      router.push(targetRoute)
    } catch (error: unknown) {
      logger.error('Login error:', error)
      setLoadingMessage('')
      setIsLoading(false)
      toast({ title: "Gagal masuk", description: error instanceof Error ? error.message : "Terjadi kesalahan saat masuk", variant: "destructive" })
    }
  }

  return (
    <LoadingOverlay isLoading={isLoading} message={loadingMessage || 'Memuat...'} fullscreen>
      <div className="min-h-screen bg-canvas-soft flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-6xl md:h-[700px] flex flex-col md:flex-row bg-card border-hairline shadow-lg rounded-2xl overflow-hidden">
          <div className="relative w-full md:w-1/2 h-48 sm:h-64 md:h-full flex-shrink-0 animate-in fade-in slide-in-from-left-4 duration-700 ease-out">
            <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: 'url("https://pasteimg.com/images/2026/06/10/imageaa28b3b8097f142f.png")' }} />
            <div className="absolute inset-0 bg-black/20" />
            <div className="absolute top-6 left-6 md:top-8 md:left-8 z-10">
              <img src="/logo-msn.svg?v=20260610-newlogo" alt="MSN ERP" className="h-auto w-32 md:w-40 drop-shadow-md brightness-0 invert" />
            </div>
          </div>
          <div className="w-full md:w-1/2 p-6 sm:p-10 md:p-16 flex flex-col justify-center animate-in fade-in slide-in-from-right-4 duration-700 ease-out">
            <div className="w-full max-w-md mx-auto space-y-8">
              <div className="space-y-2">
                <h1 className="text-3xl md:text-4xl font-light tracking-tight text-foreground">Kelola pesanan, teknisi, dan faktur</h1>
                <p className="text-muted-foreground font-medium text-lg">Selamat datang kembali</p>
              </div>
              <form onSubmit={handleLogin} aria-label="Login form" className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="sr-only">Email</Label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"><Mail className="h-5 w-5" /></div>
                    <Input id="email" type="email" placeholder="Email" value={email}
                      onChange={(e) => { setEmail(e.target.value); if (touched.email) setFieldErrors(prev => ({ ...prev, email: validateEmail(e.target.value) })) }}
                      onBlur={() => handleBlur('email')} aria-invalid={!!fieldErrors.email} aria-describedby={fieldErrors.email ? 'email-error' : undefined}
                      disabled={isLoading} className="pl-10 h-12 rounded-xl bg-background border-input focus:ring-ring" />
                  </div>
                  {touched.email && fieldErrors.email && <p id="email-error" className="text-xs text-destructive font-medium">{fieldErrors.email}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="sr-only">Kata Sandi</Label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"><Lock className="h-5 w-5" /></div>
                    <Input id="password" type={showPassword ? "text" : "password"} placeholder="Kata Sandi" value={password}
                      onChange={(e) => { setPassword(e.target.value); if (touched.password) setFieldErrors(prev => ({ ...prev, password: validatePassword(e.target.value) })) }}
                      onBlur={() => handleBlur('password')} aria-invalid={!!fieldErrors.password} aria-describedby={fieldErrors.password ? 'password-error' : undefined}
                      className="pl-10 pr-10 h-12 rounded-xl bg-background border-input focus:ring-ring" disabled={isLoading} />
                    <button type="button" onClick={onTogglePassword} disabled={isLoading}
                      aria-label="Toggle password visibility"
                      className="absolute right-3 top-1/2 -translate-y-1/2 z-10 cursor-pointer text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  {touched.password && fieldErrors.password && <p id="password-error" className="text-xs text-destructive font-medium">{fieldErrors.password}</p>}
                </div>
                <Button type="submit" size="lg" className="w-full h-12 mt-2 rounded-full bg-primary text-primary-foreground font-semibold hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 shadow-md" disabled={isLoading}>
                  {isLoading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Sedang masuk...</> : 'Masuk'}
                </Button>
              </form>
              <div className="text-center pt-2">
                <a href="/forgot-password" className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors">Lupa kata sandi?</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </LoadingOverlay>
  )
}
