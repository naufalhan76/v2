'use client'

import { useEffect, useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
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

  return (
    <div className="space-y-4">
      {/* Profile info card */}
      <div className="rounded-lg border border-hairline bg-background p-4 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-lg font-semibold">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-base truncate">{technician?.technician_name ?? 'Teknisi'}</h2>
            {technician?.company && (
              <p className="text-xs text-ink-mute truncate">{technician.company}</p>
            )}
          </div>
        </div>

        <div className="space-y-2.5 pt-2 border-t">
          {technician?.contact_number && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-ink-mute shrink-0" aria-hidden="true" />
              <span className="truncate">{technician.contact_number}</span>
            </div>
          )}
          {technician?.email && (
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-ink-mute shrink-0" aria-hidden="true" />
              <span className="truncate">{technician.email}</span>
            </div>
          )}
          {technician?.company && (
            <div className="flex items-center gap-2 text-sm">
              <Info className="h-4 w-4 text-ink-mute shrink-0" aria-hidden="true" />
              <span className="truncate">{technician.company}</span>
            </div>
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div
        className="grid grid-cols-2 gap-2"
        role="list"
        aria-label="Statistik pekerjaan"
      >
        <StatCard
          icon={<Briefcase className="h-3.5 w-3.5" aria-hidden="true" />}
          label="Total Selesai"
          value={stats?.totalCompleted}
          tone="primary"
        />
        <StatCard
          icon={<TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />}
          label="Bulan Ini"
          value={stats?.monthCompleted}
          tone="muted"
        />
      </div>

      {/* Settings card */}
      <div className="rounded-lg border border-hairline bg-background p-4 space-y-4">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-ink-mute">
          Pengaturan
        </h3>

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {push.kind === 'enabled' ? (
              <Bell className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
            ) : (
              <BellOff className="h-4 w-4 text-ink-mute shrink-0" aria-hidden="true" />
            )}
            <div className="min-w-0">
              <p className="text-sm font-medium">Notifikasi Push</p>
              <p className="text-xs text-ink-mute line-clamp-1">{pushHelpText(push)}</p>
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
              Notifikasi diblokir oleh browser. Buka pengaturan situs di browser kamu, izinkan
              notifikasi, lalu refresh halaman ini.
            </p>
          </div>
        )}
        {push.kind === 'unsupported' && (
          <div className="flex gap-2 rounded-md border border-hairline bg-canvas-soft p-3 text-xs text-ink-mute">
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
        className={cn(
          'w-full h-11 text-destructive border-destructive/30',
          'hover:text-destructive hover:bg-destructive/10 hover:border-destructive/40',
          'cursor-pointer transition-colors'
        )}
      >
        <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
        Keluar
      </Button>

      <p className="text-center text-xs text-ink-mute pt-2">
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
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-pointer"
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
