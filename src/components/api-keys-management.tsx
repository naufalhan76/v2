'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Separator } from '@/components/ui/separator'
import { Copy, Eye, EyeOff, Loader2, Plus, RefreshCw, Trash2, AlertCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  getUserApiKeys,
  createApiKey,
  regenerateApiKey,
  updateApiKey,
  deleteApiKey,
  type ApiKeyInfo,
  type ApiKeyWithSecret,
} from '@/lib/actions/api-keys'

export function ApiKeysManagement() {
  const [keys, setKeys] = useState<ApiKeyInfo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [showNewKeyDialog, setShowNewKeyDialog] = useState(false)
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showCopiedNotification, setShowCopiedNotification] = useState(false)
  const [newKeyData, setNewKeyData] = useState<ApiKeyWithSecret | null>(null)
  const [selectedKeyId, setSelectedKeyId] = useState<string | null>(null)
  const [newKeyName, setNewKeyName] = useState('')
  const [newKeyDescription, setNewKeyDescription] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)

  const { toast } = useToast()

  // Load API keys on mount
  useEffect(() => {
    loadKeys()
  }, [])

  async function loadKeys() {
    try {
      setIsLoading(true)
      const result = await getUserApiKeys()
      if (result.success) {
        setKeys(result.keys)
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to load API keys',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error loading API keys:', error)
      toast({
        title: 'Error',
        description: 'Failed to load API keys',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  async function handleCreateKey() {
    if (!newKeyName.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please enter a name for the API key',
        variant: 'destructive',
      })
      return
    }

    try {
      setIsSaving(true)
      const result = await createApiKey(newKeyName, newKeyDescription || undefined, 90)
      if (result.success && result.data) {
        setNewKeyData(result.data)
        setNewKeyName('')
        setNewKeyDescription('')
        await loadKeys()
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to create API key',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error creating API key:', error)
      toast({
        title: 'Error',
        description: 'Failed to create API key',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  async function handleRegenerateKey() {
    if (!selectedKeyId) return

    try {
      setIsSaving(true)
      const result = await regenerateApiKey(selectedKeyId)
      if (result.success && result.data) {
        setNewKeyData({
          ...result.data,
          api_key: 'sk_live_' + Math.random().toString(36).substring(2, 34), // Placeholder
          warning: result.data.warning || 'Old API key is now invalid. Save this new key in a secure location!',
        })
        setShowRegenerateDialog(false)
        await loadKeys()
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to regenerate API key',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error regenerating API key:', error)
      toast({
        title: 'Error',
        description: 'Failed to regenerate API key',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDeleteKey() {
    if (!selectedKeyId) return

    try {
      setIsSaving(true)
      const result = await deleteApiKey(selectedKeyId)
      if (result.success) {
        toast({
          title: 'Success',
          description: 'API key deleted successfully',
        })
        setShowDeleteDialog(false)
        await loadKeys()
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to delete API key',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error deleting API key:', error)
      toast({
        title: 'Error',
        description: 'Failed to delete API key',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text)
    setShowCopiedNotification(true)
    setTimeout(() => setShowCopiedNotification(false), 2000)
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  function formatLastUsed(dateString: string | null | undefined) {
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">API Keys</h2>
        <p className="text-sm text-muted-foreground mt-2">
          Create and manage API keys for programmatic access to the API. Each key can be regenerated or revoked individually.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Your API Keys</CardTitle>
            <CardDescription>Manage your API keys for external integrations</CardDescription>
          </div>
          <Button onClick={() => setShowNewKeyDialog(true)} disabled={isLoading}>
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
              <Button onClick={() => setShowNewKeyDialog(true)}>Create First API Key</Button>
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
                    <TableRow key={key.api_key_id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{key.name}</p>
                          {key.description && (
                            <p className="text-xs text-muted-foreground">{key.description}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{formatDate(key.created_at)}</TableCell>
                      <TableCell className="text-sm">{formatLastUsed(key.last_used_at)}</TableCell>
                      <TableCell>
                        {!key.is_active ? (
                          <span className="inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700">
                            Inactive
                          </span>
                        ) : key.expires_at && new Date(key.expires_at) < new Date() ? (
                          <span className="inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700">
                            Expired
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                            Active
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedKeyId(key.api_key_id)
                              setShowRegenerateDialog(true)
                            }}
                            disabled={isSaving}
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedKeyId(key.api_key_id)
                              setShowDeleteDialog(true)
                            }}
                            disabled={isSaving}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Usage Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Using Your API Key</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">Authentication</h4>
            <p className="text-sm text-muted-foreground mb-3">
              Include your API key in the <code className="bg-muted px-2 py-1 rounded">x-api-key</code> header:
            </p>
            <div className="bg-muted p-3 rounded-lg overflow-x-auto">
              <code className="text-sm">{`curl -H "x-api-key: sk_live_..." https://api.example.com/api/orders`}</code>
            </div>
          </div>
          <Separator />
          <div>
            <h4 className="font-medium mb-2">Example cURL Request</h4>
            <div className="bg-muted p-3 rounded-lg overflow-x-auto">
              <code className="text-sm whitespace-pre-wrap">{`curl -X GET \\
  -H \"x-api-key: sk_live_your_api_key\" \\
  https://api.example.com/api/orders?page=1&limit=10`}</code>
            </div>
          </div>
          <Separator />
          <div>
            <h4 className="font-medium mb-2">Available Endpoints</h4>
            <p className="text-sm text-muted-foreground">
              All REST API endpoints accept your API key for authentication. See the API documentation page for the complete list of endpoints.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* New API Key Dialog */}
      <Dialog open={showNewKeyDialog} onOpenChange={setShowNewKeyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New API Key</DialogTitle>
            <DialogDescription>
              Create a new API key for programmatic access to our API.
            </DialogDescription>
          </DialogHeader>

          {!newKeyData ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="keyName">Key Name</Label>
                <Input
                  id="keyName"
                  placeholder="e.g., Mobile App, Third-party Integration"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="keyDescription">Description (Optional)</Label>
                <Input
                  id="keyDescription"
                  placeholder="e.g., Used for mobile app API calls"
                  value={newKeyDescription}
                  onChange={(e) => setNewKeyDescription(e.target.value)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                This API key will expire in 90 days. You can regenerate it before expiration.
              </p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowNewKeyDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateKey} disabled={isSaving}>
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Key
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <Alert className="border-green-200 bg-green-50">
                <AlertCircle className="h-4 w-4 text-green-700" />
                <AlertDescription className="text-green-700">
                  {newKeyData.warning}
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label>Your API Key</Label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      readOnly
                      type={showApiKey ? 'text' : 'password'}
                      value={newKeyData.api_key}
                      className="font-mono text-sm"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowApiKey(!showApiKey)}
                  >
                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(newKeyData.api_key)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-xs text-yellow-800">
                  ⚠️ Store this key securely. You won&apos;t be able to see it again. If you lose it, you&apos;ll need to regenerate a new one.
                </p>
              </div>

              <DialogFooter>
                <Button
                  onClick={() => {
                    setShowNewKeyDialog(false)
                    setNewKeyData(null)
                    setShowApiKey(false)
                  }}
                >
                  Done
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Regenerate API Key Dialog */}
      <AlertDialog open={showRegenerateDialog} onOpenChange={setShowRegenerateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate API Key?</AlertDialogTitle>
            <AlertDialogDescription>
              This will invalidate the current API key and create a new one. Any integrations using the old key will stop working.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRegenerateKey} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Regenerate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete API Key Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete API Key?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the API key. Any integrations using this key will stop working.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteKey} disabled={isSaving} className="bg-red-600 hover:bg-red-700">
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
