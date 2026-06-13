'use client'

import { useEffect, useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { TechnicianThemeToggle } from '@/components/technician/theme-toggle'
import { SyncStatus } from '@/components/technician/sync-status'
import { useOnlineSync } from '@/hooks/use-online-sync'
import {
  Phone,
  Mail,
  Bell,
  BellOff,
  LogOut,
  Info,
  AlertTriangle,
  Briefcase,
  TrendingUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'
import { createClient } from '@/lib/supabase-browser'
import { cn } from '@/lib/utils'
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
    .select('technician_id, technician_name, contact_number, email, company')
    .eq('auth_user_id', user.id)
    .single()
  if (error) throw new Error('Gagal memuat profil')
  if (!technician) throw new Error('Profil teknisi tidak ditemukan')

  return { user, technician }
}

interface ProfileStats {
  totalCompleted: number
  monthCompleted: number
}

async function fetchProfileStats(technicianId: string | undefined): Promise<ProfileStats> {
  if (!technicianId) {
    return { totalCompleted: 0, monthCompleted: 0 }
  }
  const supabase = createClient()

  const [lifetimeRes, monthRes] = await Promise.all([
    supabase
      .from('service_reports')
      .select('report_id', { count: 'exact', head: true })
      .eq('technician_id', technicianId)
      .is('deleted_at', null),
    supabase
      .from('service_reports')
      .select('report_id', { count: 'exact', head: true })
      .eq('technician_id', technicianId)
      .is('deleted_at', null)
      .gte('submitted_at', startOfMonthIso()),
  ])

  return {
    totalCompleted: lifetimeRes.count ?? 0,
    monthCompleted: monthRes.count ?? 0,
  }
}

function startOfMonthIso(): string {
  const d = new Date()
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

type PushUiState =
  | { kind: 'loading' }
  | { kind: 'unsupported' }
  | { kind: 'denied' }
  | { kind: 'enabled' }
  | { kind: 'disabled'; permission: PushPermissionState }
  | { kind: 'busy' }

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

export function ProfileContent() {
  const router = useRouter()
  const { toast } = useToast()
  const { pending, lastResult } = useOnlineSync()
  const [loggingOut, setLoggingOut] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [push, setPush] = useState<PushUiState>({ kind: 'loading' })

  const { data, isLoading, isError } = useQuery({
    queryKey: ['technician', 'profile'],
    queryFn: fetchProfile,
    staleTime: 5 * 60_000,
  })

  const { data: stats } = useQuery({
    queryKey: ['technician', 'profile', 'stats', data?.technician?.technician_id ?? null],
    queryFn: () => fetchProfileStats(data?.technician?.technician_id),
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
      const supabase = createClient()
      await supabase.auth.signOut()
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
        <div className="rounded-lg border border-hairline bg-background p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 rounded-full bg-canvas-soft" />
            <div className="space-y-2 flex-1">
              <div className="h-5 w-40 rounded bg-canvas-soft" />
              <div className="h-3 w-32 rounded bg-canvas-soft" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="h-16 rounded-lg bg-canvas-soft" />
          <div className="h-16 rounded-lg bg-canvas-soft" />
          <div className="h-16 rounded-lg bg-canvas-soft" />
        </div>
      </div>
    )
  }

  if (isError || !data || !data.technician) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-ink-mute">Gagal memuat profil</p>
      </div>
    )
  }

  const { technician } = data
  const initials = getInitials(technician?.technician_name ?? '')
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
      {/* Profile info card */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 dark:bg-[#1a1833] dark:border-gray-700 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#211c59] text-white text-xl font-semibold dark:bg-indigo-500">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-bold text-xl truncate dark:text-white">{technician?.technician_name ?? 'Teknisi'}</h2>
            {technician?.company && (
              <p className="text-sm text-gray-500 truncate dark:text-gray-400">{technician.company}</p>
            )}
          </div>
        </div>

        <div className="space-y-3 pt-4 border-t border-gray-100 dark:border-gray-800">
          {technician?.contact_number && (
            <div className="flex items-center gap-3 text-sm dark:text-gray-300">
              <Phone className="h-4 w-4 text-gray-400 shrink-0" aria-hidden="true" />
              <span className="truncate font-medium">{technician.contact_number}</span>
            </div>
          )}
          {technician?.email && (
            <div className="flex items-center gap-3 text-sm dark:text-gray-300">
              <Mail className="h-4 w-4 text-gray-400 shrink-0" aria-hidden="true" />
              <span className="truncate font-medium">{technician.email}</span>
            </div>
          )}
        </div>
      </div>

      {/* Sync status section */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 dark:bg-[#1a1833] dark:border-gray-700 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Status Sinkronisasi
        </h3>
        
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-semibold dark:text-white">Item Tertunda</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{pendingCount} item</p>
          </div>
          <div className="space-y-1 text-right">
            <p className="text-sm font-semibold dark:text-white">Terakhir Sinkron</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{lastSyncTime}</p>
          </div>
        </div>
        
        <button 
          onClick={() => {
            const btn = document.querySelector('[aria-label*="sinkronkan sekarang"]') as HTMLButtonElement
            if (btn) btn.click()
            else {
               const syncBtn = document.querySelector('[role="status"]') as HTMLElement;
               if (syncBtn && syncBtn.tagName === 'BUTTON') {
                 syncBtn.click();
               }
            }
          }}
          className="w-full border-2 border-gray-200 dark:border-gray-700 rounded-xl py-3 font-semibold text-[#211c59] dark:text-indigo-300 flex items-center justify-center gap-2 hover:bg-gray-50 dark:hover:bg-[#252243] transition-colors"
        >
          <SyncStatus variant="compact" className="border-0 bg-transparent text-inherit p-0 h-auto" />
          Sinkronkan Sekarang
        </button>
      </div>

      {/* Settings card */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 dark:bg-[#1a1833] dark:border-gray-700 space-y-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Pengaturan Tampilan
        </h3>
        <TechnicianThemeToggle />

        <div className="h-px bg-gray-100 dark:bg-gray-800 my-2" />

        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Pengaturan Notifikasi
        </h3>

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={cn(
              "p-2 rounded-lg", 
              push.kind === 'enabled' ? "bg-indigo-50 dark:bg-[#252243] text-[#211c59] dark:text-indigo-300" : "bg-gray-50 dark:bg-gray-800 text-gray-400"
            )}>
              {push.kind === 'enabled' ? (
                <Bell className="h-5 w-5 shrink-0" aria-hidden="true" />
              ) : (
                <BellOff className="h-5 w-5 shrink-0" aria-hidden="true" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold dark:text-white">Notifikasi Push</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">{pushHelpText(push)}</p>
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
          <div className="flex gap-2 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 p-4 text-xs text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
            <p>
              Notifikasi diblokir oleh browser. Buka pengaturan situs di browser kamu, izinkan
              notifikasi, lalu refresh halaman ini.
            </p>
          </div>
        )}
        {push.kind === 'unsupported' && (
          <div className="flex gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#1a1833] p-4 text-xs text-gray-500 dark:text-gray-400">
            <Info className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
            <p>
              Browser ini tidak mendukung notifikasi push. Coba pakai Chrome atau Safari versi
              terbaru.
            </p>
          </div>
        )}
      </div>

      {/* Sign out */}
      <Button
        type="button"
        variant="outline"
        onClick={() => setConfirmOpen(true)}
        disabled={loggingOut}
        className="w-full bg-red-50 text-red-600 font-semibold py-4 rounded-xl border-2 border-red-200 hover:bg-red-100 hover:text-red-700 transition-colors h-auto dark:bg-red-950 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900"
      >
        <LogOut className="mr-2 h-5 w-5" aria-hidden="true" />
        Keluar Akun
      </Button>

      <p className="text-center text-xs text-gray-400 dark:text-gray-500 pt-2 font-medium">
        MSN Tech v2.0.0-beta
      </p>

      {/* Sign out confirmation */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-destructive text-destructive-foreground">
                <LogOut className="h-4 w-4" aria-hidden="true" />
              </span>
              Keluar dari akun?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Kamu perlu masuk lagi untuk mengakses pekerjaan dan notifikasi. Sinkronisasi
              offline tetap aman di perangkat ini.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loggingOut} className="cursor-pointer">
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLogout}
              disabled={loggingOut}
              className="bg-destructive text-destructive-foreground hover:bg-red-700 cursor-pointer"
            >
              {loggingOut ? 'Memproses...' : 'Ya, keluar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: number | null | undefined
  tone: 'primary' | 'muted'
}) {
  const toneClass =
    tone === 'primary'
      ? 'border-primary bg-primary text-primary-foreground'
      : 'border-hairline bg-background text-foreground'

  const display =
    value === null || value === undefined ? (
      <span className="opacity-50">—</span>
    ) : (
      value
    )

  return (
    <div
      role="listitem"
      className={cn('flex flex-col gap-0.5 rounded-lg border px-3 py-2.5', toneClass)}
    >
      <div className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider opacity-90">
        {icon}
        {label}
      </div>
      <div className="text-lg font-semibold tabular-nums leading-none">{display}</div>
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
