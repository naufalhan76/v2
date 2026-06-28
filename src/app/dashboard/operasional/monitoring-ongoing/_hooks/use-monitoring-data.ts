import { useState, useRef, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { getOrders, getOrderById, addHelperTechnician, removeHelperTechnician, updateOrderStatus } from '@/lib/actions/orders'
import { rescheduleOrder } from '@/lib/actions/orders-mutations-schedule'
import { getTechnicians } from '@/lib/actions/technicians'
import { useToast } from '@/hooks/use-toast'
import { logger } from '@/lib/logger'

interface UseMonitoringDataParams {
  dateFrom: Date
  dateTo: Date
  detailOrderId: string | null
  onDetailClose: () => void
}

export function useMonitoringData({ dateFrom, dateTo, detailOrderId, onDetailClose }: UseMonitoringDataParams) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const router = useRouter()
  const [isProcessing, setIsProcessing] = useState(false)
  const hasHandledRedirect = useRef(false)

  // Data fetching
  const { data: ordersData, isLoading } = useQuery({
    queryKey: ['orders', 'ongoing', format(dateFrom, 'yyyy-MM-dd'), format(dateTo, 'yyyy-MM-dd')],
    queryFn: () => getOrders({ limit: 1000, dateFrom: format(dateFrom, 'yyyy-MM-dd'), dateTo: format(dateTo, 'yyyy-MM-dd') })
  })

  const { data: orderDetail } = useQuery({
    queryKey: ['order', detailOrderId],
    queryFn: () => getOrderById(detailOrderId!),
    enabled: !!detailOrderId
  })

  const { data: techniciansData } = useQuery({
    queryKey: ['technicians'],
    queryFn: () => getTechnicians({ limit: 100 })
  })

  const technicians = techniciansData?.data || []

  // Helper management state
  const [showAddHelperDialog, setShowAddHelperDialog] = useState(false)
  const [showAddHelperConfirm, setShowAddHelperConfirm] = useState(false)
  const [selectedHelpers, setSelectedHelpers] = useState<string[]>([])
  const [showRemoveHelperDialog, setShowRemoveHelperDialog] = useState(false)
  const [helperToRemove, setHelperToRemove] = useState<string | null>(null)

  // Cancel/Reschedule state
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false)
  const [rescheduleDate, setRescheduleDate] = useState<Date | null>(null)
  const [today, setToday] = useState<Date>()
  useEffect(() => { setToday(new Date(new Date().setHours(0, 0, 0, 0))) }, [])

  const handleOpenAddHelper = () => { setSelectedHelpers([]); setShowAddHelperDialog(true) }

  const handleConfirmAddHelpers = () => {
    if (selectedHelpers.length === 0) {
      toast({ title: 'No Selection', description: 'Please select at least one helper', variant: 'destructive' })
      return
    }
    setShowAddHelperDialog(false)
    setShowAddHelperConfirm(true)
  }

  const handleAddHelpers = async () => {
    if (!detailOrderId || selectedHelpers.length === 0) return
    try {
      setIsProcessing(true)
      let successCount = 0
      const errorMessages: string[] = []
      for (const helperId of selectedHelpers) {
        const result = await addHelperTechnician(detailOrderId, helperId)
        if (result.success) successCount++
        else errorMessages.push(result.error || 'Failed to add helper')
      }
      if (successCount > 0) {
        toast({ title: 'Success', description: `${successCount} helper technician${successCount > 1 ? 's' : ''} added` })
        queryClient.invalidateQueries({ queryKey: ['order', detailOrderId] })
        queryClient.invalidateQueries({ queryKey: ['orders'] })
      }
      if (errorMessages.length > 0) toast({ title: 'Some helpers failed to add', description: errorMessages[0], variant: 'destructive' })
      setShowAddHelperConfirm(false)
      setSelectedHelpers([])
    } catch (error: unknown) {
      toast({ title: 'Error', description: (error as Error).message, variant: 'destructive' })
    } finally { setIsProcessing(false) }
  }

  const toggleHelperSelection = (helperId: string) => {
    setSelectedHelpers(prev => prev.includes(helperId) ? prev.filter(id => id !== helperId) : [...prev, helperId])
  }

  const handleRemoveHelper = async () => {
    if (!detailOrderId || !helperToRemove) return
    try {
      setIsProcessing(true)
      const result = await removeHelperTechnician(detailOrderId, helperToRemove)
      if (result.success) {
        toast({ title: 'Success', description: 'Helper technician removed' })
        queryClient.invalidateQueries({ queryKey: ['order', detailOrderId] })
        queryClient.invalidateQueries({ queryKey: ['orders'] })
        setShowRemoveHelperDialog(false)
        setHelperToRemove(null)
      } else toast({ title: 'Error', description: result.error, variant: 'destructive' })
    } catch (error: unknown) {
      toast({ title: 'Error', description: (error as Error).message, variant: 'destructive' })
    } finally { setIsProcessing(false) }
  }

  const getAvailableTechnicians = () => {
    if (!orderDetail?.data) return []
    const leadTech = orderDetail.data.order_technicians?.find((t: unknown) => (t as Record<string, unknown>).role === 'lead')
    const leadTechId = leadTech ? (leadTech as Record<string, unknown>).technician_id : undefined
    const helperIds = orderDetail.data.order_technicians?.flatMap((t: unknown) => {
      const tc = t as Record<string, unknown>
      return tc.role === 'helper' ? [tc.technician_id] : []
    }) || []
    return technicians.filter((tech: unknown) => {
      const t = tech as Record<string, unknown>
      return t.technician_id !== leadTechId && !helperIds.includes(t.technician_id)
    })
  }

  const handleCancelOrder = async () => {
    if (!detailOrderId) return
    setIsProcessing(true)
    try {
      const result = await updateOrderStatus(detailOrderId, 'CANCELLED', 'Cancelled from monitoring ongoing')
      if (result.success) {
        toast({ title: 'Success', description: 'Order cancelled successfully' })
        setCancelModalOpen(false)
        onDetailClose()
        hasHandledRedirect.current = false
        queryClient.invalidateQueries({ queryKey: ['orders'] })
        queryClient.invalidateQueries({ queryKey: ['notifications'] })
      } else toast({ title: 'Error', description: result.error || 'Failed to cancel order', variant: 'destructive' })
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'An error occurred', variant: 'destructive' })
    } finally { setIsProcessing(false) }
  }

  const handleRescheduleOrder = async () => {
    if (!detailOrderId || !rescheduleDate) return
    setIsProcessing(true)
    try {
      const formattedDate = format(rescheduleDate, 'yyyy-MM-dd')
      const result = await rescheduleOrder({
        orderId: detailOrderId,
        reason: 'Rescheduled from monitoring ongoing',
        newScheduledDate: formattedDate,
      })
      if (result.success) {
        toast({ title: 'Success', description: `Order rescheduled to ${format(rescheduleDate, 'dd MMM yyyy')}. Technician assignments have been reset.` })
        setRescheduleModalOpen(false)
        onDetailClose()
        setRescheduleDate(null)
        hasHandledRedirect.current = false
        queryClient.invalidateQueries({ queryKey: ['orders'] })
        queryClient.invalidateQueries({ queryKey: ['order', detailOrderId] })
        queryClient.invalidateQueries({ queryKey: ['notifications'] })
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'An error occurred', variant: 'destructive' })
    } finally { setIsProcessing(false) }
  }

  return {
    ordersData, orderDetail, technicians, isLoading, isProcessing, hasHandledRedirect,
    showAddHelperDialog, setShowAddHelperDialog, showAddHelperConfirm, setShowAddHelperConfirm,
    selectedHelpers, setSelectedHelpers, showRemoveHelperDialog, setShowRemoveHelperDialog,
    helperToRemove, setHelperToRemove, handleOpenAddHelper, handleConfirmAddHelpers,
    handleAddHelpers, toggleHelperSelection, handleRemoveHelper, getAvailableTechnicians,
    cancelModalOpen, setCancelModalOpen, rescheduleModalOpen, setRescheduleModalOpen,
    rescheduleDate, setRescheduleDate, today, handleCancelOrder, handleRescheduleOrder,
  }
}
