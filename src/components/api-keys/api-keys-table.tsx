import { Plus, RefreshCw, Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { ApiKeyInfo } from '@/lib/actions/api-keys'

export function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('id-ID', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatLastUsed(dateString: string | null | undefined) {
  if (!dateString) return 'Never'
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
  return formatDate(dateString)
}

interface ApiKeysTableProps {
  keys: ApiKeyInfo[]
  isLoading: boolean
  isSaving: boolean
  onCreate: () => void
  onRegenerate: (keyId: string) => void
  onDelete: (keyId: string) => void
}

export function ApiKeysTable({
  keys,
  isLoading,
  isSaving,
  onCreate,
  onRegenerate,
  onDelete,
}: ApiKeysTableProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Your API Keys</CardTitle>
          <CardDescription>Manage your API keys for external integrations</CardDescription>
        </div>
        <Button onClick={onCreate} disabled={isLoading}>
          <Plus className="mr-2 h-4 w-4" />
          New API Key
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : keys.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">No API keys yet. Create one to get started.</p>
            <Button onClick={onCreate}>Create First API Key</Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((key) => (
                  <ApiKeyRow
                    key={key.api_key_id}
                    apiKey={key}
                    isSaving={isSaving}
                    onRegenerate={onRegenerate}
                    onDelete={onDelete}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ApiKeyRow({
  apiKey,
  isSaving,
  onRegenerate,
  onDelete,
}: {
  apiKey: ApiKeyInfo
  isSaving: boolean
  onRegenerate: (keyId: string) => void
  onDelete: (keyId: string) => void
}) {
  return (
    <TableRow>
      <TableCell>
        <div>
          <p className="font-medium">{apiKey.name}</p>
          {apiKey.description && <p className="text-xs text-muted-foreground">{apiKey.description}</p>}
        </div>
      </TableCell>
      <TableCell className="text-sm">{formatDate(apiKey.created_at)}</TableCell>
      <TableCell className="text-sm">{formatLastUsed(apiKey.last_used_at)}</TableCell>
      <TableCell>
        <ApiKeyStatus apiKey={apiKey} />
      </TableCell>
      <TableCell>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => onRegenerate(apiKey.api_key_id)} disabled={isSaving}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onDelete(apiKey.api_key_id)} disabled={isSaving}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}

function ApiKeyStatus({ apiKey }: { apiKey: ApiKeyInfo }) {
  if (!apiKey.is_active || (apiKey.expires_at && new Date(apiKey.expires_at) < new Date())) {
    return (
      <span className="inline-flex items-center rounded-full bg-status-cancelled-bg px-3 py-1 text-xs font-medium text-destructive">
        {!apiKey.is_active ? 'Inactive' : 'Expired'}
      </span>
    )
  }

  return (
    <span className="inline-flex items-center rounded-full bg-status-completed-bg px-3 py-1 text-xs font-medium text-status-completed">
      Active
    </span>
  )
}
