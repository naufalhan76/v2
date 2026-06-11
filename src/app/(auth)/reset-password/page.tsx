'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState, Suspense, useEffect } from 'react'
import { useRouter } from 'next/navigation'
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

function ResetPasswordForm() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{ password?: string; confirmPassword?: string }>({})
  const [touched, setTouched] = useState<{ password?: boolean; confirmPassword?: boolean }>({})
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  // Ensure this runs only if it's a valid recovery flow
  useEffect(() => {
    // If not a hash recovery url or no active session after clicking the email link,
    // Supabase usually sets the session from the URL automatically on load.
    const checkSession = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      // If there's no session and the URL doesn't have a hash with a recovery token,
      // it might not be a valid recovery scenario.
      // But we just let the component render and allow them to attempt to set the password.
      // If `updateUser` fails, it fails gracefully.
    }
    
    checkSession()
  }, [])

  const validatePassword = (value: string): string | undefined => {
    if (!value) return 'Kata sandi wajib diisi'
    if (value.length < 8) return 'Kata sandi minimal 8 karakter'
    return undefined
  }

  const validateConfirmPassword = (confirmVal: string, passVal: string): string | undefined => {
    if (!confirmVal) return 'Konfirmasi kata sandi wajib diisi'
    if (confirmVal !== passVal) return 'Kata sandi tidak cocok'
    return undefined
  }

  const handleBlur = (field: 'password' | 'confirmPassword') => {
    setTouched(prev => ({ ...prev, [field]: true }))
    if (field === 'password') {
      setFieldErrors(prev => ({ 
        ...prev, 
        password: validatePassword(password),
        // Re-validate confirm password if it's already touched
        ...(touched.confirmPassword && { confirmPassword: validateConfirmPassword(confirmPassword, password) })
      }))
    } else {
      setFieldErrors(prev => ({ ...prev, confirmPassword: validateConfirmPassword(confirmPassword, password) }))
    }
  }

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()

    setTouched({ password: true, confirmPassword: true })
    const passwordError = validatePassword(password)
    const confirmError = validateConfirmPassword(confirmPassword, password)
    
    setFieldErrors({ password: passwordError, confirmPassword: confirmError })

    if (passwordError || confirmError) {
      return
    }

    setIsLoading(true)

    try {
      const supabase = createClient()

      // The user is authenticated at this point if they clicked the email link
      const { error } = await supabase.auth.updateUser({
        password: password
      })

      if (error) {
        logger.error('Supabase auth update user error:', error)
        if (error.name === 'AuthApiError' && error.message.toLowerCase().includes('expired')) {
          throw new Error('Tautan reset kata sandi telah kedaluwarsa. Silakan minta tautan baru di halaman lupa kata sandi.')
        }
        throw new Error('Tautan reset kata sandi tidak valid atau telah kedaluwarsa.')
      }

      toast({
        title: "Berhasil",
        description: "Kata sandi Anda telah berhasil diperbarui.",
      })

      router.push('/login')
      
    } catch (error: unknown) {
      logger.error('Reset password error:', error)
      toast({
        title: "Gagal mereset kata sandi",
        description: (
          <div className="flex flex-col gap-2 mt-1">
            <p>{error instanceof Error ? error.message : "Terjadi kesalahan saat mereset kata sandi."}</p>
            <Button variant="outline" size="sm" asChild className="w-fit mt-1">
              <Link href="/forgot-password">Minta Tautan Baru</Link>
            </Button>
          </div>
        ),
        variant: "destructive"
      })
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-canvas-soft flex flex-col items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
            <Image
              src="/logo-msn.svg?v=20260610-newlogo"
              alt="MSN ERP"
              width={240}
              height={94}
              className="h-auto w-48 sm:w-56 mx-auto"
              priority
            />
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground mt-6">
            Buat Kata Sandi Baru
          </h1>
          <p className="text-muted-foreground font-medium">
            Masukkan kata sandi baru untuk akun Anda
          </p>
        </div>

        <LoadingOverlay isLoading={isLoading} message="Memperbarui...">
          <Card className="border-hairline shadow-sm">
            <CardHeader className="space-y-1 pb-4 text-center">
              <CardDescription className="text-muted-foreground text-sm font-medium">
                Reset Kata Sandi
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleReset} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Kata Sandi Baru</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value)
                        if (touched.password) {
                          setFieldErrors(prev => ({ 
                            ...prev, 
                            password: validatePassword(e.target.value),
                            ...(touched.confirmPassword && { confirmPassword: validateConfirmPassword(confirmPassword, e.target.value) })
                          }))
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
                    <p id="password-error" className="text-xs text-destructive mt-1 font-medium">{fieldErrors.password}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Konfirmasi Kata Sandi Baru</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value)
                        if (touched.confirmPassword) {
                          setFieldErrors(prev => ({ ...prev, confirmPassword: validateConfirmPassword(e.target.value, password) }))
                        }
                      }}
                      onBlur={() => handleBlur('confirmPassword')}
                      aria-invalid={!!fieldErrors.confirmPassword}
                      aria-describedby={fieldErrors.confirmPassword ? 'confirmPassword-error' : undefined}
                      className="pr-10"
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      disabled={isLoading}
                      className="absolute right-3 top-1/2 -translate-y-1/2 z-10 cursor-pointer text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {touched.confirmPassword && fieldErrors.confirmPassword && (
                    <p id="confirmPassword-error" className="text-xs text-destructive mt-1 font-medium">{fieldErrors.confirmPassword}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  size="lg"
                  className="w-full mt-2"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Memperbarui...
                    </>
                  ) : (
                    'Simpan Kata Sandi'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          <p className="mt-6 text-center">
            <Link
              href="/login"
              className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
            >
              Kembali ke halaman Masuk
            </Link>
          </p>
        </LoadingOverlay>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-canvas-soft flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground font-medium">Memuat...</p>
        </div>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  )
}
