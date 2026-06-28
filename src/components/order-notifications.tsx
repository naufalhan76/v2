'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Bell } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import { useUser } from '@clerk/nextjs'
import { useQuery } from '@tanstack/react-query'
import { logger } from '@/lib/logger'
import {
  getCancelledNotifications,
  getOrdersUpdatedRecently,
  type CancelledNotificationRow,
  type OrdersWithDateChangesRow,
} from '@/lib/actions/notifications'

const MAX_READ_NOTIFICATIONS = 100

interface OrderNotification {
  order_id: string
  customer_name: string
  status: 'CANCELLED'
  updated_at: string
  scheduled_visit_date?: string
  read: boolean
}

interface RescheduledNotification {
  id: string
  orderId: string
  customerName: string
  oldDate: string
  newDate: string
  timestamp: string
  read: boolean
}

export function OrderNotifications() {
  const router = useRouter()
  const { user } = useUser()
  const userId = user?.id ?? null

  const [notifications, setNotifications] = useState<OrderNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)
  const [rescheduledNotifications, setRescheduledNotifications] = useState<RescheduledNotification[]>([])

  const sevenDaysAgoIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const oneDayAgoIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data: cancelledOrders } = useQuery<CancelledNotificationRow[]>({
    queryKey: ['notifications', 'cancelled'],
    queryFn: () => getCancelledNotifications(sevenDaysAgoIso),
    enabled: !!userId,
    refetchInterval: 10_000,
    staleTime: 5_000,
  })

  const { data: recentOrders } = useQuery<OrdersWithDateChangesRow[]>({
    queryKey: ['notifications', 'reschedules'],
    queryFn: () => getOrdersUpdatedRecently(oneDayAgoIso),
    enabled: !!userId,
    refetchInterval: 5000,
    staleTime: 2000,
  })

  const prevDatesRef = useRef<Map<string, string>>(new Map())

  useEffect(() => {
    if (!userId || !recentOrders) return

    const now = new Date().toISOString()
    const prev = prevDatesRef.current
    const newRescheduleNotifications: RescheduledNotification[] = []

    for (const order of recentOrders) {
      const key = order.order_id
      const prevDate = prev.get(key)
      const newDate = order.scheduled_visit_date

      if (prevDate && newDate && prevDate !== newDate) {
        newRescheduleNotifications.push({
          id: `reschedule-${key}-${Date.now()}`,
          orderId: key,
          customerName: order.customer_name ?? 'Unknown',
          oldDate: prevDate,
          newDate,
          timestamp: now,
          read: false,
        })
      }

      if (newDate) prev.set(key, newDate)
    }

    if (newRescheduleNotifications.length > 0) {
      setRescheduledNotifications((existing) => {
        const merged = [...newRescheduleNotifications, ...existing].slice(0, 20)
        return merged.filter((n) => {
          const age = Date.now() - new Date(n.timestamp).getTime()
          return age < 24 * 60 * 60 * 1000
        })
      })
    }
  }, [recentOrders, userId])

  useEffect(() => {
    if (!userId || !cancelledOrders) return

    const storageKey = `readNotifications_${userId}`
    const readNotifications: string[] = JSON.parse(localStorage.getItem(storageKey) || '[]')

    const formatted: OrderNotification[] = cancelledOrders.map((raw) => ({
      order_id: raw.order_id,
      customer_name: raw.customer_name,
      status: 'CANCELLED',
      updated_at: raw.updated_at,
      scheduled_visit_date: raw.scheduled_visit_date ?? undefined,
      read: readNotifications.includes(raw.order_id),
    }))

    setNotifications(formatted)
    setUnreadCount(formatted.filter((n) => !n.read).length)
  }, [cancelledOrders, userId])

  useEffect(() => {
    const handler = () => {
      if (!userId) return
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
      setUnreadCount(0)
    }
    window.addEventListener('markAllRead', handler)
    return () => window.removeEventListener('markAllRead', handler)
  }, [userId])

  const handleNotificationClick = (orderId: string) => {
    markAsRead(orderId)
    setOpen(false)
    router.push(`/dashboard/orders?view=board&orderId=${orderId}`)
  }

  const markAsRead = (orderId: string) => {
    if (!userId) return

    setNotifications((prev) =>
      prev.map((n) => (n.order_id === orderId ? { ...n, read: true } : n))
    )

    const storageKey = `readNotifications_${userId}`
    const readNotifications: string[] = JSON.parse(localStorage.getItem(storageKey) || '[]')
    if (!readNotifications.includes(orderId)) {
      const pruned = [...readNotifications, orderId].slice(-MAX_READ_NOTIFICATIONS)
      localStorage.setItem(storageKey, JSON.stringify(pruned))
    }

    setUnreadCount((prev) => Math.max(0, prev - 1))
  }

  const markAllAsRead = () => {
    if (!userId) return

    const allOrderIds = notifications.map((n) => n.order_id).slice(-MAX_READ_NOTIFICATIONS)
    const storageKey = `readNotifications_${userId}`
    localStorage.setItem(storageKey, JSON.stringify(allOrderIds))

    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    setRescheduledNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    setUnreadCount(0)
  }

  const cancelledNotifications = notifications.filter((n) => n.status === 'CANCELLED')
  const unreadRescheduled = rescheduledNotifications.filter((n) => !n.read).length
  const unreadCancelled = cancelledNotifications.filter((n) => !n.read).length
  const totalUnreadCount = unreadCancelled + unreadRescheduled

  const NotificationItem = ({ notification }: { notification: OrderNotification }) => (
    <div
      onClick={() => handleNotificationClick(notification.order_id)}
      className={cn(
        'p-3 rounded-lg cursor-pointer transition-all hover:bg-accent border',
        notification.read ? 'bg-muted/30 opacity-70' : 'bg-background'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-sm truncate">{notification.customer_name}</span>
            {!notification.read && (
              <div className="w-2 h-2 bg-destructive rounded-full flex-shrink-0" />
            )}
          </div>
          <p className="font-mono text-xs text-muted-foreground mb-1">
            {notification.order_id}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <Badge
            variant={notification.status === 'CANCELLED' ? 'destructive' : 'secondary'}
            className="text-xs"
          >
            {notification.status === 'CANCELLED' ? 'Dibatalkan' : 'Dijadwal Ulang'}
          </Badge>
          <p className="text-xs text-muted-foreground mt-1">
            {format(new Date(notification.updated_at), 'dd MMM HH:mm', { locale: id })}
          </p>
        </div>
      </div>
    </div>
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {totalUnreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs font-bold flex items-center justify-center">
              {totalUnreadCount > 9 ? '9+' : totalUnreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-base">Notifikasi Order</h3>
          {totalUnreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              className="text-xs h-8"
            >
              Tandai Semua Terbaca
            </Button>
          )}
        </div>

        <Tabs defaultValue="rescheduled" className="w-full">
          <TabsList className="w-full grid grid-cols-2 rounded-none border-b">
            <TabsTrigger value="rescheduled" className="flex items-center justify-center gap-1.5">
              Dijadwal Ulang
              {unreadRescheduled > 0 && (
                <span className="inline-flex h-5 min-w-5 px-1 rounded-full bg-status-pending text-white text-xs font-bold items-center justify-center leading-none">
                  {unreadRescheduled}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="cancelled" className="flex items-center justify-center gap-1.5">
              Dibatalkan
              {unreadCancelled > 0 && (
                <span className="inline-flex h-5 min-w-5 px-1 rounded-full bg-destructive text-destructive-foreground text-xs font-bold items-center justify-center leading-none">
                  {unreadCancelled}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="rescheduled" className="m-0">
            <ScrollArea className="h-[400px]">
              <div className="p-3 space-y-2">
                {rescheduledNotifications.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    Tidak ada order yang dijadwal ulang
                  </div>
                ) : (
                  rescheduledNotifications.map((notification) => (
                    <div
                      key={notification.id}
                      onClick={() => {
                        setRescheduledNotifications((prev) =>
                          prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
                        )
                        setOpen(false)
                        router.push(`/dashboard/orders?view=board&orderId=${notification.orderId}`)
                      }}
                      className={cn(
                        'p-3 rounded-lg cursor-pointer transition-all hover:bg-accent border',
                        notification.read ? 'bg-muted/30 opacity-70' : 'bg-background'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-sm truncate">{notification.customerName}</span>
                            {!notification.read && (
                              <div className="w-2 h-2 bg-status-pending rounded-full flex-shrink-0" />
                            )}
                          </div>
                          <p className="font-mono text-xs text-muted-foreground mb-1">
                            {notification.orderId}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(notification.oldDate), 'dd MMM yyyy', { locale: id })}
                            {' → '}
                            {format(new Date(notification.newDate), 'dd MMM yyyy', { locale: id })}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <Badge variant="secondary" className="text-xs">
                            Dijadwal Ulang
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(notification.timestamp), 'dd MMM HH:mm', { locale: id })}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="cancelled" className="m-0">
            <ScrollArea className="h-[400px]">
              <div className="p-3 space-y-2">
                {cancelledNotifications.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    Tidak ada order yang dibatalkan
                  </div>
                ) : (
                  cancelledNotifications.map((notification) => (
                    <NotificationItem key={notification.order_id} notification={notification} />
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  )
}
