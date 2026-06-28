'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ChevronRight, Lightbulb, Moon, Sun, User } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useUser, useAuth } from '@clerk/nextjs'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { getMyUserProfile } from '@/lib/actions/my-profile'

export function DarkModeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  if (!mounted) return <Switch checked={false} disabled />

  return <Switch checked={theme === 'dark'} onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')} />
}

export function ProfileSection() {
  const [dbProfile, setDbProfile] = useState<{ full_name: string; role: string; photo_url?: string | null } | null>(null)
  const [isOpen, setIsOpen] = useState(false)

  const { user } = useUser()
  const { signOut } = useAuth()

  useEffect(() => {
    if (!user) return
    getMyUserProfile()
      .then((data) => {
        if (data) {
          setDbProfile({
            full_name: data.full_name,
            role: data.role,
            photo_url: data.photo_url,
          })
        }
      })
      .catch(() => {})
  }, [user])

  const handleLogout = async () => {
    await signOut()
    window.location.href = '/login'
  }

  if (!user) return null

  const email = user.primaryEmailAddress?.emailAddress ?? ''
  const fullName = dbProfile?.full_name || user.fullName || email
  const role = dbProfile?.role || 'USER'
  const avatarUrl = dbProfile?.photo_url || user.imageUrl || null

  return (
    <div className="bg-surface-muted p-4 space-y-3">
      <div className="flex items-center justify-between px-2 py-1">
        <div className="flex items-center gap-2 relative">
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="text-sm font-medium">Dark Mode</span>
        </div>
        <DarkModeToggle />
      </div>

      <div className="relative">
        <button onClick={() => setIsOpen(!isOpen)} className="flex items-center gap-3 w-full rounded-lg p-2 hover:bg-background transition-colors duration-150">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-medium text-sm">
            {avatarUrl ? <Image src={avatarUrl} alt="Profile" className="w-8 h-8 rounded-full object-cover" width={32} height={32} /> : fullName?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div className="flex-1 text-left">
            <div className="text-sm font-medium truncate">{fullName}</div>
            <div className="text-xs text-muted-foreground truncate">{email}</div>
          </div>
          <ChevronRight className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-90')} />
        </button>

        {isOpen && <ProfileMenu onClose={() => setIsOpen(false)} onLogout={handleLogout} />}
      </div>
    </div>
  )
}

function ProfileMenu({ onClose, onLogout }: { onClose: () => void; onLogout: () => void }) {
  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 bg-background border border-border rounded-xl shadow-lg py-2">
      <Link href="/dashboard/profile" className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-surface-muted transition-colors" onClick={onClose}>
        <User className="h-4 w-4" />
        Profile Settings
      </Link>
      <button
        onClick={() => {
          localStorage.removeItem('msn-erp-dashboard-onboarded')
          onClose()
          window.location.href = '/dashboard'
        }}
        className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-surface-muted transition-colors w-full text-left"
      >
        <Lightbulb className="h-4 w-4" />
        Tampilkan Panduan
      </button>
      <button onClick={onLogout} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-surface-muted transition-colors w-full text-left text-destructive hover:text-destructive">
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
        Logout
      </button>
    </div>
  )
}
