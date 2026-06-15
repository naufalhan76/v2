import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { OrderDetailContent } from './order-detail-content'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OrderDetailData = any

interface OrderDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  orderDetail: { success: boolean; data?: OrderDetailData } | undefined
  onOpenAddHelper: () => void
  onOpenRemoveHelper: (techId: string) => void
  onOpenCancel: () => void
  onOpenReschedule: () => void
  isProcessing: boolean
}

export function OrderDetailDialog({
  open,
  onOpenChange,
  orderDetail,
  onOpenAddHelper,
  onOpenRemoveHelper,
  onOpenCancel,
  onOpenReschedule,
  isProcessing,
}: OrderDetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Order Detail</DialogTitle>
          <DialogDescription>Complete information about this order</DialogDescription>
        </DialogHeader>
        {orderDetail?.data ? (
          <OrderDetailContent
            orderDetail={orderDetail}
            onOpenAddHelper={onOpenAddHelper}
            onOpenRemoveHelper={onOpenRemoveHelper}
            onOpenCancel={onOpenCancel}
            onOpenReschedule={onOpenReschedule}
            isProcessing={isProcessing}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
