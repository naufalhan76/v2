import { createClient } from '@supabase/supabase-js'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { QueryClient } from '@tanstack/react-query'

// Single shared realtime client (module-level singleton)
let _realtimeClient: ReturnType<typeof createClient> | null = null
const _activeChannels = new Map<string, ReturnType<ReturnType<typeof createClient>['channel']>>()

function getRealtimeClient() {
  if (!_realtimeClient) {
    _realtimeClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  return _realtimeClient
}

function subscribeChannel(
  channelName: string,
  table: string,
  queryClient: QueryClient,
  invalidateKeys: string[],
  callback: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void
) {
  // Return existing channel if already active (prevents duplicate WebSockets under StrictMode)
  if (_activeChannels.has(channelName)) {
    return () => {
      // No-op: channel is shared; caller should not unsubscribe unilaterally
    }
  }

  const supa = getRealtimeClient()
  const channel = supa
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table,
      },
      (payload) => {
        callback(payload)
        for (const key of invalidateKeys) {
          queryClient.invalidateQueries({ queryKey: [key] })
        }
      }
    )
    .subscribe()

  _activeChannels.set(channelName, channel)

  return () => {
    const ch = _activeChannels.get(channelName)
    if (ch) {
      supa.removeChannel(ch)
      _activeChannels.delete(channelName)
    }
  }
}

export function subscribeOrders(
  queryClient: QueryClient,
  callback: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void
) {
  return subscribeChannel(
    'orders-changes',
    'orders',
    queryClient,
    ['orders', 'dashboard-kpi'],
    callback
  )
}

export function subscribePayments(
  queryClient: QueryClient,
  callback: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void
) {
  return subscribeChannel(
    'payments-changes',
    'payments',
    queryClient,
    ['payments', 'dashboard-kpi'],
    callback
  )
}

export function subscribeServiceRecords(
  queryClient: QueryClient,
  callback: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void
) {
  return subscribeChannel(
    'service-records-changes',
    'service_records',
    queryClient,
    ['service-records', 'dashboard-kpi'],
    callback
  )
}

export function subscribeServicePricing(
  queryClient: QueryClient,
  callback: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void
) {
  return subscribeChannel(
    'service-pricing-changes',
    'service_pricing',
    queryClient,
    ['service-pricing'],
    callback
  )
}

export function subscribeServiceSla(
  queryClient: QueryClient,
  callback: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void
) {
  return subscribeChannel(
    'service-sla-changes',
    'service_sla',
    queryClient,
    ['service-sla'],
    callback
  )
}
