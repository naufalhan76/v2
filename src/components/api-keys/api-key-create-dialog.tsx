import { AlertCircle, AlertTriangle, Copy, Eye, EyeOff, Loader2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ApiKeyWithSecret } from '@/lib/actions/api-keys'

interface ApiKeyCreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  newKeyData: ApiKeyWithSecret | null
  newKeyName: string
  newKeyDescription: string
  showApiKey: boolean
  isSaving: boolean
  onNameChange: (value: string) => void
  onDescriptionChange: (value: string) => void
  onShowApiKeyChange: (show: boolean) => void
  onCreate: () => void
  onCopy: (text: string) => void
  onDone: () => void
}

export function ApiKeyCreateDialog({
  open,
  onOpenChange,
  newKeyData,
  newKeyName,
  newKeyDescription,
  showApiKey,
  isSaving,
  onNameChange,
  onDescriptionChange,
  onShowApiKeyChange,
  onCreate,
  onCopy,
  onDone,
}: ApiKeyCreateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New API Key</DialogTitle>
          <DialogDescription>Create a new API key for programmatic access to our API.</DialogDescription>
        </DialogHeader>

        {!newKeyData ? (
          <ApiKeyForm
            newKeyName={newKeyName}
            newKeyDescription={newKeyDescription}
            isSaving={isSaving}
            onNameChange={onNameChange}
            onDescriptionChange={onDescriptionChange}
            onCreate={onCreate}
            onCancel={() => onOpenChange(false)}
          />
        ) : (
          <NewApiKeySecret
            newKeyData={newKeyData}
            showApiKey={showApiKey}
            onShowApiKeyChange={onShowApiKeyChange}
            onCopy={onCopy}
            onDone={onDone}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function ApiKeyForm({
  newKeyName,
  newKeyDescription,
  isSaving,
  onNameChange,
  onDescriptionChange,
  onCreate,
  onCancel,
}: {
  newKeyName: string
  newKeyDescription: string
  isSaving: boolean
  onNameChange: (value: string) => void
  onDescriptionChange: (value: string) => void
  onCreate: () => void
  onCancel: () => void
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="keyName">Key Name</Label>
        <Input
          id="keyName"
          placeholder="e.g., Mobile App, Third-party Integration"
          value={newKeyName}
          onChange={(e) => onNameChange(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="keyDescription">Description (Optional)</Label>
        <Input
          id="keyDescription"
          placeholder="e.g., Used for mobile app API calls"
          value={newKeyDescription}
          onChange={(e) => onDescriptionChange(e.target.value)}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        This API key will expire in 90 days. You can regenerate it before expiration.
      </p>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={onCreate} disabled={isSaving}>
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create Key
        </Button>
      </DialogFooter>
    </div>
  )
}

function NewApiKeySecret({
  newKeyData,
  showApiKey,
  onShowApiKeyChange,
  onCopy,
  onDone,
}: {
  newKeyData: ApiKeyWithSecret
  showApiKey: boolean
  onShowApiKeyChange: (show: boolean) => void
  onCopy: (text: string) => void
  onDone: () => void
}) {
  return (
    <div className="space-y-4">
      <Alert className="border-status-completed/30 bg-status-completed-bg">
        <AlertCircle className="h-4 w-4 text-status-completed" />
        <AlertDescription className="text-status-completed">{newKeyData.warning}</AlertDescription>
      </Alert>

      <div className="space-y-2">
        <Label>Your API Key</Label>
        <div className="flex gap-2">
          <Input readOnly type={showApiKey ? 'text' : 'password'} value={newKeyData.api_key} className="font-mono text-sm" />
          <Button variant="outline" size="sm" onClick={() => onShowApiKeyChange(!showApiKey)}>
            {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
          <Button variant="outline" size="sm" onClick={() => onCopy(newKeyData.api_key)}>
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-md border border-status-pending/30 bg-status-pending-bg p-3">
        <AlertTriangle className="h-4 w-4 shrink-0 text-status-pending mt-0.5" aria-hidden="true" />
        <p className="text-xs text-status-pending">
          Store this key securely. You won&apos;t be able to see it again. If you lose it, you&apos;ll need to regenerate a new one.
        </p>
      </div>

      <DialogFooter>
        <Button onClick={onDone}>Done</Button>
      </DialogFooter>
    </div>
  )
}
