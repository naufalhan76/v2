'use client'

import { useState, useEffect, useCallback } from 'react'
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

interface OrderNotification {
  order_id: string
  customer_name: string
  status: 'CANCELLED' | 'RESCHEDULE'
  updated_at: string
  scheduled_visit_date?: string
  read: boolean
}

export function OrderNotifications() {
  const router = useRouter()
  const [notifications, setNotifications] = useState<OrderNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  // Get current user ID for localStorage isolation
  useEffect(() => {
    const getUserId = async () => {
      try {
        const supabase = await import('@/lib/supabase-browser').then(m => m.createClient())
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          setUserId(user.id)
        }
      } catch (error) {
        logger.error('Error getting user ID:', error)
      }
    }
    getUserId()
  }, [])

  // Fetch notifications from localStorage or API
  const fetchNotifications = useCallback(async () => {
    if (!userId) return // Wait for user ID
    
    try {
      const supabase = await import('@/lib/supabase-browser').then(m => m.createClient())
      
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
        .in('status', ['CANCELLED', 'RESCHEDULE'])
        .gte('updated_at', sevenDaysAgo.toISOString())
        .order('updated_at', { ascending: false })
        .limit(100)

      if (error) throw error

      // Get read notifications from localStorage with user-specific key
      const storageKey = `readNotifications_${userId}`
      const readNotifications = JSON.parse(localStorage.getItem(storageKey) || '[]')

      const formattedNotifications: OrderNotification[] = (orders || []).map((order: any) => ({
        order_id: order.order_id,
        customer_name: order.customers?.customer_name || 'Unknown Customer',
        status: order.status,
        updated_at: order.updated_at,
        scheduled_visit_date: order.scheduled_visit_date,
        read: readNotifications.includes(order.order_id)
      }))

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
    (window as any).refreshNotifications = fetchNotifications
    return () => {
      delete (window as any).refreshNotifications
    }
  }, [fetchNotifications])

  const handleNotificationClick = (orderId: string) => {
    // Mark as read
    markAsRead(orderId)
    
    // Close popover
    setOpen(false)
    
    // Navigate to monitoring ongoing with the order detail
    router.push(`/dashboard/operasional/monitoring-ongoing?orderId=${orderId}`)
  }

  const markAsRead = (orderId: string) => {
    if (!userId) return
    
    setNotifications(prev => 
      prev.map(n => n.order_id === orderId ? { ...n, read: true } : n)
    )
    
    const storageKey = `readNotifications_${userId}`
    const readNotifications = JSON.parse(localStorage.getItem(storageKey) || '[]')
    if (!readNotifications.includes(orderId)) {
      readNotifications.push(orderId)
      localStorage.setItem(storageKey, JSON.stringify(readNotifications))
    }
    
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  const markAllAsRead = () => {
    if (!userId) return
    
    const allOrderIds = notifications.map(n => n.order_id)
    const storageKey = `readNotifications_${userId}`
    localStorage.setItem(storageKey, JSON.stringify(allOrderIds))
    
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    setUnreadCount(0)
  }

  const rescheduledNotifications = notifications.filter(n => n.status === 'RESCHEDULE')
  const cancelledNotifications = notifications.filter(n => n.status === 'CANCELLED')

  const unreadRescheduled = rescheduledNotifications.filter(n => !n.read).length
  const unreadCancelled = cancelledNotifications.filter(n => !n.read).length

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
              <div className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0" />
            )}
          </div>
          <p className="font-mono text-xs text-muted-foreground mb-1">
            {notification.order_id}
          </p>
          {notification.status === 'RESCHEDULE' && notification.scheduled_visit_date && (
            <p className="text-xs text-muted-foreground">
              Dijadwalkan ulang ke: {format(new Date(notification.scheduled_visit_date), 'dd MMM yyyy', { locale: id })}
            </p>
          )}
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
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-base">Notifikasi Order</h3>
          {unreadCount > 0 && (
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
            <TabsTrigger value="rescheduled" className="relative">
              Dijadwal Ulang
              {unreadRescheduled > 0 && (
                <span className="ml-2 h-5 w-5 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center justify-center">
                  {unreadRescheduled}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="cancelled" className="relative">
              Dibatalkan
              {unreadCancelled > 0 && (
                <span className="ml-2 h-5 w-5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
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
                    <NotificationItem key={notification.order_id} notification={notification} />
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
