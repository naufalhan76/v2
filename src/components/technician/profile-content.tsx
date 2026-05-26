'use client'

import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { User, Phone, Mail, Bell, LogOut, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { createClient } from '@/lib/supabase-browser'
import { useState } from 'react'

async function fetchProfile() {
  const supabase = createClient()

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')

  // Get technician profile
  const { data: technician, error } = await supabase
    .from('technicians')
    .select('technician_id, technician_name, contact_number, email, specialization, company')
    .eq('auth_user_id', user.id)
    .single()

  if (error) throw new Error('Gagal memuat profil')

  return { user, technician }
}

export function ProfileContent() {
  const router = useRouter()
  const [pushEnabled, setPushEnabled] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['technician', 'profile'],
    queryFn: fetchProfile,
    staleTime: 5 * 60_000, // 5 minutes
  })

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
      router.push('/login')
    } catch {
      setLoggingOut(false)
    }
  }

  const handlePushToggle = (checked: boolean) => {
    // Placeholder — Phase 4 will wire this to push subscription API
    setPushEnabled(checked)
  }

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <div className="h-6 w-40 rounded bg-muted" />
          <div className="h-4 w-32 rounded bg-muted" />
          <div className="h-4 w-48 rounded bg-muted" />
        </div>
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-muted-foreground">Gagal memuat profil</p>
      </div>
    )
  }

  const { technician } = data

  return (
    <div className="space-y-4">
      {/* Profile info card */}
      <div className="rounded-xl border bg-card p-4 space-y-4">
        {/* Avatar + name */}
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <User className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold text-base">{technician.technician_name}</h2>
            {technician.specialization && (
              <p className="text-xs text-muted-foreground">{technician.specialization}</p>
            )}
          </div>
        </div>

        {/* Contact details */}
        <div className="space-y-2 pt-2 border-t">
          {technician.contact_number && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
              <span>{technician.contact_number}</span>
            </div>
          )}
          {technician.email && (
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
              <span>{technician.email}</span>
            </div>
          )}
          {technician.company && (
            <div className="flex items-center gap-2 text-sm">
              <Info className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
              <span>{technician.company}</span>
            </div>
          )}
        </div>
      </div>

      {/* Settings card */}
      <div className="rounded-xl border bg-card p-4 space-y-4">
        <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
          Pengaturan
        </h3>

        {/* Push notification toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium">Notifikasi Push</p>
              <p className="text-xs text-muted-foreground">
                Terima notifikasi saat ada job baru
              </p>
            </div>
          </div>
          <Switch
            checked={pushEnabled}
            onCheckedChange={handlePushToggle}
            aria-label="Toggle notifikasi push"
          />
        </div>
      </div>

      {/* Logout */}
      <Button
        variant="outline"
        onClick={handleLogout}
        disabled={loggingOut}
        className="w-full h-11 text-destructive hover:text-destructive hover:bg-destructive/10"
      >
        <LogOut className="mr-2 h-4 w-4" />
        {loggingOut ? 'Keluar...' : 'Keluar'}
      </Button>

      {/* App version */}
      <p className="text-center text-xs text-muted-foreground pt-4">
        MSN Tech v2.0.0-beta
      </p>
    </div>
  )
}
