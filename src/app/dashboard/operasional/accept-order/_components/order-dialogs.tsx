'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import type { OrderDetailProps } from './order-detail-content'
import { OrderDetailContent } from './order-detail-content'

interface OrderDialogsProps {
  orderDetail: { success: boolean; data?: unknown; error?: string } | undefined
  detailOrderId: string | null
  actionOrderId: string | null
  actionType: 'accept' | 'cancel' | null
  isProcessing: boolean
  onDetailClose: () => void
  onActionClose: () => void
  onActionClick: (orderId: string, type: 'accept' | 'cancel') => void
}

export function OrderDialogs({
  orderDetail,
  detailOrderId,
  actionOrderId,
  actionType,
  isProcessing,
  onDetailClose,
  onActionClose,
  onActionClick,
}: OrderDialogsProps) {
  return (
    <>
      {/* Order Detail Modal */}
      <Dialog open={!!detailOrderId} onOpenChange={(open) => !open && onDetailClose()}>
        <DialogContent className='max-w-2xl max-h-[80vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>Order Detail</DialogTitle>
            <DialogDescription>Complete information about this order</DialogDescription>
          </DialogHeader>
          {orderDetail?.success && !!orderDetail?.data && (
            <OrderDetailContent
              data={orderDetail.data as OrderDetailProps}
              onActionClick={(orderId: string, type: 'accept' | 'cancel') => {
                onDetailClose()
                onActionClick(orderId, type)
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Accept Confirmation Dialog */}
      <AlertDialog open={actionType === 'accept'} onOpenChange={(open) => !open && onActionClose()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Accept Order?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to accept this order? The order status will be changed to ACCEPTED and will be ready for technician assignment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => actionOrderId && onActionClick(actionOrderId, 'accept')}
              disabled={isProcessing}
              className='bg-info hover:bg-info/90'
            >
              {isProcessing ? 'Processing...' : 'Accept Order'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={actionType === 'cancel'} onOpenChange={(open) => !open && onActionClose()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Order?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this order? This action will mark the order as CANCELLED and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Go Back</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => actionOrderId && onActionClick(actionOrderId, 'cancel')}
              disabled={isProcessing}
              className='bg-muted-foreground hover:bg-muted-foreground/90'
            >
              {isProcessing ? 'Processing...' : 'Cancel Order'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
