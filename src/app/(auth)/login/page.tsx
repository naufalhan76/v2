'use client'

import { Suspense, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { LoginForm } from './_components/login-form'

export const dynamic = 'force-dynamic'

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  return (
    <main>
      <Suspense fallback={
        <div className="min-h-screen bg-surface-muted flex items-center justify-center p-4">
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
            <p className="text-muted-foreground font-medium">Memuat...</p>
          </div>
        </div>
      }>
        <LoginForm showPassword={showPassword} onTogglePassword={() => setShowPassword(!showPassword)} />
      </Suspense>
    </main>
  )
}
