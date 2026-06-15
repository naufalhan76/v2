'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { CheckCircle, Loader2, XCircle } from 'lucide-react'

function ConfirmPageContent() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  useEffect(() => {
    const confirmEmail = async () => {
      try {
        const supabase = createClient()
        const token_hash = searchParams.get('token_hash')
        const type = searchParams.get('type')
        
        if (!token_hash || !type) {
          setStatus('error')
          setMessage('Invalid confirmation link')
          return
        }

        const { error } = await supabase.auth.verifyOtp({
          token_hash,
          type: type as 'email',
        })

        if (error) {
          setStatus('error')
          setMessage('Tautan tidak valid atau telah kedaluwarsa. Silakan coba lagi.')
          return
        }

        setStatus('success')
        setMessage('Your email has been successfully confirmed!')
        
        toast({
          title: "Email confirmed",
          description: "Your account has been verified. You can now log in.",
        })
        
        // Redirect to login after 3 seconds
        setTimeout(() => {
          router.push('/login')
        }, 3000)
      } catch (error: unknown) {
        setStatus('error')
        setMessage('Tautan tidak valid atau telah kedaluwarsa. Silakan coba lagi.')
      }
    }

    confirmEmail()
  }, [searchParams, router, toast])

  return (
    <div className="flex min-h-screen items-center justify-center bg-background dark:bg-background px-4">
      <Card className="w-full max-w-md bg-white !rounded-xl shadow-lg border-0">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-6">
            {status === 'loading' && <Loader2 className="h-12 w-12 text-primary animate-spin" />}
            {status === 'success' && <CheckCircle className="h-12 w-12 text-status-completed" />}
            {status === 'error' && <XCircle className="h-12 w-12 text-destructive" />}
          </div>
          <CardTitle
            className="text-[28px] leading-tight"
            style={{ fontVariationSettings: "'wght' 540" }}
          >
            {status === 'loading' && 'Mengonfirmasi Email'}
            {status === 'success' && 'Email Terkonfirmasi!'}
            {status === 'error' && 'Konfirmasi Gagal'}
          </CardTitle>
          <CardDescription
            className="text-lg mt-2 text-muted-foreground"
            style={{ fontVariationSettings: "'wght' 460" }}
          >
            {status === 'loading' && 'Mohon tunggu, kami sedang memverifikasi alamat email Anda...'}
            {status === 'success' && 'Alamat email Anda telah berhasil diverifikasi.'}
            {status === 'error' && message}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          {status === 'success' && (
            <p className="text-base text-muted-foreground mb-4">
              Anda akan dialihkan ke halaman masuk dalam beberapa saat...
            </p>
          )}
          {status === 'error' && (
            <div className="space-y-4">
              <p className="text-base text-muted-foreground">
                Silakan coba lagi atau hubungi dukungan jika masalah berlanjut.
              </p>
              <Button
                onClick={() => router.push('/login')}
                className="w-full"
              >
                Kembali ke Halaman Masuk
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function ConfirmPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-background dark:bg-background px-4">
        <Card className="w-full max-w-md bg-white !rounded-xl shadow-lg border-0">
          <CardHeader className="text-center pb-2">
            <div className="flex justify-center mb-6">
              <Loader2 className="h-12 w-12 text-primary animate-spin" />
            </div>
            <CardTitle
              className="text-[28px] leading-tight"
              style={{ fontVariationSettings: "'wght' 540" }}
            >
              Memuat...
            </CardTitle>
          </CardHeader>
        </Card>
      </div>
    }>
      <ConfirmPageContent />
    </Suspense>
  )
}
