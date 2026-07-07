'use client'

import { SignIn, useClerk } from '@clerk/nextjs'
import { useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { ShieldAlert } from 'lucide-react'

export default function SignInPage() {
  const searchParams = useSearchParams()
  const { signOut } = useClerk()
  const didSignOut = useRef(false)

  const isUnauthorized = searchParams.get('unauthorized') === '1'

  // If redirected here because user isn't in user_management,
  // clear the orphaned Clerk session so they can start fresh.
  useEffect(() => {
    if (isUnauthorized && !didSignOut.current) {
      didSignOut.current = true
      signOut({ redirectUrl: '/sign-in' })
    }
  }, [isUnauthorized, signOut])

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-4">
        {isUnauthorized && (
          <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
            <ShieldAlert className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-destructive">Akses Ditolak</p>
              <p className="text-xs text-muted-foreground mt-1">
                Akun Anda belum terdaftar di sistem. Hubungi administrator untuk mendapatkan akses.
              </p>
            </div>
          </div>
        )}
        <SignIn />
      </div>
    </div>
  )
}
