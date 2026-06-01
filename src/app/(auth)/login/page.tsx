'use client'

import Image from 'next/image'
import { useState, Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { LoadingOverlay } from '@/components/ui/loading-state'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({})
  const [touched, setTouched] = useState<{ email?: boolean; password?: boolean }>({})
  const [isLoading, setIsLoading] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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
    if (field === 'email') {
      setFieldErrors(prev => ({ ...prev, email: validateEmail(email) }))
    } else {
      setFieldErrors(prev => ({ ...prev, password: validatePassword(password) }))
    }
  }

  useEffect(() => {
    setIsLoading(false)
    setLoadingMessage('')
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()

    setTouched({ email: true, password: true })
    const emailError = validateEmail(email)
    const passwordError = validatePassword(password)
    setFieldErrors({ email: emailError, password: passwordError })

    if (emailError || passwordError) {
      return
    }

    setIsLoading(true)
        setLoadingMessage('Mengautentikasi...')

    try {
      const supabase = createClient()
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (error) {
        logger.error('Supabase auth error:', error)
        
        // Better error messages
        if (error.message.includes('Invalid login credentials')) {
          throw new Error('Email atau kata sandi salah')
        }
        if (error.message.includes('Email not confirmed')) {
          throw new Error('Verifikasi email terlebih dahulu sebelum masuk')
        }
        
        throw error
      }

      setLoadingMessage('Memverifikasi izin...')

      const { data: userData, error: userError } = await supabase
        .from('user_management')
        .select('role, email, full_name')
        .eq('auth_user_id', data.user?.id)
        .single()

      if (userError) {
        logger.error('Error fetching user role:', userError)
        logger.error('User ID:', data.user?.id)
        logger.error('User Email:', data.user?.email)
        
        // More helpful error message
        if (userError.code === 'PGRST116') {
          throw new Error('Pengguna tidak ditemukan. Hubungi administrator untuk menyiapkan akun Anda.')
        }
        
        throw new Error(`Gagal mengambil izin pengguna: ${userError.message}`)
      }

      if (!userData) {
        throw new Error('Pengguna tidak ditemukan. Hubungi administrator untuk menyiapkan akun Anda.')
      }

      if (!['SUPERADMIN', 'ADMIN', 'FINANCE', 'TECHNICIAN'].includes(userData.role)) {
        throw new Error('Peran pengguna tidak valid. Hubungi administrator.')
      }

      let targetRoute = redirectTo
      if (userData.role === 'TECHNICIAN') {
        targetRoute = '/technician'
      } else if (!redirectTo || redirectTo === '/dashboard') {
        targetRoute = '/dashboard'
      }

      setLoadingMessage('Berhasil masuk! Memuat...')

      toast({
        title: "Berhasil masuk",
        description: `Selamat datang kembali, ${userData.full_name || userData.role}!`,
      })

      router.refresh()
      
      // Small delay to ensure cookie is set and show success message
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Then redirect - loading state akan tetap sampai page benar-benar pindah
      router.push(targetRoute)
      
      // Keep loading state active - akan hilang saat component unmount
      // Ini memastikan overlay tetap ada sampai dashboard selesai load
    } catch (error: unknown) {
      logger.error('Login error:', error)
      setLoadingMessage('')
      setIsLoading(false)
        toast({
          title: "Gagal masuk",
          description: error instanceof Error ? error.message : "Terjadi kesalahan saat masuk",
          variant: "destructive"
        })
    }
    // Note: Don't set isLoading to false in finally block
    // Let it stay true until page navigation completes
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <LoadingOverlay
        isLoading={isLoading}
        message={loadingMessage || 'Memuat...'}
        className="w-full max-w-md"
      >
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-4">
            <div className="flex justify-center py-4">
              <Image
                src="/logo.png"
                alt="MSN ERP"
                width={96}
                height={96}
                className="h-24 w-auto"
              />
            </div>
            <CardDescription className="text-center">
              Masuk ke MSN ERP
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (touched.email) {
                      setFieldErrors(prev => ({ ...prev, email: validateEmail(e.target.value) }))
                    }
                  }}
                  onBlur={() => handleBlur('email')}
                  aria-invalid={!!fieldErrors.email}
                  aria-describedby={fieldErrors.email ? 'email-error' : undefined}
                  disabled={isLoading}
                />
                {touched.email && fieldErrors.email && (
                  <p id="email-error" className="text-xs text-destructive mt-1">{fieldErrors.email}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Kata Sandi</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      if (touched.password) {
                        setFieldErrors(prev => ({ ...prev, password: validatePassword(e.target.value) }))
                      }
                    }}
                    onBlur={() => handleBlur('password')}
                    aria-invalid={!!fieldErrors.password}
                    aria-describedby={fieldErrors.password ? 'password-error' : undefined}
                    className="pr-10"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isLoading}
                    className="absolute right-3 top-1/2 -translate-y-1/2 z-10 cursor-pointer text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {touched.password && fieldErrors.password && (
                  <p id="password-error" className="text-xs text-destructive mt-1">{fieldErrors.password}</p>
                )}
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sedang masuk...
                  </>
                ) : (
                  'Masuk'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </LoadingOverlay>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="mt-4 text-muted-foreground">Memuat...</p>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
