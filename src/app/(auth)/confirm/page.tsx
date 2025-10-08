'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { CheckCircle, Loader2 } from 'lucide-react'

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
          setMessage(error.message || 'Email confirmation failed')
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
      } catch (error: any) {
        setStatus('error')
        setMessage(error.message || 'An error occurred during email confirmation')
      }
    }

    confirmEmail()
  }, [searchParams, router, toast])

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            {status === 'loading' && <Loader2 className="h-12 w-12 text-blue-600 animate-spin" />}
            {status === 'success' && <CheckCircle className="h-12 w-12 text-green-600" />}
            {status === 'error' && <CheckCircle className="h-12 w-12 text-red-600" />}
          </div>
          <CardTitle className="text-2xl font-bold">
            {status === 'loading' && 'Confirming Your Email'}
            {status === 'success' && 'Email Confirmed!'}
            {status === 'error' && 'Confirmation Failed'}
          </CardTitle>
          <CardDescription>
            {status === 'loading' && 'Please wait while we verify your email address...'}
            {status === 'success' && 'Your email has been successfully verified.'}
            {status === 'error' && message}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          {status === 'success' && (
            <p className="text-sm text-muted-foreground mb-4">
              You will be redirected to the login page in a few seconds...
            </p>
          )}
          {status === 'error' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Please try again or contact support if the problem persists.
              </p>
              <Button 
                onClick={() => router.push('/login')}
                className="w-full"
              >
                Back to Login
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
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <Loader2 className="h-12 w-12 text-blue-600 animate-spin" />
            </div>
            <CardTitle className="text-2xl font-bold">Loading...</CardTitle>
          </CardHeader>
        </Card>
      </div>
    }>
      <ConfirmPageContent />
    </Suspense>
  )
}