'use client'

import { useEffect, useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { useOnlineSync } from '@/hooks/use-online-sync'
import { useToast } from '@/hooks/use-toast'
import { getMyTechnicianProfile, getTechnicianStats } from '@/lib/actions/technician-profile'
import {
  getPushSupport,
  getPermissionState,
  getPushSubscription,
  subscribeToPush,
  unsubscribeFromPush,
  serializeSubscription,
} from '@/lib/push'
import { ProfileInfoSection } from './profile/profile-info-section'
import { ProfileSettingsSection } from './profile/profile-settings-section'
import { SignOutSection } from './profile/sign-out-section'
import { SyncStatusSection } from './profile/sync-status-section'
import type { ProfileStats, PushUiState } from './profile/profile-types'

async function fetchProfile() {
  const technician = await getMyTechnicianProfile()
  if (!technician) throw new Error('Profil teknisi tidak ditemukan')
  return { technician }
}

function startOfMonthIso(): string {
  const d = new Date()
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

export function ProfileContent() {
  const router = useRouter()
  const { toast } = useToast()
  const { signOut } = useAuth()
  const { pending, lastResult } = useOnlineSync()
  const [loggingOut, setLoggingOut] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [push, setPush] = useState<PushUiState>({ kind: 'loading' })

  const { data, isLoading, isError } = useQuery({
    queryKey: ['technician', 'profile'],
    queryFn: fetchProfile,
    staleTime: 5 * 60_000,
  })

  useQuery({
    queryKey: ['technician', 'profile', 'stats', data?.technician?.technician_id ?? null],
    queryFn: () => getTechnicianStats(data?.technician?.technician_id ?? null),
    enabled: !!data?.technician?.technician_id,
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
    setConfirmOpen(false)
    try {
      await signOut()
      router.push('/login')
    } catch {
      setLoggingOut(false)
      toast({
        variant: 'destructive',
        title: 'Gagal keluar',
        description: 'Coba lagi dalam beberapa saat.',
      })
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="rounded-lg border border-border bg-background p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 rounded-full bg-surface-muted" />
            <div className="space-y-2 flex-1">
              <div className="h-5 w-40 rounded bg-surface-muted" />
              <div className="h-3 w-32 rounded bg-surface-muted" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="h-16 rounded-lg bg-surface-muted" />
          <div className="h-16 rounded-lg bg-surface-muted" />
          <div className="h-16 rounded-lg bg-surface-muted" />
        </div>
      </div>
    )
  }

  if (isError || !data || !data.technician) {
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

  const pendingCount = pending.reports + pending.transitions + pending.photos
  const lastSyncTime = lastResult ? new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : 'Belum sinkronisasi'

  return (
      <div className="space-y-6">
      <ProfileInfoSection technician={technician} />
      <SyncStatusSection pendingCount={pendingCount} lastSyncTime={lastSyncTime} />
      <ProfileSettingsSection
        push={push}
        switchChecked={switchChecked}
        switchDisabled={switchDisabled}
        onPushToggle={onPushToggle}
      />
      <SignOutSection
        loggingOut={loggingOut}
        confirmOpen={confirmOpen}
        onConfirmOpenChange={setConfirmOpen}
        onLogout={handleLogout}
      />
    </div>
  )
}
