'use client'

import { useEffect, useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { User, Phone, Mail, Bell, BellOff, LogOut, Info, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { createClient } from '@/lib/supabase-browser'
import {
  getPushSupport,
  getPermissionState,
  getPushSubscription,
  subscribeToPush,
  unsubscribeFromPush,
  serializeSubscription,
  type PushPermissionState,
} from '@/lib/push'

async function fetchProfile() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: technician, error } = await supabase
    .from('technicians')
    .select('technician_id, technician_name, contact_number, email, specialization, company')
    .eq('auth_user_id', user.id)
    .single()
  if (error) throw new Error('Gagal memuat profil')

  return { user, technician }
}

type PushUiState =
  | { kind: 'loading' }
  | { kind: 'unsupported' }
  | { kind: 'denied' }
  | { kind: 'enabled' }
  | { kind: 'disabled'; permission: PushPermissionState }
  | { kind: 'busy' }

export function ProfileContent() {
  const router = useRouter()
  const { toast } = useToast()
  const [loggingOut, setLoggingOut] = useState(false)
  const [push, setPush] = useState<PushUiState>({ kind: 'loading' })

  const { data, isLoading, isError } = useQuery({
    queryKey: ['technician', 'profile'],
    queryFn: fetchProfile,
    staleTime: 5 * 60_000,
  })

  // ---------- Push initial state ----------
  const reconcile = useCallback(async () => {
    const support = getPushSupport()
    if (!support.fullySupported) {
      setPush({ kind: 'unsupported' })
      return
    }
    const permission = getPermissionState()
    if (permission === 'denied') {
      setPush({ kind: 'denied' })
      return
    }
    const sub = await getPushSubscription()
    setPush(sub ? { kind: 'enabled' } : { kind: 'disabled', permission })
  }, [])

  useEffect(() => {
    reconcile().catch(() => setPush({ kind: 'unsupported' }))
  }, [reconcile])

  // ---------- Subscribe ----------
  const enablePush = useCallback(async () => {
    setPush({ kind: 'busy' })
    try {
      const sub = await subscribeToPush()
      const payload = serializeSubscription(sub)
      const res = await fetch('/api/technician/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: payload.endpoint,
          keys: payload.keys,
          userAgent: navigator.userAgent,
        }),
      })
      if (!res.ok) {
        // Roll back the browser subscription so state stays consistent
        await sub.unsubscribe().catch(() => undefined)
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error ?? 'Server menolak subscription')
      }
      setPush({ kind: 'enabled' })
      toast({ title: 'Notifikasi diaktifkan' })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal mengaktifkan notifikasi'
      toast({ variant: 'destructive', title: 'Gagal', description: message })
      await reconcile()
    }
  }, [reconcile, toast])

  // ---------- Unsubscribe ----------
  const disablePush = useCallback(async () => {
    setPush({ kind: 'busy' })
    try {
      const sub = await getPushSubscription()
      if (sub) {
        await fetch('/api/technician/push/unsubscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        }).catch(() => undefined)
        await unsubscribeFromPush()
      }
      setPush({ kind: 'disabled', permission: getPermissionState() })
      toast({ title: 'Notifikasi dimatikan' })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal mematikan notifikasi'
      toast({ variant: 'destructive', title: 'Gagal', description: message })
      await reconcile()
    }
  }, [reconcile, toast])

  const onPushToggle = (next: boolean) => {
    if (push.kind === 'busy') return
    if (next) enablePush()
    else disablePush()
  }

  // ---------- Logout ----------
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
  const switchChecked = push.kind === 'enabled' || push.kind === 'busy'
  const switchDisabled =
    push.kind === 'loading' ||
    push.kind === 'unsupported' ||
    push.kind === 'denied' ||
    push.kind === 'busy'

  return (
    <div className="space-y-4">
      {/* Profile info card */}
      <div className="rounded-xl border bg-card p-4 space-y-4">
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

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {push.kind === 'enabled' ? (
              <Bell className="h-4 w-4 text-primary" aria-hidden="true" />
            ) : (
              <BellOff className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            )}
            <div>
              <p className="text-sm font-medium">Notifikasi Push</p>
              <p className="text-xs text-muted-foreground">
                {pushHelpText(push)}
              </p>
            </div>
          </div>
          <Switch
            checked={switchChecked}
            disabled={switchDisabled}
            onCheckedChange={onPushToggle}
            aria-label="Toggle notifikasi push"
          />
        </div>

        {push.kind === 'denied' && (
          <div className="flex gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
            <p>
              Notifikasi diblokir oleh browser. Buka pengaturan situs di
              browser kamu, izinkan notifikasi, lalu refresh halaman ini.
            </p>
          </div>
        )}
        {push.kind === 'unsupported' && (
          <div className="flex gap-2 rounded-md border bg-muted/50 p-3 text-xs text-muted-foreground">
            <Info className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
            <p>
              Browser ini tidak mendukung notifikasi push. Coba pakai Chrome
              atau Safari versi terbaru.
            </p>
          </div>
        )}
      </div>

      <Button
        variant="outline"
        onClick={handleLogout}
        disabled={loggingOut}
        className="w-full h-11 text-destructive hover:text-destructive hover:bg-destructive/10"
      >
        <LogOut className="mr-2 h-4 w-4" />
        {loggingOut ? 'Keluar...' : 'Keluar'}
      </Button>

      <p className="text-center text-xs text-muted-foreground pt-4">
        MSN Tech v2.0.0-beta
      </p>
    </div>
  )
}

function pushHelpText(state: PushUiState): string {
  switch (state.kind) {
    case 'loading':
      return 'Memuat status notifikasi...'
    case 'enabled':
      return 'Aktif. Kamu akan diberi tahu saat ada job baru.'
    case 'disabled':
      return 'Aktifkan untuk menerima notifikasi job baru.'
    case 'busy':
      return 'Memproses...'
    case 'denied':
      return 'Notifikasi diblokir oleh browser.'
    case 'unsupported':
      return 'Browser ini tidak mendukung notifikasi push.'
  }
}
