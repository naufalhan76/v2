'use client'

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
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'

interface ConfirmAssignmentDialogProps {
  showConfirm: boolean
  selectedOrders: string[]
  selectedTechnicianData?: Record<string, unknown> & { technician_name?: string }
  selectedHelpers: string[]
  technicians: unknown[]
  selectedDate: Date | undefined
  isAssigning: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmAssignmentDialog({
  showConfirm,
  selectedOrders,
  selectedTechnicianData,
  selectedHelpers,
  technicians,
  selectedDate,
  isAssigning,
  onConfirm,
  onCancel,
}: ConfirmAssignmentDialogProps) {
  return (
    <AlertDialog open={showConfirm} onOpenChange={onCancel}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirm Assignment</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className='space-y-3'>
              <p>
                Are you sure you want to assign <strong>{selectedOrders.length}</strong> order(s) to:
              </p>
              <div className='bg-muted rounded-lg p-3 space-y-2'>
                <div>
                  <span className='text-sm text-muted-foreground'>Lead Technician: </span>
                  <strong>{selectedTechnicianData?.technician_name}</strong>
                </div>
                {selectedHelpers.length > 0 && (
                  <div>
                    <span className='text-sm text-muted-foreground'>Helper Technicians: </span>
                    <div className='mt-1'>
                      {selectedHelpers.map((helperId) => {
                        const helper = technicians.find(
                          (t: unknown) => (t as Record<string, unknown>).technician_id === helperId
                        ) as Record<string, unknown> | undefined
                        return (
                          <Badge key={helperId} variant='outline' className='mr-1 mb-1'>
                            {helper?.technician_name as string}
                          </Badge>
                        )
                      })}
                    </div>
                  </div>
                )}
                <div className='pt-2 border-t'>
                  <span className='text-sm text-muted-foreground'>Visit Date: </span>
                  <strong>{selectedDate && format(selectedDate, 'PPP')}</strong>
                </div>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isAssigning}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isAssigning}>
            {isAssigning ? 'Assigning...' : 'Confirm'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
