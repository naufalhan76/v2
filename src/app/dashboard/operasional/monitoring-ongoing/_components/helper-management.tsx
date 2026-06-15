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
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { cn, formatPhone } from '@/lib/utils'

interface Technician {
  technician_id: string
  technician_name: string
  contact_number: string | number | null | undefined
}

interface HelperManagementProps {
  // Add Helper Dialog
  showAddHelperDialog: boolean
  setShowAddHelperDialog: (open: boolean) => void
  selectedHelpers: string[]
  toggleHelperSelection: (id: string) => void
  availableTechnicians: Technician[]
  handleConfirmAddHelpers: () => void

  // Add Helper Confirmation
  showAddHelperConfirm: boolean
  setShowAddHelperConfirm: (open: boolean) => void
  handleAddHelpers: () => Promise<void>

  // Remove Helper
  showRemoveHelperDialog: boolean
  setShowRemoveHelperDialog: (open: boolean) => void
  helperToRemove: string | null
  handleRemoveHelper: () => Promise<void>

  // Shared
  isProcessing: boolean
  allTechnicians: Technician[]
}

export function HelperManagement({
  showAddHelperDialog, setShowAddHelperDialog,
  selectedHelpers, toggleHelperSelection,
  availableTechnicians, handleConfirmAddHelpers,
  showAddHelperConfirm, setShowAddHelperConfirm,
  handleAddHelpers,
  showRemoveHelperDialog, setShowRemoveHelperDialog,
  helperToRemove, handleRemoveHelper,
  isProcessing,
  allTechnicians,
}: HelperManagementProps) {
  return (
    <>
      {/* Add Helper Dialog - Multi Select */}
      <Dialog open={showAddHelperDialog} onOpenChange={(open) => {
        setShowAddHelperDialog(open)
        if (!open) { /* handled by parent via setSelectedHelpers([]) */ }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Select Helper Technicians</DialogTitle>
            <DialogDescription>
              Choose one or more technicians to add as helpers
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {availableTechnicians.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No available technicians to add
              </div>
            ) : (
              <>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {availableTechnicians.map((tech) => (
                    <div
                      key={tech.technician_id}
                      className={cn(
                        'flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors',
                        selectedHelpers.includes(tech.technician_id)
                          ? 'bg-primary/5 border-primary'
                          : 'hover:bg-accent'
                      )}
                      onClick={() => toggleHelperSelection(tech.technician_id)}
                    >
                      <Checkbox
                        checked={selectedHelpers.includes(tech.technician_id)}
                        onCheckedChange={() => toggleHelperSelection(tech.technician_id)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="font-medium">{tech.technician_name}</div>
                        <div className="text-sm text-muted-foreground">{formatPhone(tech.contact_number)}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between pt-3 border-t">
                  <span className="text-sm text-muted-foreground">
                    {selectedHelpers.length} selected
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowAddHelperDialog(false)
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleConfirmAddHelpers}
                      disabled={selectedHelpers.length === 0}
                    >
                      Continue
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Helper Confirmation Dialog */}
      <AlertDialog open={showAddHelperConfirm} onOpenChange={setShowAddHelperConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Add Helper Technicians</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Are you sure you want to add <strong>{selectedHelpers.length}</strong> helper{selectedHelpers.length > 1 ? 's' : ''} to this order?
                </p>
                <div className="bg-muted rounded-lg p-3 max-h-[200px] overflow-y-auto">
                  <div className="space-y-2">
                    {selectedHelpers.map((helperId) => {
                      const helper = allTechnicians.find((t: Technician) => t.technician_id === helperId)
                      return (
                        <div key={helperId} className="flex items-center justify-between text-sm">
                          <span className="font-medium">{helper?.technician_name}</span>
                          <span className="text-muted-foreground text-xs">{formatPhone(helper?.contact_number)}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleAddHelpers} disabled={isProcessing}>
              {isProcessing ? 'Adding...' : 'Add Helpers'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove Helper Confirmation Dialog */}
      <AlertDialog open={showRemoveHelperDialog} onOpenChange={setShowRemoveHelperDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Helper Technician</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this helper technician from this order? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveHelper} disabled={isProcessing} className="bg-destructive hover:bg-destructive/90">
              {isProcessing ? 'Removing...' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
