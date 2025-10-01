import { createClient } from '@supabase/supabase-js'
import { QueryClient } from '@tanstack/react-query'

export const realtimeClient = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

export function subscribeOrders(
  queryClient: QueryClient,
  callback: (payload: any) => void
) {
  const supa = realtimeClient()
  const channel = supa
    .channel('orders-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'orders',
      },
      (payload) => {
        callback(payload)
        // Invalidate orders query cache
        queryClient.invalidateQueries({ queryKey: ['orders'] })
        queryClient.invalidateQueries({ queryKey: ['dashboard-kpi'] })
      }
    )
    .subscribe()

  return () => {
    supa.removeChannel(channel)
  }
}

export function subscribePayments(
  queryClient: QueryClient,
  callback: (payload: any) => void
) {
  const supa = realtimeClient()
  const channel = supa
    .channel('payments-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'payments',
      },
      (payload) => {
        callback(payload)
        // Invalidate payments and dashboard query cache
        queryClient.invalidateQueries({ queryKey: ['payments'] })
        queryClient.invalidateQueries({ queryKey: ['dashboard-kpi'] })
      }
    )
    .subscribe()

  return () => {
    supa.removeChannel(channel)
  }
}

export function subscribeServiceRecords(
  queryClient: QueryClient,
  callback: (payload: any) => void
) {
  const supa = realtimeClient()
  const channel = supa
    .channel('service-records-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'service_records',
      },
      (payload) => {
        callback(payload)
        // Invalidate service records and related queries
        queryClient.invalidateQueries({ queryKey: ['service-records'] })
        queryClient.invalidateQueries({ queryKey: ['dashboard-kpi'] })
      }
    )
    .subscribe()

  return () => {
    supa.removeChannel(channel)
  }
}

export function subscribeServicePricing(
  queryClient: QueryClient,
  callback: (payload: any) => void
) {
  const supa = realtimeClient()
  const channel = supa
    .channel('service-pricing-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'service_pricing',
      },
      (payload) => {
        callback(payload)
        queryClient.invalidateQueries({ queryKey: ['service-pricing'] })
      }
    )
    .subscribe()

  return () => {
    supa.removeChannel(channel)
  }
}

export function subscribeServiceSla(
  queryClient: QueryClient,
  callback: (payload: any) => void
) {
  const supa = realtimeClient()
  const channel = supa
    .channel('service-sla-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'service_sla',
      },
      (payload) => {
        callback(payload)
        queryClient.invalidateQueries({ queryKey: ['service-sla'] })
      }
    )
    .subscribe()

  return () => {
    supa.removeChannel(channel)
  }
}