import { useEffect, useState } from 'react'
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import type { QueryClient } from '@tanstack/react-query'
import { useUser } from '@clerk/nextjs'
import { subscribeOrders } from '@/lib/realtime'
import { toCanonical } from '@/lib/order-status'
import type { OrderForDisplay } from '@/lib/order-utils'
import { getMyUserProfile } from '@/lib/actions/my-profile'

type SearchParams = ReturnType<typeof import('next/navigation').useSearchParams>

export function useResponsiveOrdersView(searchParams: SearchParams, router: AppRouterInstance) {
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 1280px)')

    function handleChange(e: MediaQueryListEvent | MediaQueryList) {
      const hasExplicitView = searchParams.has('view')
      if (!hasExplicitView) {
        const nextView = e.matches ? 'board' : 'list'
        const params = new URLSearchParams(searchParams.toString())
        params.set('view', nextView)
        router.replace(`?${params.toString()}`, { scroll: false })
      }
    }

    handleChange(mql)
    mql.addEventListener('change', handleChange)
    return () => mql.removeEventListener('change', handleChange)
  }, [searchParams, router])
}

export function useUserRole() {
  const [userRole, setUserRole] = useState<string | null>(null)
  const { user } = useUser()

  useEffect(() => {
    if (!user) return
    getMyUserProfile()
      .then((data) => {
        if (data) setUserRole(data.role)
      })
      .catch(() => {})
  }, [user])

  return userRole
}

export function useOrdersRealtimeToast(
  data: unknown,
  queryClient: QueryClient,
  toast: (input: { title: string; description?: string }) => void,
) {
  useEffect(() => {
    if (!data) return
    const unsub = subscribeOrders(queryClient, (payload) => {
      const newRow = payload.new as { order_id?: string; status?: string } | null
      const oldRow = payload.old as { status?: string } | null
      if (
        payload.eventType === 'UPDATE' &&
        newRow?.status &&
        oldRow?.status &&
        toCanonical(newRow.status) !== toCanonical(oldRow.status)
      ) {
        toast({
          title: `Update: ${newRow.order_id ?? ''}`,
          description: `Status berubah ke ${toCanonical(newRow.status)}`,
        })
      }
    })
    return unsub
  }, [queryClient, toast, !!data])
}

export function useBoardKeyboardNavigation({
  view,
  focusedOrderId,
  selectionMode,
  detailOpen,
  groupedOrders,
  columnIds,
  onFocusChange,
  onOpenDetail,
  onClearSelection,
  onSelectToggle,
}: {
  view: 'board' | 'list'
  focusedOrderId: string | null
  selectionMode: boolean
  detailOpen: boolean
  groupedOrders: Record<string, OrderForDisplay[]>
  columnIds: string[]
  onFocusChange: (orderId: string | null) => void
  onOpenDetail: (orderId: string) => void
  onClearSelection: () => void
  onSelectToggle: (orderId: string) => void
}) {
  useEffect(() => {
    if (view !== 'board') return

    const findCardPosition = (orderId: string | null) => {
      if (!orderId) return null
      for (const colId of columnIds) {
        const idx = groupedOrders[colId].findIndex((o) => o.order_id === orderId)
        if (idx !== -1) return { colId, idx }
      }
      return null
    }

    const getFirstCard = () => {
      for (const colId of columnIds) {
        if (groupedOrders[colId].length > 0) return groupedOrders[colId][0].order_id
      }
      return null
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return
      if (handleControlKey(e, { focusedOrderId, selectionMode, detailOpen, onOpenDetail, onClearSelection, onSelectToggle })) return

      const arrowKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']
      if (!arrowKeys.includes(e.key)) return

      e.preventDefault()
      const pos = findCardPosition(focusedOrderId)
      if (!pos) {
        const first = getFirstCard()
        if (first) onFocusChange(first)
        return
      }
      moveFocus(e.key, pos, groupedOrders, columnIds, onFocusChange)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [view, focusedOrderId, selectionMode, detailOpen, groupedOrders, columnIds, onFocusChange, onOpenDetail, onClearSelection, onSelectToggle])
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable
}

function handleControlKey(
  e: KeyboardEvent,
  args: {
    focusedOrderId: string | null
    selectionMode: boolean
    detailOpen: boolean
    onOpenDetail: (orderId: string) => void
    onClearSelection: () => void
    onSelectToggle: (orderId: string) => void
  },
) {
  if (e.key === 'Escape') {
    if (args.detailOpen || args.selectionMode) {
      e.preventDefault()
      args.onClearSelection()
      return true
    }
  }
  if (e.key === 'Enter' && args.focusedOrderId) {
    e.preventDefault()
    args.onOpenDetail(args.focusedOrderId)
    return true
  }
  if (e.key === ' ' && args.selectionMode && args.focusedOrderId) {
    e.preventDefault()
    args.onSelectToggle(args.focusedOrderId)
    return true
  }
  return e.key === ' ' || e.key === 'Enter' || e.key === 'Escape'
}

function moveFocus(
  key: string,
  pos: { colId: string; idx: number },
  groupedOrders: Record<string, OrderForDisplay[]>,
  columnIds: string[],
  onFocusChange: (orderId: string | null) => void,
) {
  const { colId, idx } = pos
  const colIndex = columnIds.indexOf(colId)
  if (key === 'ArrowUp' && idx > 0) onFocusChange(groupedOrders[colId][idx - 1].order_id)
  else if (key === 'ArrowDown' && idx < groupedOrders[colId].length - 1) onFocusChange(groupedOrders[colId][idx + 1].order_id)
  else if (key === 'ArrowLeft') moveHorizontal(-1, colIndex, idx, groupedOrders, columnIds, onFocusChange)
  else if (key === 'ArrowRight') moveHorizontal(1, colIndex, idx, groupedOrders, columnIds, onFocusChange)
}

function moveHorizontal(
  step: -1 | 1,
  colIndex: number,
  idx: number,
  groupedOrders: Record<string, OrderForDisplay[]>,
  columnIds: string[],
  onFocusChange: (orderId: string | null) => void,
) {
  for (let i = colIndex + step; i >= 0 && i < columnIds.length; i += step) {
    const targetOrders = groupedOrders[columnIds[i]]
    if (targetOrders.length > 0) {
      onFocusChange(targetOrders[Math.min(idx, targetOrders.length - 1)].order_id)
      break
    }
  }
}
