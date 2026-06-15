import { format } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'

interface StatusActionDialogsProps {
  // Cancel
  cancelModalOpen: boolean
  setCancelModalOpen: (open: boolean) => void
  handleCancelOrder: () => Promise<void>
  
  // Reschedule
  rescheduleModalOpen: boolean
  setRescheduleModalOpen: (open: boolean) => void
  rescheduleDate: Date | null
  setRescheduleDate: (date: Date | null) => void
  today: Date | undefined
  handleRescheduleOrder: () => Promise<void>
  
  // Shared
  isProcessing: boolean
}

export function StatusActionDialogs({
  cancelModalOpen, setCancelModalOpen, handleCancelOrder,
  rescheduleModalOpen, setRescheduleModalOpen,
  rescheduleDate, setRescheduleDate,
  today, handleRescheduleOrder,
  isProcessing,
}: StatusActionDialogsProps) {
  return (
    <>
      {/* Cancel Order Confirmation Dialog */}
      <AlertDialog open={cancelModalOpen} onOpenChange={setCancelModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this order? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>
              Keep Order
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelOrder} disabled={isProcessing} className="bg-destructive hover:bg-destructive/90">
              {isProcessing ? 'Cancelling...' : 'Cancel Order'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reschedule Order Dialog */}
      <Dialog open={rescheduleModalOpen} onOpenChange={setRescheduleModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reschedule Order</DialogTitle>
            <DialogDescription>
              Select a new date for this order
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select New Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {rescheduleDate ? format(rescheduleDate, 'dd MMM yyyy') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={rescheduleDate || undefined}
                    onSelect={(date) => setRescheduleDate(date || null)}
                    disabled={today ? (date) => date < today : undefined}
                    initialFocus
                    required
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <div className="flex gap-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => {
                setRescheduleModalOpen(false)
                setRescheduleDate(null)
              }}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRescheduleOrder}
              disabled={!rescheduleDate || isProcessing}
            >
              {isProcessing ? 'Rescheduling...' : 'Reschedule'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
