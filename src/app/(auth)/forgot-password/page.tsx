'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { Loader2 } from 'lucide-react'
import { LoadingOverlay } from '@/components/ui/loading-state'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [fieldError, setFieldError] = useState<string | undefined>()
  const [touched, setTouched] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const { toast } = useToast()

  const validateEmail = (value: string): string | undefined => {
    if (!value) return 'Email wajib diisi'
    if (!value.includes('@')) return 'Masukkan alamat email yang valid'
    return undefined
  }

  const handleBlur = () => {
    setTouched(true)
    setFieldError(validateEmail(email))
  }

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()

    setTouched(true)
    const emailError = validateEmail(email)
    setFieldError(emailError)

    if (emailError) {
      return
    }

    setIsLoading(true)

    try {
      const supabase = createClient()
      
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      })

      if (error) {
        logger.error('Supabase auth reset password error:', error)
      }

      // Always show success message, regardless of whether account exists or there was an error
      setIsSuccess(true)
      toast({
        title: "Terkirim",
        description: "Jika akun dengan email tersebut ada, instruksi reset kata sandi telah dikirim.",
      })

    } catch (error: unknown) {
      logger.error('Reset password error:', error)
      // Display neutral message even on catch
      setIsSuccess(true)
      toast({
        title: "Terkirim",
        description: "Jika akun dengan email tersebut ada, instruksi reset kata sandi telah dikirim.",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-muted flex flex-col items-center justify-center p-4 sm:p-8">
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
            Lupa Kata Sandi
          </h1>
          <p className="text-muted-foreground font-medium">
            Masukkan email Anda untuk mereset kata sandi
          </p>
        </div>

        <LoadingOverlay isLoading={isLoading} message="Memproses...">
          <Card className="border-border shadow-sm">
            <CardHeader className="space-y-1 pb-4 text-center">
              <CardDescription className="text-muted-foreground text-sm font-medium">
                Reset Kata Sandi
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isSuccess ? (
                <div className="space-y-4 text-center">
                  <div className="p-4 bg-primary/10 text-primary rounded-md border border-primary/20">
                    <p className="text-sm font-medium">Jika akun dengan email tersebut ada, instruksi reset kata sandi telah dikirim.</p>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full mt-4"
                    asChild
                  >
                    <Link href="/login">Kembali ke halaman Masuk</Link>
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleReset} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value)
                        if (touched) {
                          setFieldError(validateEmail(e.target.value))
                        }
                      }}
                      onBlur={handleBlur}
                      aria-invalid={!!fieldError}
                      aria-describedby={fieldError ? 'email-error' : undefined}
                      disabled={isLoading}
                    />
                    {touched && fieldError && (
                      <p id="email-error" className="text-xs text-destructive mt-1 font-medium">{fieldError}</p>
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
                        Mengirim...
                      </>
                    ) : (
                      'Kirim Instruksi Reset'
                    )}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>

          {!isSuccess && (
            <p className="mt-6 text-center">
              <Link
                href="/login"
                className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
              >
                Kembali ke halaman Masuk
              </Link>
            </p>
          )}
        </LoadingOverlay>
      </div>
    </div>
  )
}
