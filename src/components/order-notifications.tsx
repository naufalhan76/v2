'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
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
import { logger } from '@/lib/logger'
import type { SupabaseClient } from '@supabase/supabase-js'

// Max entries kept in localStorage to prevent unbounded growth
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
  const [notifications, setNotifications] = useState<OrderNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [rescheduledNotifications, setRescheduledNotifications] = useState<RescheduledNotification[]>([])
  const supabaseRef = useRef<Awaited<ReturnType<typeof import('@/lib/supabase-browser').createClient>> | null>(null)

  useEffect(() => {
    const init = async () => {
      const { createClient } = await import('@/lib/supabase-browser')
      supabaseRef.current = createClient()
      try {
        const { data: { user } } = await supabaseRef.current.auth.getUser()
        if (user) {
          setUserId(user.id)
        }
      } catch (error) {
        logger.error('Error getting user ID:', error)
      }
    }
    init()
  }, [])

  const fetchNotifications = useCallback(async () => {
    if (!userId) return
    const supabase = supabaseRef.current
    if (!supabase) return

    try {
      // Get notifications from last 7 days untuk catch more notifications
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      
      // Fetch orders that were cancelled or rescheduled
      const { data: orders, error } = await supabase
        .from('orders')
        .select(`
          order_id,
          status,
          updated_at,
          scheduled_visit_date,
          customers (
            customer_name
          )
        `)
        .in('status', ['CANCELLED'])
        .gte('updated_at', sevenDaysAgo.toISOString())
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })
        .limit(100)

      if (error) throw error

      // Get read notifications from localStorage with user-specific key
      const storageKey = `readNotifications_${userId}`
      const readNotifications = JSON.parse(localStorage.getItem(storageKey) || '[]')

      const formattedNotifications: OrderNotification[] = (orders || []).map((rawOrder: unknown) => {
        const order = rawOrder as {
          order_id: string
          status: 'CANCELLED'
          updated_at: string
          scheduled_visit_date?: string
          customers?: { customer_name?: string } | null
        }
        return {
          order_id: order.order_id,
          customer_name: order.customers?.customer_name || 'Unknown Customer',
          status: order.status,
          updated_at: order.updated_at,
          scheduled_visit_date: order.scheduled_visit_date,
          read: readNotifications.includes(order.order_id)
        }
      })

      setNotifications(formattedNotifications)
      setUnreadCount(formattedNotifications.filter(n => !n.read).length)
    } catch (error) {
      logger.error('Error fetching notifications:', error)
    }
  }, [userId])

  useEffect(() => {
    fetchNotifications()

    // Poll for new notifications every 10 seconds (lebih cepat)
    const interval = setInterval(fetchNotifications, 10000)

    return () => clearInterval(interval)
  }, [fetchNotifications])

  // Expose refresh function via window untuk dipanggil dari komponen lain
  useEffect(() => {
    (window as unknown as { refreshNotifications: typeof fetchNotifications }).refreshNotifications = fetchNotifications
    return () => {
      delete (window as unknown as { refreshNotifications?: typeof fetchNotifications }).refreshNotifications
    }
  }, [fetchNotifications])

  const handleNotificationClick = (orderId: string) => {
    // Mark as read
    markAsRead(orderId)
    
    // Close popover
    setOpen(false)
    
    // Navigate to orders page with order detail highlighted
    router.push(`/dashboard/orders?view=board&orderId=${orderId}`)
  }

  const markAsRead = (orderId: string) => {
    if (!userId) return
    
    setNotifications(prev => 
      prev.map(n => n.order_id === orderId ? { ...n, read: true } : n)
    )
    
    const storageKey = `readNotifications_${userId}`
    const readNotifications: string[] = JSON.parse(localStorage.getItem(storageKey) || '[]')
    if (!readNotifications.includes(orderId)) {
      const pruned = [...readNotifications, orderId].slice(-MAX_READ_NOTIFICATIONS)
      localStorage.setItem(storageKey, JSON.stringify(pruned))
    }
    
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  const markAllAsRead = () => {
    if (!userId) return
    
    const allOrderIds = notifications.map(n => n.order_id).slice(-MAX_READ_NOTIFICATIONS)
    const storageKey = `readNotifications_${userId}`
    localStorage.setItem(storageKey, JSON.stringify(allOrderIds))
    
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    setRescheduledNotifications(prev => prev.map(n => ({ ...n, read: true })))
    setUnreadCount(0)
  }

  useEffect(() => {
    const supabase = supabaseRef.current
    if (!supabase) return

    const channel = supabase
      .channel('order-reschedules')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
      }, (payload: { old: Record<string, unknown>; new: Record<string, unknown> }) => {
        if (!userId) return
        
        const oldDate = payload.old.scheduled_visit_date as string | undefined
        const newDate = payload.new.scheduled_visit_date as string | undefined
        if (oldDate && newDate && oldDate !== newDate) {
          setRescheduledNotifications(prev => {
            const notification: RescheduledNotification = {
              id: `reschedule-${payload.new.order_id}-${Date.now()}`,
              orderId: payload.new.order_id as string,
              customerName: (payload.new.customer_name as string) || 'Unknown',
              oldDate,
              newDate,
              timestamp: new Date().toISOString(),
              read: false,
            }
            const updated = [notification, ...prev].slice(0, 20) // FIFO, max 20
            return updated.filter(n => {
              const age = Date.now() - new Date(n.timestamp).getTime()
              return age < 24 * 60 * 60 * 1000 // 24 hours
            })
          })
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Create channel once on mount, don't recreate on userId change

  const cancelledNotifications = notifications.filter(n => n.status === 'CANCELLED')

  const unreadRescheduled = rescheduledNotifications.filter(n => !n.read).length
  const unreadCancelled = cancelledNotifications.filter(n => !n.read).length
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
                  rescheduledNotifications.map(notification => (
                    <div
                      key={notification.id}
                      onClick={() => {
                        setRescheduledNotifications(prev =>
                          prev.map(n => n.id === notification.id ? { ...n, read: true } : n)
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
                  cancelledNotifications.map(notification => (
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
